import {
  createInitialPlaybackState,
  reducePlayback,
  type PlaybackAdapter,
  type PlaybackState,
  type TrackRecord,
  type Unsubscribe
} from "@ahoy/player-core";
import { browserFileUrl } from "./browser-media-store";

/** Real browser audio for imported files persisted in the browser media store. */
export class BrowserAudioPlaybackAdapter implements PlaybackAdapter {
  private readonly audio = new Audio();
  private state = createInitialPlaybackState();
  private readonly listeners = new Set<(state: PlaybackState) => void>();

  constructor() {
    this.audio.preload = "metadata";
    this.audio.addEventListener("timeupdate", () => {
      this.update(reducePlayback(this.state, { type: "seek", positionMs: Math.round(this.audio.currentTime * 1_000) }));
    });
    this.audio.addEventListener("loadedmetadata", () => {
      this.update({ ...this.state, durationMs: Number.isFinite(this.audio.duration) ? Math.round(this.audio.duration * 1_000) : this.state.durationMs });
    });
    this.audio.addEventListener("ended", () => this.update({ ...this.state, status: "paused", positionMs: 0 }));
    this.audio.addEventListener("error", () => this.update(reducePlayback(this.state, { type: "set-error", message: "The browser could not play this file." })));
  }

  async load(track: TrackRecord): Promise<void> {
    if (track.source.kind !== "local-file") {
      this.update(reducePlayback(this.state, { type: "set-error", message: "This purchase is not available in the web player yet." }));
      return;
    }
    const source = await browserFileUrl(track.source.locator);
    if (!source) {
      this.update(reducePlayback(this.state, { type: "set-error", message: "This browser no longer has the imported file." }));
      return;
    }
    this.audio.src = source;
    this.audio.load();
    this.update(reducePlayback(this.state, { type: "load", trackId: track.id }));
  }

  async play(): Promise<void> {
    await this.audio.play();
    this.update(reducePlayback(this.state, { type: "play" }));
  }

  async pause(): Promise<void> {
    this.audio.pause();
    this.update(reducePlayback(this.state, { type: "pause" }));
  }

  async seek(positionMs: number): Promise<void> {
    if (Number.isFinite(this.audio.duration)) this.audio.currentTime = positionMs / 1_000;
    this.update(reducePlayback(this.state, { type: "seek", positionMs }));
  }

  async setVolume(volume: number): Promise<void> {
    this.audio.volume = Math.min(1, Math.max(0, volume));
    this.update(reducePlayback(this.state, { type: "set-volume", volume }));
  }

  getState(): PlaybackState { return this.state; }

  subscribe(listener: (state: PlaybackState) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(state: PlaybackState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
