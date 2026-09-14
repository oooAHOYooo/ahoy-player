use crate::metadata::{fallback_metadata, Metadata};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, path::{Path, PathBuf}};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Track { pub id: String, pub path: PathBuf, pub filename: String, pub title: String, pub artist: String, pub album: String, pub track_number: Option<u32>, pub fingerprint: String, pub duration_ms: Option<u64>, pub imported_at: String }
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct Library { pub schema_version: u32, pub tracks: Vec<Track> }
impl Library {
    pub fn load(path: &Path) -> Result<Self> { Ok(if path.exists() { serde_json::from_slice(&fs::read(path)?)? } else { Self { schema_version: 1, tracks: vec![] } }) }
    pub fn save(&self, path: &Path) -> Result<()> {
        if let Some(parent) = path.parent() { fs::create_dir_all(parent)?; }
        let temp = path.with_extension("json.tmp");
        fs::write(&temp, serde_json::to_vec_pretty(self)?)?;
        fs::rename(temp, path)?;
        Ok(())
    }
    pub fn import(&mut self, path: PathBuf) -> Result<ImportResult> {
        if path.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("mp3")) != Some(true) { return Ok(ImportResult::Rejected); }
        let fingerprint = sha256_file(&path)?;
        if self.tracks.iter().any(|track| track.fingerprint == fingerprint) { return Ok(ImportResult::Duplicate); }
        let filename = path.file_name().and_then(|x| x.to_str()).unwrap_or("Untitled.mp3").to_string();
        let meta = read_metadata(&path).unwrap_or_else(|| fallback_metadata(&filename, Some(&path)));
        let track = Track { id: format!("local:{}", &fingerprint[..24]), path, filename, title: meta.title, artist: meta.artist, album: meta.album, track_number: meta.track_number, fingerprint, duration_ms: None, imported_at: format!("{}", chrono_free_now()) };
        self.tracks.push(track); Ok(ImportResult::Imported)
    }
}
#[derive(Debug, PartialEq, Eq)] pub enum ImportResult { Imported, Duplicate, Rejected }
pub fn sha256_file(path: &Path) -> Result<String> { let bytes = fs::read(path)?; Ok(format!("{:x}", Sha256::digest(bytes))) }
fn chrono_free_now() -> String { format!("{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()) }
fn read_metadata(path: &Path) -> Option<Metadata> {
    use lofty::{prelude::{Accessor, TaggedFileExt}, read_from_path};
    let tagged = read_from_path(path).ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    let title = tag.title().map(|x| x.to_string()); let artist = tag.artist().map(|x| x.to_string()); let album = tag.album().map(|x| x.to_string());
    if title.is_none() && artist.is_none() && album.is_none() { return None; }
    let fallback = fallback_metadata(path.file_name()?.to_str()?, Some(path));
    Some(Metadata { title: title.unwrap_or(fallback.title), artist: artist.unwrap_or(fallback.artist), album: album.unwrap_or(fallback.album), track_number: tag.track(), used_path_fallback: false })
}
#[cfg(test)] mod tests { use super::*; #[test] fn duplicate_hashes_match() { let dir = std::env::temp_dir(); let a = dir.join("ahoy-a.mp3"); let b = dir.join("ahoy-b.mp3"); fs::write(&a, b"same").unwrap(); fs::write(&b, b"same").unwrap(); assert_eq!(sha256_file(&a).unwrap(), sha256_file(&b).unwrap()); let _ = fs::remove_file(a); let _ = fs::remove_file(b); } #[test] fn library_round_trip() { let p = std::env::temp_dir().join("ahoy-library-test.json"); let library = Library { schema_version: 1, tracks: vec![] }; library.save(&p).unwrap(); assert_eq!(Library::load(&p).unwrap(), library); let _ = fs::remove_file(p); } }
