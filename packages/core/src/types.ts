export type TrackId = string;
export type ArtistId = string;
export type AlbumId = string;

export type LocalTrackSource = {
  kind: "local-file";
  /** Opaque to shared code. A native path, file handle key, or browser cache key. */
  locator: string;
  filename: string;
  byteSize: number;
  fingerprint?: string;
  duplicateKey: string;
};

export type PurchaseTrackSource = {
  kind: "ahoy-purchase";
  assetId: string;
  entitlementId: string;
  locator?: string;
};

export type TrackSource = LocalTrackSource | PurchaseTrackSource;

export type EmbeddedTrackMetadata = {
  source: "id3";
  title?: string;
  artistName?: string;
  albumTitle?: string;
  trackNumber?: number;
};

export type TrackRecord = {
  id: TrackId;
  title: string;
  artistId: ArtistId;
  artistName: string;
  albumId: AlbumId;
  albumTitle: string;
  trackNumber?: number;
  discNumber?: number;
  durationMs?: number;
  importedAt: string;
  source: TrackSource;
  displayMetadata: {
    /** Embedded ID3 tags are preferred; filename and folder labels fill any gaps. */
    policy: "embedded-tag" | "filename-only" | "path-fallback" | "purchase-manifest";
    originalFilename?: string;
  };
};

export type ArtistRecord = {
  id: ArtistId;
  name: string;
  trackIds: TrackId[];
  albumIds: AlbumId[];
};

export type AlbumRecord = {
  id: AlbumId;
  title: string;
  artistIds: ArtistId[];
  trackIds: TrackId[];
};

export type ImportReceipt = {
  id: string;
  startedAt: string;
  completedAt: string;
  requested: number;
  imported: number;
  duplicates: number;
  rejected: number;
};

export type LibraryRecord = {
  schemaVersion: 1;
  tracks: TrackRecord[];
  albums: AlbumRecord[];
  artists: ArtistRecord[];
  imports: ImportReceipt[];
  updatedAt: string;
};

export type ImportCandidate = {
  filename: string;
  sourceLocator: string;
  byteSize: number;
  modifiedAt?: string;
  mimeType?: string;
  /** A relative path can supply artist/album fallbacks without exposing it in UI. */
  relativePath?: string;
  /** Prefer a SHA-256 digest when the host can read bytes. */
  fingerprint?: string;
  /** Extracted locally by a host adapter; source files are never changed. */
  embeddedMetadata?: EmbeddedTrackMetadata;
  /** Measured locally while reading the media file. */
  durationMs?: number;
};

export type NormalizedTrackImport = {
  id: TrackId;
  filename: string;
  sourceLocator: string;
  title: string;
  artistName: string;
  albumTitle: string;
  trackNumber?: number;
  durationMs?: number;
  byteSize: number;
  fingerprint?: string;
  duplicateKey: string;
  importedAt: string;
  metadataPolicy: "embedded-tag" | "filename-only" | "path-fallback";
};

export type ImportDuplicate = {
  candidate: ImportCandidate;
  duplicateKey: string;
  existingTrackId?: TrackId;
  reason: "already-in-library" | "repeated-in-batch";
};

export type ImportRejection = {
  candidate: ImportCandidate;
  reason: "not-mp3" | "empty-file" | "invalid-name";
};

export type ImportBatchResult = {
  accepted: NormalizedTrackImport[];
  duplicates: ImportDuplicate[];
  rejected: ImportRejection[];
  receipt: ImportReceipt;
};

export type PlayerScreen = "home" | "library" | "artists" | "albums" | "imports" | "now-playing";

export type DialAction =
  | { type: "turn"; direction: -1 | 1; source?: InputSource }
  | { type: "menu"; source?: InputSource }
  | { type: "select"; source?: InputSource }
  | { type: "back"; source?: InputSource }
  | { type: "next"; source?: InputSource }
  | { type: "play"; source?: InputSource };

export type InputSource = "keyboard" | "pointer" | "touch" | "remote" | "gamepad" | "native";

export type NavigationState = {
  screen: PlayerScreen;
  focusIndex: number;
  history: PlayerScreen[];
};

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";
export type RepeatMode = "off" | "all" | "one";

export type PlaybackState = {
  status: PlaybackStatus;
  currentTrackId?: TrackId;
  queue: TrackId[];
  queueIndex: number;
  positionMs: number;
  durationMs?: number;
  volume: number;
  repeat: RepeatMode;
  error?: string;
};

export type PlaybackCommand =
  | { type: "load"; trackId: TrackId; queue?: TrackId[]; autoplay?: boolean }
  | { type: "toggle" }
  | { type: "play" }
  | { type: "pause" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "seek"; positionMs: number }
  | { type: "set-volume"; volume: number }
  | { type: "set-error"; message: string };

export type PlayerSnapshot = {
  version: 1;
  library: LibraryRecord;
  playback: PlaybackState;
  savedAt: string;
};

export type PurchaseEntitlement = {
  entitlementId: string;
  assetId: string;
  acquiredAt: string;
  downloadState: "remote" | "queued" | "available" | "failed";
};

export type PurchaseManifestTrack = {
  assetId: string;
  title: string;
  artist: string;
  album: string;
  durationMs?: number;
  checksum: string;
};
