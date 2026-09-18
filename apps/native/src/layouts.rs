use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Panel {
    pub id: String,
    pub visible: bool,
    pub order: u32,
    #[serde(default)]
    pub column: u32, // 0: Left, 1: Center, 2: Right
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Layout {
    pub version: u32,
    pub panels: Vec<Panel>,
}

impl Default for Layout {
    fn default() -> Self {
        // 3-column default:
        // Col 0 (Left): Library (order 0)
        // Col 1 (Center): Artwork (0), Now Playing (1), Controls (2)
        // Col 2 (Right): Queue (0 - shows first!), Metadata (1)
        Self {
            version: 2,
            panels: vec![
                Panel { id: "Library".into(), visible: true, order: 0, column: 0 },
                Panel { id: "Artwork".into(), visible: true, order: 0, column: 1 },
                Panel { id: "Now Playing".into(), visible: true, order: 1, column: 1 },
                Panel { id: "Controls".into(), visible: true, order: 2, column: 1 },
                Panel { id: "Queue".into(), visible: true, order: 0, column: 2 },
                Panel { id: "Metadata".into(), visible: true, order: 1, column: 2 },
            ],
        }
    }
}

impl Layout {
    pub fn move_panel_to_column(&mut self, panel_id: &str, target_column: u32) {
        if let Some(panel) = self.panels.iter_mut().find(|p| p.id == panel_id) {
            panel.column = target_column % 3;
        }
    }

    pub fn panels_in_column(&self, col: u32) -> Vec<&Panel> {
        let mut list: Vec<&Panel> = self.panels.iter().filter(|p| p.column == col && p.visible).collect();
        list.sort_by_key(|p| p.order);
        list
    }
}

pub fn load(path: &Path) -> Result<Layout> {
    Ok(if path.exists() {
        serde_json::from_slice(&fs::read(path)?)?
    } else {
        Layout::default()
    })
}

pub fn save(path: &Path, layout: &Layout) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temp = path.with_extension("json.tmp");
    fs::write(&temp, serde_json::to_vec_pretty(layout)?)?;
    fs::rename(temp, path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_round_trip() {
        let p = std::env::temp_dir().join("ahoy-layout-test.json");
        let l = Layout::default();
        save(&p, &l).unwrap();
        assert_eq!(load(&p).unwrap(), l);
        let _ = fs::remove_file(p);
    }

    #[test]
    fn layout_three_columns_and_move() {
        let mut layout = Layout::default();
        // Queue should be in column 2 (Right) by default, showing first
        let right_panels = layout.panels_in_column(2);
        assert!(!right_panels.is_empty());
        assert_eq!(right_panels[0].id, "Queue");

        // Move Queue to Column 0 (Left)
        layout.move_panel_to_column("Queue", 0);
        let left_panels = layout.panels_in_column(0);
        assert!(left_panels.iter().any(|p| p.id == "Queue"));
    }
}
