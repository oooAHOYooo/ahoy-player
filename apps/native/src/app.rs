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
use slint::{ComponentHandle, Image, ModelRc, SharedString, Timer, TimerMode, VecModel};
use std::{
    cell::RefCell, path::PathBuf, process::Command, rc::Rc, sync::mpsc::Receiver, time::Duration,
};
slint::include_modules!();

struct State {
    library: Library,
    library_revision: Option<String>,
    themes: Vec<Theme>,
    theme_index: usize,
    layout: layouts::Layout,
    audio: Option<AudioPlayer>,
    queue: QueueState,
    library_view: usize,
    search_query: String,
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
    let library_path = data_dir.join("library.json");
    let library = Library::load(&library_path)?;
    let library_revision = Library::revision(&library_path)?;
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
        library_revision,
        themes,
        theme_index: 0,
        layout,
        audio,
        queue,
        library_view: 0,
        search_query: String::new(),
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
    window.set_playback_position(0.0);
    window.set_playback_duration(0.0);
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
    window.on_import_files(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_import.borrow_mut();
            let library_path = state.data_dir.join("library.json");
            if Library::revision(&library_path).ok() != Some(state.library_revision.clone()) {
                window.set_status(
                    "Library changed in another app. Reload before adding music.".into(),
                );
                return;
            }
            let mut imported = 0;
            let mut duplicates = 0;
            let mut failures = 0;
            for path in pick_mp3s() {
                match state.library.import(path) {
                    Ok(ImportResult::Imported) => imported += 1,
                    Ok(ImportResult::Duplicate) => duplicates += 1,
                    Ok(ImportResult::Rejected) | Err(_) => failures += 1,
                }
            }
            if imported > 0 {
                match state
                    .library
                    .save_if_unchanged(&library_path, state.library_revision.clone())
                {
                    Ok(revision) => {
                        state.library_revision = Some(revision);
                        state.queue = QueueState::new(
                            state
                                .library
                                .tracks
                                .iter()
                                .map(|track| track.id.clone())
                                .collect(),
                        );
                        refresh(&window, &state);
                    }
                    Err(error) => {
                        if let Ok(library) = Library::load(&library_path) {
                            state.library = library;
                        }
                        state.library_revision = Library::revision(&library_path).ok().flatten();
                        refresh(&window, &state);
                        window.set_status(format!("Import was not saved: {error}").into());
                        return;
                    }
                }
            }
            window.set_status(
                format!("Added {imported} MP3(s); {duplicates} duplicate(s); {failures} failed")
                    .into(),
            );
        }
    });

    let weak = window.as_weak();
    let state_reload = state.clone();
    window.on_reload_library(move || {
        if let Some(window) = weak.upgrade() {
            let mut state = state_reload.borrow_mut();
            let path = state.data_dir.join("library.json");
            match Library::load(&path) {
                Ok(library) => {
                    if let Some(audio) = &mut state.audio {
                        audio.stop();
                    }
                    state.library = library;
                    state.library_revision = Library::revision(&path).ok().flatten();
                    state.queue = QueueState::new(
                        state
                            .library
                            .tracks
                            .iter()
                            .map(|track| track.id.clone())
                            .collect(),
                    );
                    set_media_playback(&mut state, false);
                    window.set_playing(false);
                    window.set_now_playing("Nothing queued".into());
                    window.set_now_title("Nothing queued".into());
                    window.set_now_artist("".into());
                    window.set_now_album("".into());
                    window.set_has_artwork(false);
                    window.set_current_track_id("".into());
                    window.set_alert("".into());
                    window.set_playback_position(0.0);
                    window.set_playback_duration(0.0);
                    window.set_playback_time("0:00 / 0:00".into());
                    refresh(&window, &state);
                    let missing = state
                        .library
                        .tracks
                        .iter()
                        .filter(|track| !track.path.is_file())
                        .count();
                    window.set_status(
                        format!(
                            "Library reloaded: {} tracks, {missing} missing files",
                            state.library.tracks.len()
                        )
                        .into(),
                    );
                }
                Err(error) => {
                    window.set_status(format!("Could not reload library: {error}").into())
                }
            }
        }
    });

    let weak = window.as_weak();
    let state_seek = state.clone();
    window.on_seek_to(move |seconds| {
        if let Some(window) = weak.upgrade() {
            let state = state_seek.borrow();
            let duration = state
                .queue
                .index
                .and_then(|index| state.library.tracks.get(index))
                .and_then(|track| track.duration_ms);
            if let (Some(audio), Some(duration)) = (&state.audio, duration) {
                let millis = ((seconds.max(0.0) as f64) * 1000.0) as u64;
                let position = Duration::from_millis(millis.min(duration));
                if audio.seek(position).is_ok() {
                    window.set_playback_position(position.as_secs_f32());
                }
            }
        }
    });

    let weak = window.as_weak();
    let state_select = state.clone();
    window.on_select_track(move |index| {
        if let Some(window) = weak.upgrade() {
            let mut state = state_select.borrow_mut();
            if let Some(actual_index) = visible_indices(&state).get(index as usize).copied() {
                let track = state.library.tracks[actual_index].clone();
                if let Some(pos) = state.queue.queue.iter().position(|id| id == &track.id) {
                    state.queue.index = Some(pos);
                } else {
                    state.queue.queue.push(track.id.clone());
                    state.queue.index = Some(state.queue.queue.len() - 1);
                }
                if play_track(&mut state, &window, &track) {
                    window.set_status("Playing".into());
                }
                refresh(&window, &state);
            }
        }
    });

    let weak = window.as_weak();
    let state_queue_select = state.clone();
    window.on_select_queue_track(move |index| {
        if let Some(window) = weak.upgrade() {
            let mut state = state_queue_select.borrow_mut();
            if let Some(track_id) = state.queue.queue.get(index as usize).cloned() {
                if let Some(track) = state.library.tracks.iter().find(|t| t.id == track_id).cloned() {
                    state.queue.index = Some(index as usize);
                    let _ = play_track(&mut state, &window, &track);
                }
            }
        }
    });

    let weak = window.as_weak();
    let state_search = state.clone();
    window.on_search_changed(move |query| {
        if let Some(window) = weak.upgrade() {
            let mut state = state_search.borrow_mut();
            state.search_query = query.to_string();
            window.set_search_query(query);
            window.set_keyboard_selected_index(0);
            refresh(&window, &state);
        }
    });

    let weak = window.as_weak();
    let state_view = state.clone();
    window.on_select_library_view(move |view| {
        if let Some(window) = weak.upgrade() {
            let mut state = state_view.borrow_mut();
            state.library_view = (view as usize).min(2);
            window.set_keyboard_selected_index(0);
            refresh(&window, &state);
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
            if !state
                .audio
                .as_ref()
                .map(AudioPlayer::has_track)
                .unwrap_or(false)
            {
                if let Some(track) = state
                    .queue
                    .index
                    .and_then(|index| state.library.tracks.get(index))
                    .cloned()
                {
                    let _ = play_track(&mut state, &window, &track);
                }
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

    let weak_eq = window.as_weak();
    let state_eq = state.clone();
    window.on_cycle_eq(move || {
        if let Some(window) = weak_eq.upgrade() {
            let mut state = state_eq.borrow_mut();
            if let Some(audio) = &mut state.audio {
                let name = audio.cycle_eq_preset();
                window.set_eq_name(name.into());
                window.set_status(format!("Equalizer: {name}").into());
            }
        }
    });

    let weak_clear = window.as_weak();
    let state_clear = state.clone();
    window.on_clear_queue(move || {
        if let Some(window) = weak_clear.upgrade() {
            let mut state = state_clear.borrow_mut();
            state.queue.clear();
            if let Some(audio) = &mut state.audio {
                audio.stop();
            }
            window.set_playing(false);
            window.set_current_track_id("".into());
            window.set_now_title("Queue cleared".into());
            window.set_now_artist("".into());
            window.set_now_album("".into());
            window.set_has_artwork(false);
            refresh(&window, &state);
        }
    });

    let weak_rm = window.as_weak();
    let state_rm = state.clone();
    window.on_remove_queue_track(move |index| {
        if let Some(window) = weak_rm.upgrade() {
            let mut state = state_rm.borrow_mut();
            state.queue.remove_track(index as usize);
            refresh(&window, &state);
        }
    });

    let weak_mv = window.as_weak();
    let state_mv = state.clone();
    window.on_move_queue_track(move |from, to| {
        if let Some(window) = weak_mv.upgrade() {
            let mut state = state_mv.borrow_mut();
            state.queue.move_track(from as usize, to as usize);
            refresh(&window, &state);
        }
    });

    let weak_pl = window.as_weak();
    let state_pl = state.clone();
    window.on_save_queue_as_playlist(move || {
        if let Some(window) = weak_pl.upgrade() {
            let mut state = state_pl.borrow_mut();
            if state.queue.queue.is_empty() {
                window.set_status("Queue is empty; add music first".into());
                return;
            }
            let name = format!("Playlist {}", state.library.playlists.len() + 1);
            let track_ids = state.queue.queue.clone();
            let _ = state.library.create_playlist(&name, track_ids);
            let lib_path = state.data_dir.join("library.json");
            let _ = state.library.save(&lib_path);
            window.set_status(format!("Saved {}", name).into());
            refresh(&window, &state);
        }
    });

    let weak_spl = window.as_weak();
    let state_spl = state.clone();
    window.on_select_playlist(move |index| {
        if let Some(window) = weak_spl.upgrade() {
            let mut state = state_spl.borrow_mut();
            if let Some(pl) = state.library.playlists.get(index as usize).cloned() {
                state.queue.queue = pl.track_ids;
                state.queue.index = if state.queue.queue.is_empty() { None } else { Some(0) };
                window.set_status(format!("Loaded {}", pl.name).into());
                refresh(&window, &state);
                if let Some(first_id) = state.queue.queue.first().cloned() {
                    if let Some(track) = state.library.tracks.iter().find(|t| t.id == first_id).cloned() {
                        let _ = play_track(&mut state, &window, &track);
                    }
                }
            }
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
        if let Some(window) = weak.upgrade() {
            let state = state_auto_advance.borrow();
            if let Some(audio) = &state.audio {
                if let Some(index) = state.queue.index {
                    let position = audio.position();
                    let duration = state
                        .library
                        .tracks
                        .get(index)
                        .and_then(|track| track.duration_ms)
                        .unwrap_or(0);
                    window.set_playback_position(position.as_secs_f32());
                    window.set_playback_duration(duration as f32 / 1000.0);
                    window.set_playback_time(
                        format!(
                            "{} / {}",
                            clock_label(position.as_secs()),
                            clock_label(duration / 1000)
                        )
                        .into(),
                    );
                }
            }
        }
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
                let track_opt = if let Some(track_id) = state.queue.queue.get(index) {
                    state.library.tracks.iter().find(|t| &t.id == track_id).cloned()
                } else {
                    state.library.tracks.get(index).cloned()
                };
                if let Some(track) = track_opt {
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
            window.set_current_track_id("".into());
            window.set_status("End of queue".into());
        }
    }
}

fn apply_playback_state(state: &mut State, window: &AppWindow, playing: bool) {
    if state.queue.index.is_none() {
        return;
    }
    if playing
        && !state
            .audio
            .as_ref()
            .map(AudioPlayer::has_track)
            .unwrap_or(false)
    {
        let track_opt = if let Some(track_id) = state.queue.index.and_then(|i| state.queue.queue.get(i)) {
            state.library.tracks.iter().find(|t| &t.id == track_id).cloned()
        } else {
            state.queue.index.and_then(|index| state.library.tracks.get(index)).cloned()
        };
        if let Some(track) = track_opt {
            let _ = play_track(state, window, &track);
        }
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
    match audio.play_with_options(&track.path, track.replay_gain_db) {
        Ok(()) => {
            if let Some(next_idx) = state.queue.index.map(|i| i + 1) {
                if let Some(next_id) = state.queue.queue.get(next_idx) {
                    if let Some(next_track) = state.library.tracks.iter().find(|t| &t.id == next_id) {
                        audio.preload_next(&next_track.path);
                    }
                }
            }
            window.set_playback_position(0.0);
            window.set_playback_duration(track.duration_ms.unwrap_or(0) as f32 / 1000.0);
            state.queue.playing = true;
            window.set_now_playing(format!("{} — {}", track.artist, track.title).into());
            window.set_now_title(track.title.clone().into());
            window.set_now_artist(track.artist.clone().into());
            window.set_now_album(track.album.clone().into());
            if let Some(image) = cover_image(track, &state.data_dir) {
                window.set_now_artwork(image);
                window.set_has_artwork(true);
            } else { window.set_has_artwork(false); }
            window.set_current_track_id(track.id.clone().into());
            window.set_alert("".into());
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
            window.set_alert(if track.path.is_file() {
                format!("Could not play {}: {error}. Check the audio output, then try again.", track.title)
            } else {
                format!("{} is missing. Restore the file at {} and reload the library.", track.title, track.path.display())
            }.into());
            false
        }
    }
}

fn clock_label(seconds: u64) -> String {
    format!("{}:{:02}", seconds / 60, seconds % 60)
}

fn cover_image(track: &Track, data_dir: &std::path::Path) -> Option<Image> {
    use lofty::prelude::TaggedFileExt;
    if let Ok(tagged) = lofty::read_from_path(&track.path) {
        if let Some(picture) = tagged.primary_tag().or_else(|| tagged.first_tag()).and_then(|tag| tag.pictures().first()) {
            let bytes = picture.data();
            if bytes.len() <= 10_000_000 {
                let extension = if bytes.starts_with(&[0xff, 0xd8, 0xff]) { "jpg" }
                    else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { "png" }
                    else { "" };
                if !extension.is_empty() {
                    let cache = data_dir.join("artwork-cache").join(format!("{}.{}", track.fingerprint, extension));
                    if !cache.exists() {
                        std::fs::create_dir_all(cache.parent()?).ok()?;
                        std::fs::write(&cache, bytes).ok()?;
                    }
                    if let Ok(image) = Image::load_from_path(&cache) { return Some(image); }
                }
            }
        }
    }
    let directory = track.path.parent()?;
    for name in ["cover.jpg", "cover.png", "folder.jpg", "folder.png"] {
        if let Ok(image) = Image::load_from_path(&directory.join(name)) { return Some(image); }
    }
    None
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
        let progress = state
            .audio
            .as_ref()
            .map(|a| souvlaki::MediaPosition(a.position()));
        let playback = if playing {
            souvlaki::MediaPlayback::Playing { progress }
        } else {
            souvlaki::MediaPlayback::Paused { progress }
        };
        let _ = controls.set_playback(playback);
    }
}
#[cfg(target_os = "windows")]
fn set_media_playback(_state: &mut State, _playing: bool) {}

fn visible_indices(state: &State) -> Vec<usize> {
    let query = state.search_query.trim().to_lowercase();
    let mut indices: Vec<usize> = state.library.tracks.iter().enumerate().filter_map(|(index, track)| {
        let matches = query.is_empty() || [&track.title, &track.artist, &track.album].iter().any(|field| field.to_lowercase().contains(&query));
        matches.then_some(index)
    }).collect();
    if state.library_view == 1 { indices.sort_by_key(|index| (state.library.tracks[*index].artist.to_lowercase(), state.library.tracks[*index].album.to_lowercase(), state.library.tracks[*index].title.to_lowercase())); }
    if state.library_view == 2 { indices.sort_by_key(|index| (state.library.tracks[*index].album.to_lowercase(), state.library.tracks[*index].artist.to_lowercase(), state.library.tracks[*index].title.to_lowercase())); }
    indices
}

fn track_label(track: &Track) -> SharedString {
    let duration = track
        .duration_ms
        .map(|ms| {
            let secs = ms / 1000;
            format!("  ·  {}:{:02}", secs / 60, secs % 60)
        })
        .unwrap_or_default();
    format!(
        "{} — {}  [{}{}]{}",
        track.artist,
        track.title,
        track.album,
        duration,
        if track.path.is_file() {
            ""
        } else {
            " · File missing"
        }
    )
    .into()
}

fn refresh(window: &AppWindow, state: &State) {
    let visible = visible_indices(state);
    let items: Vec<SharedString> = visible.iter().map(|index| track_label(&state.library.tracks[*index])).collect();
    let ids: Vec<SharedString> = visible.iter().map(|index| state.library.tracks[*index].id.clone().into()).collect();
    let queue_tracks: Vec<&Track> = state
        .queue
        .queue
        .iter()
        .filter_map(|id| state.library.tracks.iter().find(|t| &t.id == id))
        .collect();
    let queue_items: Vec<SharedString> = queue_tracks.iter().map(|t| track_label(t)).collect();
    let queue_ids: Vec<SharedString> = queue_tracks.iter().map(|track| track.id.clone().into()).collect();
    let playlist_names: Vec<SharedString> = state.library.playlists.iter().map(|p| p.name.clone().into()).collect();
    window.set_track_items(ModelRc::new(VecModel::from(items)));
    window.set_track_ids(ModelRc::new(VecModel::from(ids)));
    window.set_queue_items(ModelRc::new(VecModel::from(queue_items)));
    window.set_queue_ids(ModelRc::new(VecModel::from(queue_ids)));
    window.set_playlists(ModelRc::new(VecModel::from(playlist_names)));
    window.set_eq_name(state.audio.as_ref().map(|a| a.eq_preset.name()).unwrap_or("Flat").into());
    window.set_library_view(state.library_view as i32);
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
