export type ColorVariable = {
  id: string;
  name: string;
  value: string;
};

export type WidgetItem = {
  id: string;
  title: string;
  duration: string;
};

export type AlbumCardData = {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverType:
    | "vinyl-beige"
    | "chart-teal"
    | "neon-mountain"
    | "vinyl-pink"
    | "waveform-teal"
    | "minimal-mint"
    | "vinyl-slate"
    | "vinyl-plum"
    | "target-black";
  displayLabel?: string;
  audioUrl?: string;
  durationMs?: number;
};

export type DockTabId =
  | "queue"
  | "lyrics"
  | "visualizer"
  | "dial"
  | "theme-studio"
  | "settings";

export type NavItemId =
  | "artists"
  | "albums-disc"
  | "albums-box"
  | "transitions"
  | "playlists"
  | "audio"
  | "top-playlists-1"
  | "top-playlists-2"
  | "recently-added-clock"
  | "recently-added-star"
  | "logout"
  | (string & {});

export type WorkspacePanelId =
  | "sidebar"
  | "grid"
  | "queue"
  | "visualizer"
  | "dial"
  | "theme-studio"
  | "lyrics";

export type WorkspaceColumnLayout = [
  WorkspacePanelId,
  WorkspacePanelId,
  WorkspacePanelId
];

export type NauticalTheme = {
  id: string;
  name: string;
  subtitle: string;
  colors: {
    background: string;
    surface: string;
    text: string;
    accent: string;
    border: string;
    deck: string;
  };
};

