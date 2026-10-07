use crate::{
    audio::{AudioPlayer, QueueState},
    auth,
    files::pick_mp3s,
    layouts,
    library::{ImportResult, Library, Track},
    themes::{self, Theme},
    updates::{self, UpdateInfo},
};
use anyhow::Result;
use slint::{ComponentHandle, ModelRc, SharedString, Timer, TimerMode, VecModel};
use std::{
    cell::RefCell, path::PathBuf, process::Command, rc::Rc, sync::mpsc::Receiver, time::Duration,
};
slint::include_modules!();

struct State {
    library: Library,
    themes: Vec<Theme>,
    theme_index: usize,
    layout: layouts::Layout,
    audio: Option<AudioPlayer>,
    queue: QueueState,
    data_dir: PathBuf,
    auth: auth::Auth,
    auth_login_rx: Option<Receiver<anyhow::Result<String>>>,
    update_rx: Option<Receiver<anyhow::Result<Option<UpdateInfo>>>>,
    update_check_running: bool,
    update_release_url: Option<String>,
    #[cfg(not(target_os = "windows"))]
    media_controls: Option<souvlaki::MediaControls>,
    remix_enabled: bool,
    synth: bool,
    echo: bool,
    chorus: bool,
    lo_fi: bool,
}

pub fn run() -> Result<()> {
    let tray_menu = tray_icon::menu::Menu::new();
    let quit_item = tray_icon::menu::MenuItem::new("Quit", true, None);
    let _ = tray_menu.append(&quit_item);

    let _tray_icon = tray_icon::TrayIconBuilder::new()
        .with_tooltip("Ahoy Player")
        .with_menu(Box::new(tray_menu))
        .build()
        .ok();

    #[cfg(not(target_os = "windows"))]
    let media_controls = souvlaki::MediaControls::new(souvlaki::PlatformConfig {
        dbus_name: "ahoy_player",
        display_name: "Ahoy Player",
        hwnd: None,
    })
    .ok();

    let data_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("ahoy-player");
    let library = Library::load(&data_dir.join("library.json"))?;
    let themes = themes::load(&data_dir.join("themes.json"))?;
    let layout = layouts::load(&data_dir.join("layout.json"))?;
    let auth = auth::load(&data_dir.join("auth.json")).unwrap_or_default();
    let queue = QueueState::new(
        library
            .tracks
            .iter()
            .map(|track| track.id.clone())
            .collect(),
    );
    let audio = AudioPlayer::new().ok();
    let audio_status = if audio.is_some() {
        "Ready"
    } else {
        "Audio output unavailable"
    };
    let state = Rc::new(RefCell::new(State {
        library,
        themes,
        theme_index: 0,
        layout,
        audio,
        queue,
        data_dir,
        auth,
        auth_login_rx: None,
        update_rx: None,
        update_check_running: false,
        update_release_url: None,
        #[cfg(not(target_os = "windows"))]
        media_controls,
        remix_enabled: false,
        synth: false,
        echo: false,
        chorus: false,
        lo_fi: false,
    }));
    let window = AppWindow::new()?;
    refresh(&window, &state.borrow());
    window.set_show_welcome_modal(
        !state.borrow().auth.welcome_dismissed && state.borrow().auth.ahoy_id.is_none(),
    );
    if let Some(ref id) = state.borrow().auth.ahoy_id {
        window.set_ahoy_id(id.into());
    } else {
        window.set_ahoy_id("".into());
    }
    window.set_status(audio_status.into());
    window.set_update_status("Checking updates…".into());
    window.set_remix_enabled(false);
    window.set_synth(false);
    window.set_echo(false);
    window.set_chorus(false);
    window.set_lo_fi(false);
    window.set_volume(100.0);
    window.set_song_volume(100.0);
    window.set_remix_volume(80.0);
    window.set_shuffle(state.borrow().queue.shuffle);
    window.set_repeat(state.borrow().queue.repeat);
    let initial_theme = state.borrow().themes[0].clone();
    apply_theme(&window, &initial_theme);

    start_update_check(&state, &window, false);

    let weak_update = window.as_weak();
    let state_update = state.clone();
    window.on_update_action(move || {
        if let Some(window) = weak_update.upgrade() {
            let release_url = state_update.borrow().update_release_url.clone();
            if let Some(url) = release_url {
                if open_update_page(&url).is_err() {
                    window.set_update_status("Could not open release page".into());
                }
            } else {
                start_update_check(&state_update, &window, true);
            }
        }
    });

    let weak_close = window.as_weak();
    window.on_close_window(move || {
        if let Some(window) = weak_close.upgrade() {
            let _ = window.hide();
            std::process::exit(0);
        }
    });

    let weak_min = window.as_weak();
    window.on_minimize_window(move || {
        if let Some(window) = weak_min.upgrade() {
            let _ = window.window().set_minimized(true);
        }
    });

    let quit_id = quit_item.id().clone();
    std::thread::spawn(move || loop {
        if let Ok(event) = tray_icon::menu::MenuEvent::receiver().try_recv() {
            if event.id == quit_id {
                std::process::exit(0);
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    });

    #[cfg(not(target_os = "windows"))]
    if let Some(controls) = state.borrow_mut().media_controls.as_mut() {
        let weak_media = window.as_weak();
        let state_media = state.clone();
        let weak_window = window.as_weak();
        window.on_request_playback(move |playing| {
            if let Some(window) = weak_window.upgrade() {
                apply_playback_state(&mut state_media.borrow_mut(), &window, playing);
            }
        });
        controls
            .attach(move |event| {
                let weak = weak_media.clone();
                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(window) = weak.upgrade() {
                        match event {
                            souvlaki::MediaControlEvent::Play => {
                                window.invoke_request_playback(true)
                            }
                            souvlaki::MediaControlEvent::Pause
                            | souvlaki::MediaControlEvent::Stop => {
                                window.invoke_request_playback(false)
                            }
                            souvlaki::MediaControlEvent::Toggle => {
                                window.invoke_toggle_play();
                            }
                            souvlaki::MediaControlEvent::Next => {
                                window.invoke_next_track();
                            }
                            souvlaki::MediaControlEvent::Previous => {
                                window.invoke_previous_track();
                            }
                            _ => {}
                        }
                    }
                });
            })
            .ok();
    }

    let weak = window.as_weak();
    let state_volume = state.clone();
    window.on_set_volume(move |vol| {
        if let Some(window) = weak.upgrade() {
            let mut state = state_volume.borrow_mut();
            window.set_volume(vol);
            if let Some(audio) = &mut state.audio {
                audio.set_volume(vol / 100.0);
            }
        }
    });

    let weak = window.as_weak();
    let state_song_volume = state.clone();
    window.on_set_song_volume(move |vol| {
        if let Some(window) = weak.upgrade() {
            window.set_song_volume(vol);
            if let Some(audio) = &mut state_song_volume.borrow_mut().audio {
                audio.set_song_volume(vol / 100.0);
            }
        }
    });

    let weak = window.as_weak();
    let state_remix_volume = state.clone();
    window.on_set_remix_volume(move |vol| {
        if let Some(window) = weak.upgrade() {
            window.set_remix_volume(vol);
            if let Some(audio) = &mut state_remix_volume.borrow_mut().audio {
                audio.set_remix_volume(vol / 100.0);
            }
        }
    });

    let weak = window.as_weak();
    let state_import = state.clone();
    window.on_import_files(move || { if let Some(window) = weak.upgrade() { let mut state = state_import.borrow_mut(); let mut imported = 0; let mut duplicates = 0; let mut failures = 0; for path in pick_mp3s() { match state.library.import(path) { Ok(ImportResult::Imported) => imported += 1, Ok(ImportResult::Duplicate) => duplicates += 1, Ok(ImportResult::Rejected) | Err(_) => failures += 1 } } if imported > 0 { state.queue = QueueState::new(state.library.tracks.iter().map(|track| track.id.clone()).collect()); if let Err(error) = state.library.save(&state.data_dir.join("library.json")) { window.set_status(format!("Could not save library: {error}").into()); } else { refresh(&window, &state); } } let message = if imported > 0 { format!("Scanned and added {imported} MP3(s); {duplicates} duplicate(s); {failures} failed") } else if duplicates > 0 { format!("No new MP3s; {duplicates} duplicate(s)") } else if failures > 0 { format!("Scan failed for {failures} file(s)") } else { "Scan cancelled".to_string() }; window.set_status(message.into()); } });

    let weak = window.as_weak();
    let state_select = state.clone();
    window.on_select_track(move |index| {
        if let Some(window) = weak.upgrade() {
            let mut state = state_select.borrow_mut();
            if let Some(track) = state.library.tracks.get(index as usize).cloned() {
                state.queue.index = Some(index as usize);
                if play_track(&mut state, &window, &track) {
                    window.set_status("Playing".into());
                }
            }
        }
    });

    let weak = window.as_weak();
    let state_toggle = state.clone();
    window.on_toggle_play(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_toggle.borrow_mut();
            if state.queue.index.is_none() {
                window.set_status("Scan for MP3s first".into());
                return;
            }
            state.queue.playing = !state.queue.playing;
            if let Some(audio) = &state.audio {
                if state.queue.playing {
                    audio.resume();
                } else {
                    audio.pause();
                }
                window.set_status(
                    if state.queue.playing {
                        "Playing"
                    } else {
                        "Paused"
                    }
                    .into(),
                );
            } else {
                state.queue.playing = false;
                window.set_status("Audio output unavailable".into());
            }
            let playing = state.queue.playing;
            set_media_playback(&mut state, playing);
            window.set_playing(playing);
        }
    });

    let weak = window.as_weak();
    let state_next = state.clone();
    window.on_next_track(move || advance(&weak, &state_next, true));
    let weak = window.as_weak();
    let state_previous = state.clone();
    window.on_previous_track(move || advance(&weak, &state_previous, false));

    let weak = window.as_weak();
    let state_shuffle = state.clone();
    window.on_toggle_shuffle(move || {
        let mut state = state_shuffle.borrow_mut();
        state.queue.shuffle = !state.queue.shuffle;
        let value = state.queue.shuffle;
        if let Some(window) = weak.upgrade() {
            window.set_shuffle(value);
            window.set_status(if value { "Shuffle on" } else { "Shuffle off" }.into());
        }
    });

    let weak = window.as_weak();
    let state_repeat = state.clone();
    window.on_toggle_repeat(move || {
        let mut state = state_repeat.borrow_mut();
        state.queue.repeat = !state.queue.repeat;
        let value = state.queue.repeat;
        if let Some(window) = weak.upgrade() {
            window.set_repeat(value);
            window.set_status(if value { "Repeat on" } else { "Repeat off" }.into());
        }
    });

    let weak = window.as_weak();
    let state_remix = state.clone();
    window.on_toggle_remix(move || {
        let mut state = state_remix.borrow_mut();
        state.remix_enabled = !state.remix_enabled;
        if let Some(window) = weak.upgrade() {
            window.set_remix_enabled(state.remix_enabled);
            window.set_status(
                if state.remix_enabled {
                    "Remix keyboard ready · Q W E R T Y U I"
                } else {
                    "Remix keyboard off"
                }
                .into(),
            );
        }
    });

    let weak = window.as_weak();
    let state_synth = state.clone();
    window.on_toggle_synth(move || {
        let mut state = state_synth.borrow_mut();
        state.synth = !state.synth;
        if let Some(window) = weak.upgrade() {
            window.set_synth(state.synth);
        }
    });
    let weak = window.as_weak();
    let state_echo = state.clone();
    window.on_toggle_echo(move || {
        let mut state = state_echo.borrow_mut();
        state.echo = !state.echo;
        if let Some(window) = weak.upgrade() {
            window.set_echo(state.echo);
        }
    });
    let weak = window.as_weak();
    let state_chorus = state.clone();
    window.on_toggle_chorus(move || {
        let mut state = state_chorus.borrow_mut();
        state.chorus = !state.chorus;
        if let Some(window) = weak.upgrade() {
            window.set_chorus(state.chorus);
        }
    });
    let weak = window.as_weak();
    let state_lofi = state.clone();
    window.on_toggle_lofi(move || {
        let mut state = state_lofi.borrow_mut();
        state.lo_fi = !state.lo_fi;
        if let Some(window) = weak.upgrade() {
            window.set_lo_fi(state.lo_fi);
        }
    });

    let state_note = state.clone();
    let weak = window.as_weak();
    window.on_play_remix_note(move |index, synth_held| {
        let mut state = state_note.borrow_mut();
        if !state.remix_enabled || !state.queue.playing {
            return;
        }
        let (synth, echo, chorus, lo_fi) = (
            state.synth || synth_held,
            state.echo,
            state.chorus,
            state.lo_fi,
        );
        let result = state
            .audio
            .as_mut()
            .map(|audio| audio.play_remix_note(index as usize, synth, echo, chorus, lo_fi));
        if !matches!(result, Some(Ok(()))) {
            if let Some(window) = weak.upgrade() {
                window.set_status("Audio output unavailable".into());
            }
            return;
        }
    });

    let weak = window.as_weak();
    let state_theme = state.clone();
    window.on_next_theme(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_theme.borrow_mut();
            state.theme_index = (state.theme_index + 1) % state.themes.len();
            let theme = state.themes[state.theme_index].clone();
            apply_theme(&window, &theme);
            window.set_theme_name(theme.name.into());
            window.set_status("Theme changed".into());
        }
    });

    let weak = window.as_weak();
    let state_save = state.clone();
    window.on_save_theme(move || {
        if let Some(window) = weak.upgrade() {
            let state = state_save.borrow();
            let status = match themes::save(&state.data_dir.join("themes.json"), &state.themes) {
                Ok(()) => "Theme saved",
                Err(_) => "Could not save theme",
            };
            window.set_status(status.into());
        }
    });

    let weak = window.as_weak();
    let state_layout = state.clone();
    window.on_toggle_library(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_layout.borrow_mut();
            if let Some(panel) = state
                .layout
                .panels
                .iter_mut()
                .find(|panel| panel.id == "Library")
            {
                panel.visible = !panel.visible;
                window.set_show_library(panel.visible);
                let status =
                    if layouts::save(&state.data_dir.join("layout.json"), &state.layout).is_ok() {
                        "Layout saved"
                    } else {
                        "Could not save layout"
                    };
                window.set_status(status.into());
            }
        }
    });

    let weak = window.as_weak();
    let state_queue_toggle = state.clone();
    window.on_toggle_queue(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_queue_toggle.borrow_mut();
            if let Some(panel) = state
                .layout
                .panels
                .iter_mut()
                .find(|panel| panel.id == "Queue")
            {
                panel.visible = !panel.visible;
                window.set_show_queue(panel.visible);
                let status =
                    if layouts::save(&state.data_dir.join("layout.json"), &state.layout).is_ok() {
                        "Queue visibility saved"
                    } else {
                        "Could not save layout"
                    };
                window.set_status(status.into());
            }
        }
    });

    let weak = window.as_weak();
    let state_export = state.clone();
    window.on_export_theme(move || {
        if let Some(window) = weak.upgrade() {
            let state = state_export.borrow();
            if let Some(path) = rfd::FileDialog::new()
                .set_file_name("ahoy-theme.json")
                .save_file()
            {
                let result = std::fs::write(
                    path,
                    serde_json::to_vec_pretty(&state.themes[state.theme_index]).unwrap_or_default(),
                );
                window.set_status(
                    if result.is_ok() {
                        "Theme exported"
                    } else {
                        "Could not export theme"
                    }
                    .into(),
                );
            }
        }
    });

    let weak = window.as_weak();
    let state_import_theme = state.clone();
    window.on_import_theme(move || {
        if let Some(window) = weak.upgrade() {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("Ahoy theme", &["json"])
                .pick_file()
            {
                match std::fs::read_to_string(path)
                    .ok()
                    .and_then(|text| themes::import_json(&text).ok())
                {
                    Some(theme) => {
                        let mut state = state_import_theme.borrow_mut();
                        state.themes.push(theme.clone());
                        state.theme_index = state.themes.len() - 1;
                        let _ = themes::save(&state.data_dir.join("themes.json"), &state.themes);
                        apply_theme(&window, &theme);
                        window.set_theme_name(theme.name.into());
                        window.set_status("Theme imported".into());
                    }
                    None => window.set_status("Invalid theme JSON".into()),
                }
            }
        }
    });

    let weak = window.as_weak();
    let state_login = state.clone();
    window.on_login_ahoy(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_login.borrow_mut();
            if state.auth_login_rx.is_some() {
                window.set_status("Waiting for browser sign-in to finish…".into());
                return;
            }
            window.set_status("Waiting for browser login...".into());
            let (sender, receiver) = std::sync::mpsc::channel();
            state.auth_login_rx = Some(receiver);
            std::thread::spawn(move || {
                let _ = sender.send(crate::auth::start_login_server());
            });
        }
    });

    let weak = window.as_weak();
    let state_logout = state.clone();
    window.on_logout_ahoy(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_logout.borrow_mut();
            state.auth.ahoy_id = None;
            window.set_ahoy_id("".into());
            let _ = crate::auth::save(&state.data_dir.join("auth.json"), &state.auth);
            window.set_status("Logged out".into());
        }
    });

    let weak = window.as_weak();
    let state_dismiss = state.clone();
    window.on_dismiss_welcome(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_dismiss.borrow_mut();
            state.auth.welcome_dismissed = true;
            let _ = crate::auth::save(&state.data_dir.join("auth.json"), &state.auth);
            window.set_show_welcome_modal(false);
        }
    });

    let auto_advance_timer = Timer::default();
    let weak = window.as_weak();
    let state_auto_advance = state.clone();
    auto_advance_timer.start(TimerMode::Repeated, Duration::from_millis(250), move || {
        let update_result = {
            let mut state = state_auto_advance.borrow_mut();
            let result = state
                .update_rx
                .as_ref()
                .and_then(|receiver| match receiver.try_recv() {
                    Ok(result) => Some(result),
                    Err(std::sync::mpsc::TryRecvError::Empty) => None,
                    Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                        Some(Err(anyhow::anyhow!("Update check was interrupted")))
                    }
                });
            if result.is_some() {
                state.update_rx = None;
                state.update_check_running = false;
            }
            result
        };
        if let Some(result) = update_result {
            if let Some(window) = weak.upgrade() {
                match result {
                    Ok(Some(info)) => {
                        window.set_update_status(format!("Update {}", info.version).into());
                        state_auto_advance.borrow_mut().update_release_url = Some(info.release_url);
                    }
                    Ok(None) => {
                        window.set_update_status("Up to date".into());
                        state_auto_advance.borrow_mut().update_release_url = None;
                    }
                    Err(error) => {
                        window.set_update_status("Retry update check".into());
                        window.set_status(format!("Update check unavailable: {error}").into());
                    }
                }
            }
        }
        let auth_result = {
            let mut state = state_auto_advance.borrow_mut();
            let result =
                state
                    .auth_login_rx
                    .as_ref()
                    .and_then(|receiver| match receiver.try_recv() {
                        Ok(result) => Some(result),
                        Err(std::sync::mpsc::TryRecvError::Empty) => None,
                        Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                            Some(Err(anyhow::anyhow!("Sign-in was interrupted")))
                        }
                    });
            if result.is_some() {
                state.auth_login_rx = None;
            }
            result
        };
        if let Some(result) = auth_result {
            if let Some(window) = weak.upgrade() {
                match result {
                    Ok(ahoy_id) => {
                        let mut state = state_auto_advance.borrow_mut();
                        state.auth.ahoy_id = Some(ahoy_id.clone());
                        if crate::auth::save(&state.data_dir.join("auth.json"), &state.auth).is_ok()
                        {
                            window.set_ahoy_id(ahoy_id.into());
                            window.set_status("AHOY ID connected".into());
                        } else {
                            window.set_status(
                                "Signed in, but could not save the account locally".into(),
                            );
                        }
                    }
                    Err(error) => {
                        window.set_status(format!("AHOY ID sign-in failed: {error}").into())
                    }
                }
            }
        }
        let finished = {
            let state = state_auto_advance.borrow();
            state.queue.playing
                && state
                    .audio
                    .as_ref()
                    .map(AudioPlayer::is_finished)
                    .unwrap_or(false)
        };
        if finished {
            advance(&weak, &state_auto_advance, true);
        }
    });

    window.run()?;
    drop(auto_advance_timer);
    Ok(())
}

fn start_update_check(state: &Rc<RefCell<State>>, window: &AppWindow, force: bool) {
    let mut state = state.borrow_mut();
    if state.update_check_running {
        return;
    }
    let (sender, receiver) = std::sync::mpsc::channel();
    state.update_rx = Some(receiver);
    state.update_check_running = true;
    state.update_release_url = None;
    let data_dir = state.data_dir.clone();
    window.set_update_status("Checking updates…".into());
    std::thread::spawn(move || {
        let _ = sender.send(updates::check_for_update(&data_dir, force));
    });
}

fn open_update_page(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("cmd");
    #[cfg(target_os = "windows")]
    command.args(["/C", "start", "", url]);
    #[cfg(not(target_os = "windows"))]
    command.arg(url);
    command.spawn().map(|_| ())
}

fn advance(weak: &slint::Weak<AppWindow>, state: &Rc<RefCell<State>>, next: bool) {
    if let Some(window) = weak.upgrade() {
        let mut state = state.borrow_mut();
        let moved = if next {
            state.queue.next()
        } else {
            state.queue.previous()
        };
        if moved {
            if let Some(index) = state.queue.index {
                if let Some(track) = state.library.tracks.get(index).cloned() {
                    let _ = play_track(&mut state, &window, &track);
                }
            }
        } else if next {
            if let Some(audio) = &mut state.audio {
                audio.stop();
            }
            state.queue.playing = false;
            set_media_playback(&mut state, false);
            window.set_playing(false);
            window.set_status("End of queue".into());
        }
    }
}

fn apply_playback_state(state: &mut State, window: &AppWindow, playing: bool) {
    if state.queue.index.is_none() {
        return;
    }
    let Some(audio) = &state.audio else {
        state.queue.playing = false;
        window.set_status("Audio output unavailable".into());
        window.set_playing(false);
        return;
    };
    if playing {
        audio.resume();
    } else {
        audio.pause();
    }
    state.queue.playing = playing;
    set_media_playback(state, playing);
    window.set_playing(playing);
    window.set_status(if playing { "Playing" } else { "Paused" }.into());
}

fn play_track(state: &mut State, window: &AppWindow, track: &Track) -> bool {
    let Some(audio) = &mut state.audio else {
        state.queue.playing = false;
        window.set_status("Audio output unavailable".into());
        return false;
    };
    match audio.play(&track.path) {
        Ok(()) => {
            state.queue.playing = true;
            window.set_now_playing(format!("{} — {}", track.artist, track.title).into());
            window.set_playing(true);
            set_media_metadata(state, track);
            set_media_playback(state, true);
            true
        }
        Err(error) => {
            state.queue.playing = false;
            set_media_playback(state, false);
            window.set_playing(false);
            window.set_status(format!("Could not play track: {error}").into());
            false
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn set_media_metadata(state: &mut State, track: &Track) {
    if let Some(controls) = state.media_controls.as_mut() {
        let _ = controls.set_metadata(souvlaki::MediaMetadata {
            title: Some(&track.title),
            artist: Some(&track.artist),
            album: Some(&track.album),
            duration: track.duration_ms.map(Duration::from_millis),
            ..Default::default()
        });
    }
}
#[cfg(target_os = "windows")]
fn set_media_metadata(_state: &mut State, _track: &Track) {}

#[cfg(not(target_os = "windows"))]
fn set_media_playback(state: &mut State, playing: bool) {
    if let Some(controls) = state.media_controls.as_mut() {
        let playback = if playing {
            souvlaki::MediaPlayback::Playing { progress: None }
        } else {
            souvlaki::MediaPlayback::Paused { progress: None }
        };
        let _ = controls.set_playback(playback);
    }
}
#[cfg(target_os = "windows")]
fn set_media_playback(_state: &mut State, _playing: bool) {}

fn refresh(window: &AppWindow, state: &State) {
    let items: Vec<SharedString> = state
        .library
        .tracks
        .iter()
        .enumerate()
        .map(|(index, track)| {
            format!(
                "{:>3}  {} — {}  [{}]",
                index + 1,
                track.artist,
                track.title,
                track.album
            )
            .into()
        })
        .collect();
    window.set_track_items(ModelRc::new(VecModel::from(items)));
    window.set_theme_name(state.themes[state.theme_index].name.clone().into());
    window.set_show_library(
        state
            .layout
            .panels
            .iter()
            .find(|panel| panel.id == "Library")
            .map(|panel| panel.visible)
            .unwrap_or(true),
    );
    window.set_show_queue(
        state
            .layout
            .panels
            .iter()
            .find(|panel| panel.id == "Queue")
            .map(|panel| panel.visible)
            .unwrap_or(true),
    );
    if state.library.tracks.is_empty() {
        window.set_status("No MP3s scanned yet".into());
    }
}

fn apply_theme(window: &AppWindow, theme: &Theme) {
    let color = |value: &str| {
        let bits = u32::from_str_radix(&value[1..], 16).unwrap_or(0);
        slint::Color::from_rgb_u8((bits >> 16) as u8, (bits >> 8) as u8, bits as u8)
    };
    window.set_background_color(color(&theme.colors.background));
    window.set_surface_color(color(&theme.colors.surface));
    window.set_text_color(color(&theme.colors.text));
    window.set_accent_color(color(&theme.colors.accent));
    window.set_border_color(color(&theme.colors.border));
}
