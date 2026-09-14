use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::{fs,path::Path};
#[derive(Debug,Clone,Serialize,Deserialize,PartialEq)] pub struct Panel { pub id:String, pub visible:bool, pub order:u32 }
#[derive(Debug,Clone,Serialize,Deserialize,PartialEq)] pub struct Layout { pub version:u32, pub panels:Vec<Panel> }
impl Default for Layout { fn default()->Self { Self {version:1,panels:["Library","Now Playing","Queue","Controls","Metadata","Artwork"].into_iter().enumerate().map(|(order,id)|Panel{id:id.into(),visible:true,order:order as u32}).collect()} } }
pub fn load(path:&Path)->Result<Layout>{Ok(if path.exists(){serde_json::from_slice(&fs::read(path)?)?}else{Layout::default()})}
pub fn save(path:&Path, layout:&Layout)->Result<()> {if let Some(parent)=path.parent(){fs::create_dir_all(parent)?};let temp=path.with_extension("json.tmp");fs::write(&temp,serde_json::to_vec_pretty(layout)?)?;fs::rename(temp,path)?;Ok(())}
#[cfg(test)] mod tests {use super::*;#[test] fn layout_round_trip(){let p=std::env::temp_dir().join("ahoy-layout-test.json");let l=Layout::default();save(&p,&l).unwrap();assert_eq!(load(&p).unwrap(),l);let _=fs::remove_file(p);}}
