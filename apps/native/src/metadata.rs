use std::path::Path;

pub const UNKNOWN_ARTIST: &str = "Unknown Artist";
pub const LOCAL_IMPORTS: &str = "Local Imports";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Metadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub track_number: Option<u32>,
    pub used_path_fallback: bool,
}

/// Parses the same human-friendly filename forms supported by the former core.
pub fn fallback_metadata(filename: &str, relative_path: Option<&Path>) -> Metadata {
    let stem = filename.strip_suffix(".mp3").or_else(|| filename.strip_suffix(".MP3")).unwrap_or(filename);
    let mut stem = clean(stem);
    let mut track_number = None;
    if let Some((number, rest)) = split_number_prefix(&stem) {
        track_number = number.parse().ok();
        stem = rest.to_string();
    }
    let parts: Vec<String> = stem.split(" - ").map(clean).filter(|s| !s.is_empty()).collect();
    let (path_artist, path_album) = path_labels(relative_path);
    let mut used_path_fallback = false;
    let (title, artist, album) = match parts.len() {
        n if n >= 3 => (parts[n - 1].clone(), parts[0].clone(), parts[1..n - 1].join(" — ")),
        2 => {
            let album = path_album.unwrap_or_else(|| LOCAL_IMPORTS.to_string());
            used_path_fallback = album != LOCAL_IMPORTS;
            (parts[1].clone(), parts[0].clone(), album)
        }
        _ => {
            let artist = path_artist.unwrap_or_else(|| UNKNOWN_ARTIST.to_string());
            let album = path_album.unwrap_or_else(|| LOCAL_IMPORTS.to_string());
            used_path_fallback = artist != UNKNOWN_ARTIST || album != LOCAL_IMPORTS;
            (parts.first().cloned().unwrap_or_else(|| "Untitled".into()), artist, album)
        }
    };
    Metadata { title: nonempty(title, "Untitled"), artist: nonempty(artist, UNKNOWN_ARTIST), album: nonempty(album, LOCAL_IMPORTS), track_number, used_path_fallback }
}

fn split_number_prefix(value: &str) -> Option<(&str, &str)> {
    let (number, rest) = value.split_once(|c: char| c == ' ' || c == '-' || c == '_' || c == '.')?;
    if number.trim_matches(['[', ']']).chars().all(|c| c.is_ascii_digit()) { Some((number.trim_matches(['[', ']']), rest.trim_start_matches([' ', '-', '_', '.']))) } else { None }
}
fn clean(value: &str) -> String { value.replace('_', " ").split_whitespace().collect::<Vec<_>>().join(" ").trim_matches([' ', '-', '–', '—']).to_string() }
fn nonempty(value: String, default: &str) -> String { if value.trim().is_empty() { default.to_string() } else { value } }
fn path_labels(path: Option<&Path>) -> (Option<String>, Option<String>) {
    let Some(path) = path else { return (None, None) };
    let parts: Vec<String> = path.parent().into_iter().flat_map(|p| p.components()).filter_map(|c| c.as_os_str().to_str()).map(clean).filter(|p| !p.is_empty()).collect();
    let meaningful = |value: Option<&String>| value.filter(|x| !matches!(x.to_lowercase().as_str(), "music" | "downloads" | "download" | "audio" | "mp3" | "files")).cloned();
    (meaningful(parts.iter().rev().nth(1)), meaningful(parts.last()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn filename_and_folder_fallback() {
        let m = fallback_metadata("03 River.mp3", Some(Path::new("Music/Aster/First Light/03 River.mp3")));
        assert_eq!((m.artist.as_str(), m.album.as_str(), m.title.as_str(), m.track_number), ("Aster", "First Light", "River", Some(3)));
    }
    #[test] fn structured_filename_wins() { let m = fallback_metadata("Artist - Album - Song.mp3", None); assert_eq!((m.artist.as_str(), m.album.as_str(), m.title.as_str()), ("Artist", "Album", "Song")); }
}
