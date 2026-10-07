use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

const RELEASES_API: &str =
    "https://api.github.com/repos/oooAHOYooo/ahoy-player/releases?per_page=30";
const RELEASES_PAGE: &str = "https://github.com/oooAHOYooo/ahoy-player/releases/latest";
const CACHE_TTL_SECS: u64 = 12 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub release_url: String,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    html_url: String,
    draft: bool,
    prerelease: bool,
    assets: Vec<ReleaseAsset>,
}

#[derive(Deserialize)]
struct ReleaseAsset {
    name: String,
}

#[derive(Serialize, Deserialize)]
struct UpdateCache {
    checked_at: u64,
    update: Option<UpdateInfo>,
}

pub fn check_for_update(data_dir: &Path, force: bool) -> Result<Option<UpdateInfo>> {
    let cache_path = data_dir.join("update-check.json");
    if !force {
        if let Some(cached) = read_cache(&cache_path) {
            return Ok(cached.update);
        }
    }
    let current = env!("CARGO_PKG_VERSION");
    let Some(target) = supported_asset_target() else {
        bail!("Automatic update checks are not supported for this platform yet.");
    };

    let output = Command::new("curl")
        .args([
            "--fail",
            "--silent",
            "--show-error",
            "--location",
            "--max-time",
            "8",
            "--header",
            "Accept: application/vnd.github+json",
            "--header",
            "User-Agent: Ahoy-Player-Update-Check",
            RELEASES_API,
        ])
        .output()
        .context("Could not start curl for the update check")?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        bail!(
            "Could not check GitHub Releases{}",
            if detail.is_empty() {
                String::new()
            } else {
                format!(": {detail}")
            }
        );
    }

    let releases: Vec<Release> = serde_json::from_slice(&output.stdout)
        .context("GitHub returned invalid release information")?;
    let mut found_compatible_release = false;
    for release in releases {
        let expected_asset = format!("ahoy-player-{}-{target}", release.tag_name);
        let has_asset = release.assets.iter().any(|asset| {
            asset.name == format!("{expected_asset}.tar.gz")
                || asset.name == format!("{expected_asset}.zip")
        });
        if release.draft || release.prerelease || !has_asset {
            continue;
        }
        found_compatible_release = true;
        if is_newer(&release.tag_name, current) {
            let info = UpdateInfo {
                version: release.tag_name.trim_start_matches('v').to_owned(),
                release_url: if release.html_url.is_empty() {
                    RELEASES_PAGE.to_owned()
                } else {
                    release.html_url
                },
            };
            write_cache(&cache_path, Some(&info));
            return Ok(Some(info));
        }
    }

    if found_compatible_release {
        write_cache(&cache_path, None);
        Ok(None)
    } else {
        bail!("No compatible Ahoy Player build is published for this platform yet.");
    }
}

fn read_cache(path: &Path) -> Option<UpdateCache> {
    let cache: UpdateCache = serde_json::from_slice(&std::fs::read(path).ok()?).ok()?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    (now.saturating_sub(cache.checked_at) < CACHE_TTL_SECS).then_some(cache)
}

fn write_cache(path: &Path, update: Option<&UpdateInfo>) {
    let Ok(now) = SystemTime::now().duration_since(UNIX_EPOCH) else {
        return;
    };
    let cache = UpdateCache {
        checked_at: now.as_secs(),
        update: update.cloned(),
    };
    if let Ok(bytes) = serde_json::to_vec(&cache) {
        let _ = std::fs::create_dir_all(path.parent().unwrap_or_else(|| Path::new(".")));
        let temp_path = path.with_extension("json.tmp");
        if std::fs::write(&temp_path, bytes).is_ok() {
            let _ = std::fs::rename(temp_path, path);
        }
    }
}

fn supported_asset_target() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => Some("linux-x86_64"),
        ("macos", "aarch64") => Some("mac-arm64"),
        ("macos", "x86_64") => Some("mac-x86_64"),
        _ => None,
    }
}

fn is_newer(tag: &str, current: &str) -> bool {
    let parse = |value: &str| -> Option<Vec<u64>> {
        let value = value.strip_prefix('v').unwrap_or(value);
        value.split('.').map(|part| part.parse().ok()).collect()
    };
    match (parse(tag), parse(current)) {
        (Some(latest), Some(installed)) => latest > installed,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::{is_newer, read_cache, write_cache, UpdateInfo};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn compares_release_versions_numerically() {
        assert!(is_newer("v0.2.10", "0.2.9"));
        assert!(is_newer("v1.0.0", "0.9.99"));
        assert!(!is_newer("v0.2.2", "0.2.2"));
        assert!(!is_newer("v0.2.1", "0.2.2"));
        assert!(!is_newer("v0.2.3-rc.1", "0.2.2"));
    }

    #[test]
    fn caches_update_and_up_to_date_results() {
        let path = std::env::temp_dir().join(format!(
            "ahoy-update-cache-{}.json",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let update = UpdateInfo {
            version: "0.3.0".into(),
            release_url: "https://example.com/release".into(),
        };
        write_cache(&path, Some(&update));
        assert_eq!(
            read_cache(&path)
                .and_then(|cache| cache.update)
                .map(|info| info.version),
            Some("0.3.0".into())
        );
        write_cache(&path, None);
        assert!(read_cache(&path).is_some_and(|cache| cache.update.is_none()));
        let _ = std::fs::remove_file(path);
    }
}
