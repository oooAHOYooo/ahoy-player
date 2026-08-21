import {
  createInitialPlaybackState,
  reducePlayback,
  type PlaybackAdapter,
  type PlaybackState,
  type TrackRecord,
  type Unsubscribe
} from "@ahoy/player-core";

/** Milestone adapter: state is real, audio I/O can be replaced without changing product logic. */
export class SimulatedPlaybackAdapter implements PlaybackAdapter {
  private state = createInitialPlaybackState();
  private readonly listeners = new Set<(state: PlaybackState) => void>();

  async load(track: TrackRecord): Promise<void> {
    this.update(reducePlayback(this.state, { type: "load", trackId: track.id }));
  }

  async play(): Promise<void> {
    this.update(reducePlayback(this.state, { type: "play" }));
  }

  async pause(): Promise<void> {
    this.update(reducePlayback(this.state, { type: "pause" }));
  }

  async seek(positionMs: number): Promise<void> {
    this.update(reducePlayback(this.state, { type: "seek", positionMs }));
  }

  async setVolume(volume: number): Promise<void> {
    this.update(reducePlayback(this.state, { type: "set-volume", volume }));
  }

  getState(): PlaybackState {
    return this.state;
  }

  subscribe(listener: (state: PlaybackState) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(state: PlaybackState) {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }
}
