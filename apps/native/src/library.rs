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
}
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Library {
    pub schema_version: u32,
    pub tracks: Vec<Track>,
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
        if path
            .extension()
            .and_then(|x| x.to_str())
            .map(|x| x.eq_ignore_ascii_case("mp3"))
            != Some(true)
        {
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
        let meta =
            read_metadata(&path).unwrap_or_else(|| fallback_metadata(&filename, Some(&path)));
        let duration_ms = lofty::read_from_path(&path)
            .ok()
            .map(|tagged| tagged.properties().duration().as_millis() as u64)
            .filter(|duration| *duration > 0);
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
        };
        self.tracks.push(track);
        Ok(ImportResult::Imported)
    }
}
#[derive(Debug, PartialEq, Eq)]
pub enum ImportResult {
    Imported,
    Duplicate,
    Rejected,
}
pub fn sha256_file(path: &Path) -> Result<String> {
    let bytes = fs::read(path)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
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
fn read_metadata(path: &Path) -> Option<Metadata> {
    use lofty::{
        prelude::{Accessor, TaggedFileExt},
        read_from_path,
    };
    let tagged = read_from_path(path).ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    let title = tag.title().map(|x| x.to_string());
    let artist = tag.artist().map(|x| x.to_string());
    let album = tag.album().map(|x| x.to_string());
    if title.is_none() && artist.is_none() && album.is_none() {
        return None;
    }
    let fallback = fallback_metadata(path.file_name()?.to_str()?, Some(path));
    Some(Metadata {
        title: title.unwrap_or(fallback.title),
        artist: artist.unwrap_or(fallback.artist),
        album: album.unwrap_or(fallback.album),
        track_number: tag.track(),
        used_path_fallback: false,
    })
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
        };
        library.save(&p).unwrap();
        assert_eq!(Library::load(&p).unwrap(), library);
        let _ = fs::remove_file(p);
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
        };
        let revision = library.save_if_unchanged(&path, None).unwrap();
        fs::write(&path, b"external edit").unwrap();
        assert!(library.save_if_unchanged(&path, Some(revision)).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"external edit");
        let _ = fs::remove_file(path);
    }
}
