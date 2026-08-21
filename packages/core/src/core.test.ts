import { describe, expect, it } from "vitest";
import {
  createInitialPlaybackState,
  createNavigationState,
  mapKeyboardToDialAction,
  reduceNavigation,
  reducePlayback
} from "./index";

describe("Ahoy Dial navigation", () => {
  it("maps keyboard and remote-style arrows to shared turn actions", () => {
    expect(mapKeyboardToDialAction("ArrowUp", "remote")).toEqual({
      type: "turn",
      direction: -1,
      source: "remote"
    });
    expect(mapKeyboardToDialAction("ArrowRight")).toEqual({
      type: "turn",
      direction: 1,
      source: "keyboard"
    });
  });

  it("wraps focus and preserves a back stack", () => {
    const start = createNavigationState();
    const wrapped = reduceNavigation(start, { type: "turn", direction: -1 }, 5);
    const entered = reduceNavigation(wrapped, { type: "select" }, 5, "now-playing");
    const backed = reduceNavigation(entered, { type: "back" }, 1);
    expect(wrapped.focusIndex).toBe(4);
    expect(entered.screen).toBe("now-playing");
    expect(backed.screen).toBe("home");
  });
});

describe("shared queue behavior", () => {
  it("loads, toggles, and advances without leaving the queue", () => {
    const initial = createInitialPlaybackState(["a", "b"]);
    const playing = reducePlayback(initial, { type: "toggle" });
    const next = reducePlayback(playing, { type: "next" });
    const clamped = reducePlayback(next, { type: "next" });
    expect(playing.status).toBe("playing");
    expect(next.currentTrackId).toBe("b");
    expect(clamped.currentTrackId).toBe("b");
  });
});
