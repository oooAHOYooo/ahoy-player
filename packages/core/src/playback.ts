import type { PlaybackCommand, PlaybackState } from "./types";

export function createInitialPlaybackState(queue: string[] = []): PlaybackState {
  return {
    status: queue.length > 0 ? "paused" : "idle",
    currentTrackId: queue[0],
    queue,
    queueIndex: queue.length > 0 ? 0 : -1,
    positionMs: 0,
    volume: 0.82,
    repeat: "off"
  };
}

export function reducePlayback(state: PlaybackState, command: PlaybackCommand): PlaybackState {
  switch (command.type) {
    case "load": {
      const queue = command.queue?.length
        ? command.queue
        : state.queue.includes(command.trackId)
          ? state.queue
          : [command.trackId, ...state.queue];
      return {
        ...state,
        queue,
        queueIndex: Math.max(0, queue.indexOf(command.trackId)),
        currentTrackId: command.trackId,
        positionMs: 0,
        status: command.autoplay ? "playing" : "paused",
        error: undefined
      };
    }
    case "toggle":
      if (!state.currentTrackId) return state;
      return { ...state, status: state.status === "playing" ? "paused" : "playing" };
    case "play":
      return state.currentTrackId ? { ...state, status: "playing" } : state;
    case "pause":
      return state.currentTrackId ? { ...state, status: "paused" } : state;
    case "next":
      return moveInQueue(state, 1);
    case "previous":
      return state.positionMs > 5000 ? { ...state, positionMs: 0 } : moveInQueue(state, -1);
    case "seek":
      return { ...state, positionMs: Math.max(0, command.positionMs) };
    case "set-volume":
      return { ...state, volume: Math.min(1, Math.max(0, command.volume)) };
    case "set-error":
      return { ...state, status: "error", error: command.message };
  }
}

function moveInQueue(state: PlaybackState, offset: -1 | 1): PlaybackState {
  if (state.queue.length === 0) return state;
  let nextIndex = state.queueIndex + offset;
  if (nextIndex >= state.queue.length) nextIndex = state.repeat === "all" ? 0 : state.queue.length - 1;
  if (nextIndex < 0) nextIndex = state.repeat === "all" ? state.queue.length - 1 : 0;
  return {
    ...state,
    queueIndex: nextIndex,
    currentTrackId: state.queue[nextIndex],
    positionMs: 0,
    status: state.status === "idle" ? "paused" : state.status
  };
}
