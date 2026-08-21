import type { DialAction, InputSource, NavigationState, PlayerScreen } from "./types";

export const playerScreens: Exclude<PlayerScreen, "home">[] = [
  "library",
  "artists",
  "albums",
  "imports",
  "now-playing"
];

export function createNavigationState(): NavigationState {
  return { screen: "home", focusIndex: 0, history: [] };
}

export function reduceNavigation(
  state: NavigationState,
  action: DialAction,
  itemCount: number,
  selectedScreen?: PlayerScreen
): NavigationState {
  switch (action.type) {
    case "turn":
      return { ...state, focusIndex: wrapIndex(state.focusIndex + action.direction, itemCount) };
    case "menu":
      return state.screen === "home"
        ? { ...state, focusIndex: 0 }
        : { screen: "home", focusIndex: 0, history: [...state.history, state.screen] };
    case "back": {
      const previous = state.history.at(-1) ?? "home";
      return { screen: previous, focusIndex: 0, history: state.history.slice(0, -1) };
    }
    case "select":
      if (!selectedScreen || selectedScreen === state.screen) return state;
      return {
        screen: selectedScreen,
        focusIndex: 0,
        history: [...state.history, state.screen]
      };
    case "next":
    case "play":
      return state;
  }
}

export function enterScreen(state: NavigationState, screen: PlayerScreen): NavigationState {
  if (screen === state.screen) return { ...state, focusIndex: 0 };
  return { screen, focusIndex: 0, history: [...state.history, state.screen] };
}

export function wrapIndex(index: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return ((index % itemCount) + itemCount) % itemCount;
}

export function mapKeyboardToDialAction(key: string, source: InputSource = "keyboard"): DialAction | undefined {
  switch (key) {
    case "ArrowUp":
    case "ArrowLeft":
      return { type: "turn", direction: -1, source };
    case "ArrowDown":
    case "ArrowRight":
      return { type: "turn", direction: 1, source };
    case "Enter":
      return { type: "select", source };
    case "Escape":
    case "Backspace":
      return { type: "back", source };
    case " ":
    case "MediaPlayPause":
      return { type: "play", source };
    case "MediaTrackNext":
    case "n":
    case "N":
      return { type: "next", source };
    case "m":
    case "M":
      return { type: "menu", source };
    default:
      return undefined;
  }
}
