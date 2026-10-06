use anyhow::Result;
use rodio::{buffer::SamplesBuffer, Decoder, OutputStream, OutputStreamHandle, Sink};
use std::{f32::consts::TAU, fs::File, io::BufReader, path::Path};

pub struct AudioPlayer {
    _stream: OutputStream,
    handle: OutputStreamHandle,
    sink: Option<Sink>,
    note_sinks: Vec<Sink>,
    master_volume: f32,
    song_volume: f32,
    remix_volume: f32,
}

impl AudioPlayer {
    pub fn new() -> Result<Self> {
        let (stream, handle) = OutputStream::try_default()?;
        Ok(Self {
            _stream: stream,
            handle,
            sink: None,
            note_sinks: Vec::new(),
            master_volume: 1.0,
            song_volume: 1.0,
            remix_volume: 1.0,
        })
    }

    pub fn play(&mut self, path: &Path) -> Result<()> {
        self.stop();
        let sink = Sink::try_new(&self.handle)?;
        let source = Decoder::new(BufReader::new(File::open(path)?))?;
        sink.append(source);
        sink.set_volume(self.master_volume * self.song_volume);
        sink.play();
        self.sink = Some(sink);
        Ok(())
    }

    pub fn set_volume(&mut self, volume: f32) {
        self.master_volume = volume.clamp(0.0, 1.0);
        self.apply_song_volume();
        for sink in &self.note_sinks {
            sink.set_volume(self.master_volume * self.remix_volume);
        }
    }

    pub fn set_song_volume(&mut self, volume: f32) {
        self.song_volume = volume.clamp(0.0, 1.0);
        self.apply_song_volume();
    }

    pub fn set_remix_volume(&mut self, volume: f32) {
        self.remix_volume = volume.clamp(0.0, 1.0);
        for sink in &self.note_sinks {
            sink.set_volume(self.master_volume * self.remix_volume);
        }
    }

    pub fn play_remix_note(
        &mut self,
        index: usize,
        synth: bool,
        echo: bool,
        chorus: bool,
        lo_fi: bool,
    ) -> Result<()> {
        const NOTES: [f32; 8] = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
        const SAMPLE_RATE: u32 = 44_100;
        let Some(&frequency) = NOTES.get(index) else {
            return Ok(());
        };

        self.note_sinks.retain(|sink| !sink.empty());
        let dry_frames = (SAMPLE_RATE as f32 * 0.38) as usize;
        let delay = (SAMPLE_RATE as f32 * 0.13) as usize;
        let frames = dry_frames + if echo { delay * 3 } else { 0 };
        let mut samples = vec![0.0_f32; frames];

        for frame in 0..dry_frames {
            let t = frame as f32 / SAMPLE_RATE as f32;
            let attack = (t / 0.018).min(1.0);
            let release = ((0.38 - t) / 0.11).clamp(0.0, 1.0);
            let envelope = (attack * release).powf(1.15);
            let phase = TAU * frequency * t;
            let fundamental = phase.sin();
            let body = if synth {
                fundamental * 0.62 + (phase * 2.0).sin() * 0.23 + (phase * 3.0).sin() * 0.12
            } else {
                fundamental
            };
            let chorus_tone = if chorus {
                (TAU * (frequency * 1.006) * t).sin() * 0.22
            } else {
                0.0
            };
            let mut sample = (body + chorus_tone) * envelope * 0.24;
            if lo_fi {
                sample = (sample * 48.0).round() / 48.0;
            }
            samples[frame] = sample;
        }

        if echo {
            for frame in dry_frames..frames {
                let source = frame - delay;
                samples[frame] = samples[source] * 0.38;
            }
        }

        let sink = Sink::try_new(&self.handle)?;
        sink.set_volume(self.master_volume * self.remix_volume);
        sink.append(SamplesBuffer::new(1, SAMPLE_RATE, samples));
        self.note_sinks.push(sink);
        Ok(())
    }

    pub fn pause(&self) {
        if let Some(sink) = &self.sink {
            sink.pause();
        }
    }

    pub fn resume(&self) {
        if let Some(sink) = &self.sink {
            sink.play();
        }
    }

    pub fn is_finished(&self) -> bool {
        self.sink.as_ref().map(Sink::empty).unwrap_or(true)
    }

    pub fn stop(&mut self) {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
        for sink in self.note_sinks.drain(..) {
            sink.stop();
        }
    }

    fn apply_song_volume(&self) {
        if let Some(sink) = &self.sink {
            sink.set_volume(self.master_volume * self.song_volume);
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QueueState {
    pub queue: Vec<String>,
    pub index: Option<usize>,
    pub playing: bool,
    pub shuffle: bool,
    pub repeat: bool,
}

impl QueueState {
    pub fn new(queue: Vec<String>) -> Self {
        let index = (!queue.is_empty()).then_some(0);
        Self { queue, index, playing: false, shuffle: false, repeat: false }
    }

    pub fn next(&mut self) -> bool {
        let Some(index) = self.index else { return false };
        if self.queue.len() < 2 {
            if self.repeat && !self.queue.is_empty() {
                self.index = Some(0);
                return true;
            }
            return false;
        }
        if self.shuffle {
            let tick = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .subsec_nanos() as usize;
            let offset = 1 + tick % (self.queue.len() - 1);
            self.index = Some((index + offset) % self.queue.len());
            true
        } else if index + 1 < self.queue.len() {
            self.index = Some(index + 1);
            true
        } else if self.repeat {
            self.index = Some(0);
            true
        } else {
            false
        }
    }

    pub fn previous(&mut self) -> bool {
        if let Some(index) = self.index {
            if index > 0 {
                self.index = Some(index - 1);
                return true;
            } else if self.repeat && !self.queue.is_empty() {
                self.index = Some(self.queue.len() - 1);
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_navigation() {
        let mut q = QueueState::new(vec!["a".into(), "b".into()]);
        assert!(q.next());
        assert_eq!(q.index, Some(1));
        assert!(q.previous());
        assert_eq!(q.index, Some(0));
        q.repeat = true;
        assert!(q.previous());
        assert_eq!(q.index, Some(1));
    }
}
