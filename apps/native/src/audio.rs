use anyhow::Result;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use std::{fs::File, io::BufReader, path::Path};
pub struct AudioPlayer { _stream: OutputStream, handle: OutputStreamHandle, sink: Option<Sink> }
impl AudioPlayer { pub fn new()->Result<Self>{let (stream,handle)=OutputStream::try_default()?;Ok(Self{_stream:stream,handle,sink:None})} pub fn play(&mut self,path:&Path)->Result<()> {self.stop();let sink=Sink::try_new(&self.handle)?;let source=Decoder::new(BufReader::new(File::open(path)?))?;sink.append(source);sink.play();self.sink=Some(sink);Ok(())} pub fn pause(&self){if let Some(s)=&self.sink{s.pause()}} pub fn resume(&self){if let Some(s)=&self.sink{s.play()}} pub fn stop(&mut self){if let Some(s)=self.sink.take(){s.stop()}} }
#[derive(Debug,Clone,PartialEq,Eq)] pub struct QueueState { pub queue:Vec<String>, pub index:Option<usize>, pub playing:bool }
impl QueueState { pub fn new(queue:Vec<String>)->Self{let index=(!queue.is_empty()).then_some(0);Self{queue,index,playing:false}} pub fn next(&mut self){if let Some(i)=self.index{if i+1<self.queue.len(){self.index=Some(i+1)}}} pub fn previous(&mut self){if let Some(i)=self.index{if i>0{self.index=Some(i-1)}}} }
#[cfg(test)] mod tests{use super::*;#[test]fn queue_navigation(){let mut q=QueueState::new(vec!["a".into(),"b".into()]);q.next();assert_eq!(q.index,Some(1));q.previous();assert_eq!(q.index,Some(0));}}
