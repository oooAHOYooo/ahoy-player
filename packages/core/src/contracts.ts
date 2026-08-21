import type {
  DialAction,
  ImportCandidate,
  PlaybackState,
  PlayerSnapshot,
  PurchaseEntitlement,
  PurchaseManifestTrack,
  TrackRecord
} from "./types";

export type Unsubscribe = () => void;

export interface InputAdapter {
  start(listener: (action: DialAction) => void): Unsubscribe;
}

export interface FileImportAdapter {
  readonly availability: "available" | "unavailable" | "permission-required";
  chooseMp3Files(): Promise<ImportCandidate[]>;
}

export interface PersistenceAdapter {
  load(): Promise<PlayerSnapshot | undefined>;
  save(snapshot: PlayerSnapshot): Promise<void>;
  clear(): Promise<void>;
  /** Optional host channel for keeping multiple windows on one player snapshot. */
  subscribe?(listener: (snapshot: PlayerSnapshot) => void): Unsubscribe;
}

export interface PlaybackAdapter {
  load(track: TrackRecord): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getState(): PlaybackState;
  subscribe(listener: (state: PlaybackState) => void): Unsubscribe;
}

/** Future app.ahoy.ooo integration. Local library code does not depend on it. */
export interface PurchaseSyncAdapter {
  readonly availability: "available" | "offline" | "not-configured";
  listEntitlements(): Promise<PurchaseEntitlement[]>;
  getManifest(entitlement: PurchaseEntitlement): Promise<PurchaseManifestTrack>;
  download(entitlement: PurchaseEntitlement): Promise<{ locator: string; fingerprint: string }>;
}
