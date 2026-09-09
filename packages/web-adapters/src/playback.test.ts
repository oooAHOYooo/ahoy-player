import { afterEach, describe, expect, it } from "vitest";
import { createInitialPlaybackState } from "@ahoy/player-core";
import { BrowserAudioPlaybackAdapter } from "./browser-playback";
import { LocalStoragePersistenceAdapter } from "./local-storage";

class FakeAudio {
  currentTime = 0;
  duration = Number.NaN;
  preload = "";
  src = "";
  volume = 1;
  addEventListener() {}
  load() {}
  pause() {}
  async play() {}
}

afterEach(() => {
  delete (globalThis as { Audio?: unknown }).Audio;
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("browser playback", () => {
  it("invokes HTML audio when setting a clamped volume", async () => {
    (globalThis as { Audio: unknown }).Audio = FakeAudio;
    const adapter = new BrowserAudioPlaybackAdapter();

    await adapter.setVolume(1.5);

    expect(adapter.getState().volume).toBe(1);
  });
});

describe("local playback persistence", () => {
  it("restores the persisted volume", async () => {
    const values = new Map<string, string>();
    (globalThis as { localStorage: Storage }).localStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear(),
      key: () => null,
      length: 0
    };
    const persistence = new LocalStoragePersistenceAdapter("test-volume");
    const playback = { ...createInitialPlaybackState(), volume: 0.37 };
    const snapshot = {
      version: 1 as const,
      library: { schemaVersion: 1 as const, tracks: [], albums: [], artists: [], imports: [], updatedAt: "now" },
      playback,
      savedAt: "now"
    };

    await persistence.save(snapshot);

    expect((await persistence.load())?.playback.volume).toBe(0.37);
  });
});
