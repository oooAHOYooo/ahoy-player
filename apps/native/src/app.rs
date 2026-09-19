use crate::{audio::{AudioPlayer, QueueState}, files::pick_mp3s, layouts, library::{ImportResult, Library, Track}, themes::{self, Theme}};
use anyhow::Result;
use slint::{ComponentHandle, ModelRc, SharedString, VecModel};
use std::{cell::RefCell, path::PathBuf, rc::Rc};
slint::include_modules!();

struct State { library: Library, themes: Vec<Theme>, theme_index: usize, layout: layouts::Layout, audio: Option<AudioPlayer>, queue: QueueState, data_dir: PathBuf }

pub fn run() -> Result<()> {
    let data_dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from(".")).join("ahoy-player");
    let library = Library::load(&data_dir.join("library.json"))?;
    let themes = themes::load(&data_dir.join("themes.json"))?;
    let layout = layouts::load(&data_dir.join("layout.json"))?;
    let queue = QueueState::new(library.tracks.iter().map(|track| track.id.clone()).collect());
    let audio = AudioPlayer::new().ok();
    let audio_status = if audio.is_some() { "Ready" } else { "Audio output unavailable" };
    let state = Rc::new(RefCell::new(State { library, themes, theme_index: 0, layout, audio, queue, data_dir }));
    let window = AppWindow::new()?;
    refresh(&window, &state.borrow());
    window.set_status(audio_status.into());
    let initial_theme = state.borrow().themes[0].clone();
    apply_theme(&window, &initial_theme);

    let weak = window.as_weak(); let state_import = state.clone();
    window.on_import_files(move || { if let Some(window) = weak.upgrade() { let mut state = state_import.borrow_mut(); let mut imported = 0; let mut duplicates = 0; let mut failures = 0; for path in pick_mp3s() { match state.library.import(path) { Ok(ImportResult::Imported) => imported += 1, Ok(ImportResult::Duplicate) => duplicates += 1, Ok(ImportResult::Rejected) | Err(_) => failures += 1 } } if imported > 0 { state.queue = QueueState::new(state.library.tracks.iter().map(|track| track.id.clone()).collect()); if let Err(error) = state.library.save(&state.data_dir.join("library.json")) { window.set_status(format!("Could not save library: {error}").into()); } else { refresh(&window, &state); } } let message = if imported > 0 { format!("Scanned and added {imported} MP3(s); {duplicates} duplicate(s); {failures} failed") } else if duplicates > 0 { format!("No new MP3s; {duplicates} duplicate(s)") } else if failures > 0 { format!("Scan failed for {failures} file(s)") } else { "Scan cancelled".to_string() }; window.set_status(message.into()); } });

    let weak = window.as_weak(); let state_select = state.clone();
    window.on_select_track(move |index| { if let Some(window) = weak.upgrade() { let mut state = state_select.borrow_mut(); if let Some(track) = state.library.tracks.get(index as usize).cloned() { state.queue.index = Some(index as usize); if play_track(&mut state, &window, &track) { window.set_status("Playing".into()); } } } });

    let weak = window.as_weak(); let state_toggle = state.clone();
    window.on_toggle_play(move || { if let Some(window) = weak.upgrade() { let mut state = state_toggle.borrow_mut(); if state.queue.index.is_none() { window.set_status("Scan for MP3s first".into()); return; } state.queue.playing = !state.queue.playing; if let Some(audio) = &state.audio { if state.queue.playing { audio.resume(); } else { audio.pause(); } window.set_status(if state.queue.playing { "Playing" } else { "Paused" }.into()); } else { state.queue.playing = false; window.set_status("Audio output unavailable".into()); } window.set_playing(state.queue.playing); } });

    let weak = window.as_weak(); let state_next = state.clone(); window.on_next_track(move || advance(&weak, &state_next, true));
    let weak = window.as_weak(); let state_previous = state.clone(); window.on_previous_track(move || advance(&weak, &state_previous, false));

    let weak = window.as_weak(); let state_theme = state.clone();
    window.on_next_theme(move || { if let Some(window) = weak.upgrade() { let mut state = state_theme.borrow_mut(); state.theme_index = (state.theme_index + 1) % state.themes.len(); let theme = state.themes[state.theme_index].clone(); apply_theme(&window, &theme); window.set_theme_name(theme.name.into()); window.set_status("Theme changed".into()); } });

    let weak = window.as_weak(); let state_save = state.clone();
    window.on_save_theme(move || { if let Some(window) = weak.upgrade() { let state = state_save.borrow(); let status = match themes::save(&state.data_dir.join("themes.json"), &state.themes) { Ok(()) => "Theme saved", Err(_) => "Could not save theme" }; window.set_status(status.into()); } });

    let weak = window.as_weak(); let state_layout = state.clone();
    window.on_toggle_library(move || { if let Some(window) = weak.upgrade() { let mut state = state_layout.borrow_mut(); if let Some(panel) = state.layout.panels.iter_mut().find(|panel| panel.id == "Library") { panel.visible = !panel.visible; window.set_show_library(panel.visible); let status = if layouts::save(&state.data_dir.join("layout.json"), &state.layout).is_ok() { "Layout saved" } else { "Could not save layout" }; window.set_status(status.into()); } } });

    let weak = window.as_weak(); let state_queue_toggle = state.clone();
    window.on_toggle_queue(move || { if let Some(window) = weak.upgrade() { let mut state = state_queue_toggle.borrow_mut(); if let Some(panel) = state.layout.panels.iter_mut().find(|panel| panel.id == "Queue") { panel.visible = !panel.visible; window.set_show_queue(panel.visible); let status = if layouts::save(&state.data_dir.join("layout.json"), &state.layout).is_ok() { "Queue visibility saved" } else { "Could not save layout" }; window.set_status(status.into()); } } });

    let weak = window.as_weak(); let state_export = state.clone();
    window.on_export_theme(move || { if let Some(window) = weak.upgrade() { let state = state_export.borrow(); if let Some(path) = rfd::FileDialog::new().set_file_name("ahoy-theme.json").save_file() { let result = std::fs::write(path, serde_json::to_vec_pretty(&state.themes[state.theme_index]).unwrap_or_default()); window.set_status(if result.is_ok() { "Theme exported" } else { "Could not export theme" }.into()); } } });

    let weak = window.as_weak(); let state_import_theme = state.clone();
    window.on_import_theme(move || { if let Some(window) = weak.upgrade() { if let Some(path) = rfd::FileDialog::new().add_filter("Ahoy theme", &["json"]).pick_file() { match std::fs::read_to_string(path).ok().and_then(|text| themes::import_json(&text).ok()) { Some(theme) => { let mut state = state_import_theme.borrow_mut(); state.themes.push(theme.clone()); state.theme_index = state.themes.len() - 1; let _ = themes::save(&state.data_dir.join("themes.json"), &state.themes); apply_theme(&window, &theme); window.set_theme_name(theme.name.into()); window.set_status("Theme imported".into()); }, None => window.set_status("Invalid theme JSON".into()) } } } });

    window.run()?;
    Ok(())
}

fn advance(weak: &slint::Weak<AppWindow>, state: &Rc<RefCell<State>>, next: bool) { if let Some(window) = weak.upgrade() { let mut state = state.borrow_mut(); if next { state.queue.next(); } else { state.queue.previous(); } if let Some(index) = state.queue.index { if let Some(track) = state.library.tracks.get(index).cloned() { let _ = play_track(&mut state, &window, &track); } } else { window.set_status("No tracks in queue".into()); } } }

fn play_track(state: &mut State, window: &AppWindow, track: &Track) -> bool { let Some(audio) = &mut state.audio else { state.queue.playing = false; window.set_status("Audio output unavailable".into()); return false; }; match audio.play(&track.path) { Ok(()) => { state.queue.playing = true; window.set_now_playing(format!("{} — {}", track.artist, track.title).into()); window.set_playing(true); true }, Err(error) => { state.queue.playing = false; window.set_playing(false); window.set_status(format!("Could not play track: {error}").into()); false } } }

fn refresh(window: &AppWindow, state: &State) { let items: Vec<SharedString> = state.library.tracks.iter().enumerate().map(|(index, track)| format!("{:>3}  {} — {}  [{}]", index + 1, track.artist, track.title, track.album).into()).collect(); window.set_track_items(ModelRc::new(VecModel::from(items))); window.set_theme_name(state.themes[state.theme_index].name.clone().into()); window.set_show_library(state.layout.panels.iter().find(|panel| panel.id == "Library").map(|panel| panel.visible).unwrap_or(true)); window.set_show_queue(state.layout.panels.iter().find(|panel| panel.id == "Queue").map(|panel| panel.visible).unwrap_or(true)); if state.library.tracks.is_empty() { window.set_status("No MP3s scanned yet".into()); } }

fn apply_theme(window: &AppWindow, theme: &Theme) { let color = |value: &str| { let bits = u32::from_str_radix(&value[1..], 16).unwrap_or(0); slint::Color::from_rgb_u8((bits >> 16) as u8, (bits >> 8) as u8, bits as u8) }; window.set_background_color(color(&theme.colors.background)); window.set_surface_color(color(&theme.colors.surface)); window.set_text_color(color(&theme.colors.text)); window.set_accent_color(color(&theme.colors.accent)); window.set_border_color(color(&theme.colors.border)); }
