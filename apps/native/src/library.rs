use crate::metadata::{fallback_metadata, Metadata};
use anyhow::{bail, Result};
use lofty::file::AudioFile;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

struct LibraryLock(PathBuf);
impl LibraryLock {
    fn acquire(path: &Path) -> Result<Self> {
        let lock_path = path.with_extension("json.lock");
        for _ in 0..20 {
            match fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&lock_path)
            {
                Ok(_) => return Ok(Self(lock_path)),
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                    thread::sleep(Duration::from_millis(50))
                }
                Err(error) => return Err(error.into()),
            }
        }
        bail!("Library is busy; retry after the other app finishes")
    }
}
impl Drop for LibraryLock {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.0);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub track_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Track {
    pub id: String,
    pub path: PathBuf,
    pub filename: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub track_number: Option<u32>,
    pub fingerprint: String,
    pub duration_ms: Option<u64>,
    pub imported_at: String,
    #[serde(default)]
    pub replay_gain_db: Option<f32>,
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Library {
    pub schema_version: u32,
    pub tracks: Vec<Track>,
    #[serde(default)]
    pub playlists: Vec<Playlist>,
}
impl Library {
    pub fn revision(path: &Path) -> Result<Option<String>> {
        match fs::read(path) {
            Ok(bytes) => Ok(Some(format!("{:x}", Sha256::digest(bytes)))),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error.into()),
        }
    }
    pub fn load(path: &Path) -> Result<Self> {
        Ok(if path.exists() {
            serde_json::from_slice(&fs::read(path)?)?
        } else {
            Self {
                schema_version: 1,
                tracks: vec![],
                playlists: vec![],
            }
        })
    }
    pub fn save(&self, path: &Path) -> Result<()> {
        self.save_if_unchanged(path, Self::revision(path)?)
            .map(|_| ())
    }
    pub fn save_if_unchanged(&self, path: &Path, expected: Option<String>) -> Result<String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let _lock = LibraryLock::acquire(path)?;
        if Self::revision(path)? != expected {
            bail!("Library changed in another app; reload before saving");
        }
        let bytes = serde_json::to_vec_pretty(self)?;
        let temp = path.with_extension(format!("json.{}.tmp", uuid::Uuid::new_v4()));
        let result = (|| -> Result<()> {
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temp)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            if Self::revision(path)? != expected {
                bail!("Library changed in another app; reload before saving");
            }
            fs::rename(&temp, path)?;
            Ok(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temp);
        }
        result?;
        Ok(format!("{:x}", Sha256::digest(bytes)))
    }
    pub fn import(&mut self, path: PathBuf) -> Result<ImportResult> {
        if !is_supported_audio(&path) {
            return Ok(ImportResult::Rejected);
        }
        let fingerprint = sha256_file(&path)?;
        if self
            .tracks
            .iter()
            .any(|track| track.fingerprint == fingerprint)
        {
            return Ok(ImportResult::Duplicate);
        }
        let filename = path
            .file_name()
            .and_then(|x| x.to_str())
            .unwrap_or("Untitled.mp3")
            .to_string();
        let (meta, duration_ms, replay_gain_db) = read_metadata_and_duration(&path);
        let track = Track {
            id: format!("local:{}", &fingerprint[..24]),
            path,
            filename,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            track_number: meta.track_number,
            fingerprint,
            duration_ms,
            imported_at: format!("{}", chrono_free_now()),
            replay_gain_db,
        };
        self.tracks.push(track);
        Ok(ImportResult::Imported)
    }

    pub fn create_playlist(&mut self, name: &str, track_ids: Vec<String>) -> Playlist {
        let id = format!("playlist:{}", uuid::Uuid::new_v4());
        let playlist = Playlist {
            id,
            name: name.trim().to_string(),
            track_ids,
        };
        self.playlists.push(playlist.clone());
        playlist
    }

    pub fn delete_playlist(&mut self, playlist_id: &str) -> bool {
        let len_before = self.playlists.len();
        self.playlists.retain(|p| p.id != playlist_id);
        self.playlists.len() < len_before
    }

    pub fn export_m3u8(&self, playlist_id: &str, target_path: &Path) -> Result<()> {
        let Some(pl) = self.playlists.iter().find(|p| p.id == playlist_id) else {
            bail!("Playlist not found");
        };
        let mut content = String::from("#EXTM3U\n");
        for track_id in &pl.track_ids {
            if let Some(track) = self.tracks.iter().find(|t| &t.id == track_id) {
                let secs = track.duration_ms.map(|d| (d / 1000) as i64).unwrap_or(-1);
                content.push_str(&format!("#EXTINF:{},{} - {}\n", secs, track.artist, track.title));
                content.push_str(&format!("{}\n", track.path.to_string_lossy()));
            }
        }
        fs::write(target_path, content)?;
        Ok(())
    }
}
#[derive(Debug, PartialEq, Eq)]
pub enum ImportResult {
    Imported,
    Duplicate,
    Rejected,
}

pub fn is_supported_audio(path: &Path) -> bool {
    let Some(ext) = path.extension().and_then(|x| x.to_str()) else {
        return false;
    };
    matches!(
        ext.to_ascii_lowercase().as_str(),
        "mp3" | "flac" | "wav" | "ogg" | "m4a" | "aac" | "opus"
    )
}

pub fn sha256_file(path: &Path) -> Result<String> {
    use std::io::Read;
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
fn chrono_free_now() -> String {
    format!(
        "{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    )
}
fn read_metadata_and_duration(path: &Path) -> (Metadata, Option<u64>, Option<f32>) {
    use lofty::{
        prelude::{Accessor, TaggedFileExt},
        read_from_path,
    };
    let filename = path
        .file_name()
        .and_then(|x| x.to_str())
        .unwrap_or("Untitled");
    let fallback = fallback_metadata(filename, Some(path));
    let Ok(tagged) = read_from_path(path) else {
        return (fallback, None, None);
    };
    let duration_ms = {
        let ms = tagged.properties().duration().as_millis() as u64;
        if ms > 0 {
            Some(ms)
        } else {
            None
        }
    };
    let Some(tag) = tagged.primary_tag().or_else(|| tagged.first_tag()) else {
        return (fallback, duration_ms, None);
    };
    let replay_gain_db = tag.items().find_map(|item| {
        let key_str = match item.key() {
            lofty::tag::ItemKey::ReplayGainTrackGain => "replaygain_track_gain",
            lofty::tag::ItemKey::Unknown(s) => s.as_str(),
            _ => "",
        };
        if key_str.eq_ignore_ascii_case("replaygain_track_gain")
            || key_str.eq_ignore_ascii_case("r128_track_gain")
        {
            item.value().text().and_then(|t| {
                let s = t
                    .trim()
                    .trim_end_matches(|c: char| c == 'd' || c == 'B' || c == 'b' || c == ' ')
                    .trim();
                s.parse::<f32>().ok()
            })
        } else {
            None
        }
    });
    let title = tag.title().map(|x| x.to_string());
    let artist = tag.artist().map(|x| x.to_string());
    let album = tag.album().map(|x| x.to_string());
    if title.is_none() && artist.is_none() && album.is_none() {
        return (fallback, duration_ms, replay_gain_db);
    }
    (
        Metadata {
            title: title.unwrap_or(fallback.title),
            artist: artist.unwrap_or(fallback.artist),
            album: album.unwrap_or(fallback.album),
            track_number: tag.track(),
            used_path_fallback: false,
        },
        duration_ms,
        replay_gain_db,
    )
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn duplicate_hashes_match() {
        let dir = std::env::temp_dir();
        let a = dir.join("ahoy-a.mp3");
        let b = dir.join("ahoy-b.mp3");
        fs::write(&a, b"same").unwrap();
        fs::write(&b, b"same").unwrap();
        assert_eq!(sha256_file(&a).unwrap(), sha256_file(&b).unwrap());
        let _ = fs::remove_file(a);
        let _ = fs::remove_file(b);
    }
    #[test]
    fn library_round_trip() {
        let p = std::env::temp_dir().join("ahoy-library-test.json");
        let library = Library {
            schema_version: 1,
            tracks: vec![],
            playlists: vec![],
        };
        library.save(&p).unwrap();
        assert_eq!(Library::load(&p).unwrap(), library);
        let _ = fs::remove_file(p);
    }
    #[test]
    fn supported_audio_formats() {
        for ext in &["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "MP3", "FLAC"] {
            let path = PathBuf::from(format!("track.{}", ext));
            assert!(is_supported_audio(&path), "Expected {} to be supported", ext);
        }
        assert!(!is_supported_audio(&PathBuf::from("video.mp4")));
        assert!(!is_supported_audio(&PathBuf::from("document.pdf")));
        assert!(!is_supported_audio(&PathBuf::from("noextension")));
    }
    #[test]
    fn playlist_creation_and_m3u8_export() {
        let mut library = Library::default();
        let track = Track {
            id: "local:123".into(),
            path: PathBuf::from("/music/song.mp3"),
            filename: "song.mp3".into(),
            title: "Song".into(),
            artist: "Artist".into(),
            album: "Album".into(),
            track_number: Some(1),
            fingerprint: "123".into(),
            duration_ms: Some(180_000),
            imported_at: "0".into(),
            replay_gain_db: Some(-3.0),
        };
        library.tracks.push(track);
        let pl = library.create_playlist("Favorites", vec!["local:123".into()]);
        assert_eq!(pl.name, "Favorites");
        assert_eq!(library.playlists.len(), 1);

        let out = std::env::temp_dir().join(format!("test-{}.m3u8", uuid::Uuid::new_v4()));
        library.export_m3u8(&pl.id, &out).unwrap();
        let content = fs::read_to_string(&out).unwrap();
        assert!(content.contains("#EXTM3U"));
        assert!(content.contains("#EXTINF:180,Artist - Song"));
        assert!(content.contains("/music/song.mp3"));
        let _ = fs::remove_file(out);
    }
}
#[cfg(test)]
mod revision_tests {
    use super::*;
    #[test]
    fn refuses_to_replace_a_library_changed_by_another_app() {
        let path = std::env::temp_dir().join(format!("ahoy-library-{}.json", uuid::Uuid::new_v4()));
        let library = Library {
            schema_version: 1,
            tracks: vec![],
            playlists: vec![],
        };
        let revision = library.save_if_unchanged(&path, None).unwrap();
        fs::write(&path, b"external edit").unwrap();
        assert!(library.save_if_unchanged(&path, Some(revision)).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external edit");
        let _ = fs::remove_file(path);
    }
}
