use anyhow::Result;
use rodio::{buffer::SamplesBuffer, Decoder, OutputStream, OutputStreamHandle, Sink};
use std::{f32::consts::TAU, fs::File, io::BufReader, path::{Path, PathBuf}, time::Duration};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum EqPreset {
    #[default]
    Flat,
    BassBoost,
    TrebleBoost,
    Vocal,
    Acoustic,
}

impl EqPreset {
    pub fn name(&self) -> &'static str {
        match self {
            EqPreset::Flat => "Flat",
            EqPreset::BassBoost => "Bass Boost",
            EqPreset::TrebleBoost => "Treble Boost",
            EqPreset::Vocal => "Vocal",
            EqPreset::Acoustic => "Acoustic",
        }
    }

    pub fn next(&self) -> Self {
        match self {
            EqPreset::Flat => EqPreset::BassBoost,
            EqPreset::BassBoost => EqPreset::TrebleBoost,
            EqPreset::TrebleBoost => EqPreset::Vocal,
            EqPreset::Vocal => EqPreset::Acoustic,
            EqPreset::Acoustic => EqPreset::Flat,
        }
    }

    pub fn gain_multiplier(&self) -> f32 {
        match self {
            EqPreset::Flat => 1.0,
            EqPreset::BassBoost => 1.15,
            EqPreset::TrebleBoost => 1.08,
            EqPreset::Vocal => 1.10,
            EqPreset::Acoustic => 1.05,
        }
    }
}

pub struct AudioPlayer {
    _stream: OutputStream,
    handle: OutputStreamHandle,
    sink: Option<Sink>,
    next_sink: Option<(PathBuf, Sink)>,
    note_sinks: Vec<Sink>,
    master_volume: f32,
    song_volume: f32,
    remix_volume: f32,
    replay_gain_multiplier: f32,
    pub eq_preset: EqPreset,
}

impl AudioPlayer {
    pub fn new() -> Result<Self> {
        let (stream, handle) = OutputStream::try_default()?;
        Ok(Self {
            _stream: stream,
            handle,
            sink: None,
            next_sink: None,
            note_sinks: Vec::new(),
            master_volume: 1.0,
            song_volume: 1.0,
            remix_volume: 1.0,
            replay_gain_multiplier: 1.0,
            eq_preset: EqPreset::default(),
        })
    }

    pub fn play(&mut self, path: &Path) -> Result<()> {
        self.play_with_options(path, None)
    }

    pub fn play_with_options(&mut self, path: &Path, replay_gain_db: Option<f32>) -> Result<()> {
        if let Some((preloaded_path, sink)) = self.next_sink.take() {
            if preloaded_path == path {
                self.stop_primary();
                self.replay_gain_multiplier = replay_gain_db
                    .map(|db| 10.0f32.powf(db / 20.0))
                    .unwrap_or(1.0)
                    .clamp(0.1, 2.5);
                self.apply_song_volume_to_sink(&sink);
                sink.play();
                self.sink = Some(sink);
                return Ok(());
            }
        }
        self.stop();
        let sink = Sink::try_new(&self.handle)?;
        let source = Decoder::new(BufReader::new(File::open(path)?))?;
        sink.append(source);
        self.replay_gain_multiplier = replay_gain_db
            .map(|db| 10.0f32.powf(db / 20.0))
            .unwrap_or(1.0)
            .clamp(0.1, 2.5);
        self.apply_song_volume_to_sink(&sink);
        sink.play();
        self.sink = Some(sink);
        Ok(())
    }

    pub fn preload_next(&mut self, path: &Path) {
        if let Ok(sink) = Sink::try_new(&self.handle) {
            if let Ok(file) = File::open(path) {
                if let Ok(source) = Decoder::new(BufReader::new(file)) {
                    sink.pause();
                    sink.append(source);
                    self.apply_song_volume_to_sink(&sink);
                    self.next_sink = Some((path.to_path_buf(), sink));
                }
            }
        }
    }

    pub fn set_eq_preset(&mut self, preset: EqPreset) {
        self.eq_preset = preset;
        self.apply_song_volume();
    }

    pub fn cycle_eq_preset(&mut self) -> &'static str {
        self.eq_preset = self.eq_preset.next();
        self.apply_song_volume();
        self.eq_preset.name()
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

    pub fn has_track(&self) -> bool {
        self.sink.is_some()
    }

    pub fn position(&self) -> Duration {
        self.sink.as_ref().map(Sink::get_pos).unwrap_or_default()
    }

    pub fn seek(&self, position: Duration) -> Result<()> {
        if let Some(sink) = &self.sink {
            sink.try_seek(position)
                .map_err(|error| anyhow::anyhow!(error.to_string()))?;
        }
        Ok(())
    }

    pub fn stop_primary(&mut self) {
        if let Some(sink) = self.sink.take() {
            sink.stop();
        }
    }

    pub fn stop(&mut self) {
        self.stop_primary();
        if let Some((_, sink)) = self.next_sink.take() {
            sink.stop();
        }
        for sink in self.note_sinks.drain(..) {
            sink.stop();
        }
    }

    fn apply_song_volume(&self) {
        if let Some(sink) = &self.sink {
            self.apply_song_volume_to_sink(sink);
        }
        if let Some((_, sink)) = &self.next_sink {
            self.apply_song_volume_to_sink(sink);
        }
    }

    fn apply_song_volume_to_sink(&self, sink: &Sink) {
        let eq_factor = self.eq_preset.gain_multiplier();
        sink.set_volume(
            (self.master_volume * self.song_volume * self.replay_gain_multiplier * eq_factor)
                .clamp(0.0, 2.0),
        );
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
        Self {
            queue,
            index,
            playing: false,
            shuffle: false,
            repeat: false,
        }
    }

    pub fn move_track(&mut self, from: usize, to: usize) {
        if from < self.queue.len() && to < self.queue.len() && from != to {
            let item = self.queue.remove(from);
            self.queue.insert(to, item);
            if let Some(cur) = self.index {
                if cur == from {
                    self.index = Some(to);
                } else if from < cur && to >= cur {
                    self.index = Some(cur - 1);
                } else if from > cur && to <= cur {
                    self.index = Some(cur + 1);
                }
            }
        }
    }

    pub fn remove_track(&mut self, index: usize) -> Option<String> {
        if index < self.queue.len() {
            let removed = self.queue.remove(index);
            if let Some(cur) = self.index {
                if cur == index {
                    if self.queue.is_empty() {
                        self.index = None;
                    } else if cur >= self.queue.len() {
                        self.index = Some(self.queue.len() - 1);
                    }
                } else if cur > index {
                    self.index = Some(cur - 1);
                }
            }
            Some(removed)
        } else {
            None
        }
    }

    pub fn clear(&mut self) {
        self.queue.clear();
        self.index = None;
        self.playing = false;
    }

    pub fn next(&mut self) -> bool {
        let Some(index) = self.index else {
            return false;
        };
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
