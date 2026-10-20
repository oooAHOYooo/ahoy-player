use std::path::PathBuf;

pub const SUPPORTED_AUDIO_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "m4a", "aac", "opus",
];

pub fn pick_mp3s() -> Vec<PathBuf> {
    pick_audio_files()
}

pub fn pick_audio_files() -> Vec<PathBuf> {
    rfd::FileDialog::new()
        .add_filter("Audio files", SUPPORTED_AUDIO_EXTENSIONS)
        .pick_files()
        .unwrap_or_default()
}
