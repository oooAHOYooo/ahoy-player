use std::path::PathBuf;
pub fn pick_mp3s() -> Vec<PathBuf> { rfd::FileDialog::new().add_filter("MP3 audio", &["mp3"]).pick_files().unwrap_or_default() }
