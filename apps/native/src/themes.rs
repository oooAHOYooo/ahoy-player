use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Theme {
    pub version: u32,
    pub name: String,
    pub colors: Colors,
    pub typography: Typography,
    pub spacing: u32,
    pub radius: u32,
    pub border_width: u32,
    pub shadow: String,
    pub artwork_style: String,
    pub control_style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Colors {
    pub background: String,
    pub surface: String,
    pub text: String,
    pub accent: String,
    pub border: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Typography {
    pub family: String,
    pub size: u32,
}

impl Theme {
    pub fn neutral() -> Self {
        Self {
            version: 1,
            name: "Neutral".into(),
            colors: Colors {
                background: "#f4f6f7".into(),
                surface: "#ffffff".into(),
                text: "#172126".into(),
                accent: "#197b78".into(),
                border: "#d9e1e3".into(),
            },
            typography: Typography {
                family: "Sans Serif".into(),
                size: 15,
            },
            spacing: 12,
            radius: 12,
            border_width: 1,
            shadow: "subtle".into(),
            artwork_style: "square".into(),
            control_style: "rounded".into(),
        }
    }
}

pub fn starters() -> Vec<Theme> {
    let n = Theme::neutral();

    // 3 Nautical Themes
    let mut deep_harbor = n.clone();
    deep_harbor.name = "Deep Harbor".into();
    deep_harbor.colors = Colors {
        background: "#0c1926".into(),
        surface: "#13263a".into(),
        text: "#e2f1f8".into(),
        accent: "#2dd4bf".into(),
        border: "#1e3b56".into(),
    };

    let mut captains_brass = n.clone();
    captains_brass.name = "Captain's Brass".into();
    captains_brass.colors = Colors {
        background: "#111b1d".into(),
        surface: "#1c2d30".into(),
        text: "#f4f0df".into(),
        accent: "#e5a93b".into(),
        border: "#2d464b".into(),
    };

    let mut sailors_warning = n.clone();
    sailors_warning.name = "Sailor's Warning".into();
    sailors_warning.colors = Colors {
        background: "#1c1219".into(),
        surface: "#2c1b26".into(),
        text: "#faedf2".into(),
        accent: "#f45866".into(),
        border: "#48293d".into(),
    };

    let mut winamp = n.clone();
    winamp.name = "Winamp-inspired".into();
    winamp.colors = Colors {
        background: "#18204a".into(),
        surface: "#37447c".into(),
        text: "#ffffff".into(),
        accent: "#f5b91d".into(),
        border: "#8ca0d8".into(),
    };

    let mut terminal = n.clone();
    terminal.name = "Terminal green".into();
    terminal.colors = Colors {
        background: "#051307".into(),
        surface: "#0d2811".into(),
        text: "#b5ffb9".into(),
        accent: "#42ee72".into(),
        border: "#298548".into(),
    };

    let mut mono = n.clone();
    mono.name = "Monochrome".into();
    mono.colors = Colors {
        background: "#1e1e1e".into(),
        surface: "#303030".into(),
        text: "#eeeeee".into(),
        accent: "#aaaaaa".into(),
        border: "#777777".into(),
    };

    let mut contrast = n;
    contrast.name = "High contrast".into();
    contrast.colors = Colors {
        background: "#000000".into(),
        surface: "#000000".into(),
        text: "#ffffff".into(),
        accent: "#ffff00".into(),
        border: "#ffffff".into(),
    };

    vec![
        deep_harbor,
        captains_brass,
        sailors_warning,
        Theme::neutral(),
        winamp,
        terminal,
        mono,
        contrast,
    ]
}

pub fn load(path: &Path) -> Result<Vec<Theme>> {
    Ok(if path.exists() {
        serde_json::from_slice(&fs::read(path)?)?
    } else {
        starters()
    })
}

pub fn save(path: &Path, themes: &[Theme]) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, serde_json::to_vec_pretty(themes)?)?;
    fs::rename(temp, path)?;
    Ok(())
}

pub fn import_json(input: &str) -> Result<Theme> {
    let theme: Theme = serde_json::from_str(input)?;
    validate(&theme)?;
    Ok(theme)
}

pub fn validate(theme: &Theme) -> Result<()> {
    if theme.version != 1 {
        bail!("unsupported theme version")
    }
    if theme.name.trim().is_empty() {
        bail!("theme name is required")
    }
    for color in [
        &theme.colors.background,
        &theme.colors.surface,
        &theme.colors.text,
        &theme.colors.accent,
        &theme.colors.border,
    ] {
        if !valid_color(color) {
            bail!("invalid color token: {color}")
        }
    }
    Ok(())
}

fn valid_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].chars().all(|c| c.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn import_and_export_are_validated() {
        let t = Theme::neutral();
        let json = serde_json::to_string(&t).unwrap();
        assert_eq!(import_json(&json).unwrap(), t);
        assert!(import_json(
            r##"{"version":1,"name":"bad","colors":{"background":"pink","surface":"#000000","text":"#000000","accent":"#000000","border":"#000000"},"typography":{"family":"x","size":1},"spacing":1,"radius":1,"border_width":1,"shadow":"x","artwork_style":"x","control_style":"x"}"##
        )
        .is_err());
    }

    #[test]
    fn theme_round_trip() {
        let p = std::env::temp_dir().join("ahoy-themes-test.json");
        save(&p, &starters()).unwrap();
        assert_eq!(load(&p).unwrap().len(), starters().len());
        let _ = fs::remove_file(p);
    }
}
