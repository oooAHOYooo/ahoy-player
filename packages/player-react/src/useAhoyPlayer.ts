import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyLibrary,
  createInitialPlaybackState,
  createNavigationState,
  enterScreen,
  findTrack,
  mergeImportBatch,
  playerScreens,
  reduceNavigation,
  reducePlayback,
  trackIds,
  type DialAction,
  type FileImportAdapter,
  type ImportBatchResult,
  type LibraryRecord,
  type NavigationState,
  type PersistenceAdapter,
  type PlaybackAdapter,
  type PlaybackState,
  type PlayerScreen,
  type TrackRecord
} from "@ahoy/player-core";
import { runImportPipeline } from "@ahoy/player-media-pipeline";

export type PlayerListItem = {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  trackId?: string;
  screen?: PlayerScreen;
};

export type AhoyPlayerModel = {
  library: LibraryRecord;
  navigation: NavigationState;
  playback: PlaybackState;
  nowPlaying?: TrackRecord;
  items: PlayerListItem[];
  isHydrated: boolean;
  isImporting: boolean;
  lastImport?: ImportBatchResult;
  dispatchDial: (action: DialAction) => void;
  activate: (index: number) => void;
  openScreen: (screen: PlayerScreen) => void;
  importFiles: () => Promise<void>;
  togglePlayback: () => void;
  seek: (positionMs: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
};

export const screenLabels: Record<PlayerScreen, string> = {
  home: "Menu",
  library: "Library",
  artists: "Artists",
  albums: "Albums",
  imports: "Imports",
  "now-playing": "Now Playing"
};

export function useAhoyPlayer({
  initialLibrary,
  fileImport,
  persistence,
  playbackAdapter
}: {
  initialLibrary: LibraryRecord;
  fileImport?: FileImportAdapter;
  persistence?: PersistenceAdapter;
  playbackAdapter?: PlaybackAdapter;
}): AhoyPlayerModel {
  const [library, setLibrary] = useState(initialLibrary);
  const [navigation, setNavigation] = useState(createNavigationState);
  const [playback, setPlayback] = useState(() => createInitialPlaybackState(trackIds(initialLibrary)));
  const [lastImport, setLastImport] = useState<ImportBatchResult>();
  const [isImporting, setIsImporting] = useState(false);
  const [isHydrated, setIsHydrated] = useState(!persistence);
  const skipNextSave = useRef(false);

  useEffect(() => {
    if (!persistence) return;
    let active = true;
    void persistence.load().then((snapshot) => {
      if (!active) return;
      if (snapshot) {
        setLibrary(snapshot.library);
        setPlayback(snapshot.playback);
      }
      setIsHydrated(true);
    });
    return () => { active = false; };
  }, [persistence]);

  useEffect(() => {
    if (!persistence?.subscribe) return;
    return persistence.subscribe((snapshot) => {
      skipNextSave.current = true;
      setLibrary(snapshot.library);
      setPlayback(snapshot.playback);
    });
  }, [persistence]);

  useEffect(() => {
    if (!persistence || !isHydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    void persistence.save({ version: 1, library, playback, savedAt: new Date().toISOString() });
  }, [isHydrated, library, persistence, playback]);

  const nowPlaying = findTrack(library, playback.currentTrackId);
  const items = useMemo(
    () => getItemsForScreen(navigation.screen, library, nowPlaying),
    [library, navigation.screen, nowPlaying]
  );

  const playTrack = useCallback((trackId: string) => {
    const track = findTrack(library, trackId);
    if (!track) return;
    const queue = trackIds(library);
    setPlayback((current) => reducePlayback(current, { type: "load", trackId, queue, autoplay: true }));
    if (playbackAdapter) {
      void playbackAdapter.load(track).then(() => playbackAdapter.play());
    }
  }, [library, playbackAdapter]);

  const togglePlayback = useCallback(() => {
    setPlayback((current) => {
      const next = reducePlayback(current, { type: "toggle" });
      if (playbackAdapter) {
        void (next.status === "playing" ? playbackAdapter.play() : playbackAdapter.pause());
      }
      return next;
    });
  }, [playbackAdapter]);

  const seek = useCallback((positionMs: number) => {
    setPlayback((current) => {
      const next = reducePlayback(current, { type: "seek", positionMs });
      if (playbackAdapter) void playbackAdapter.seek(next.positionMs);
      return next;
    });
  }, [playbackAdapter]);

  const nextTrack = useCallback(() => {
    setPlayback((current) => {
      const next = reducePlayback(current, { type: "next" });
      const track = findTrack(library, next.currentTrackId);
      if (playbackAdapter && track && track.id !== current.currentTrackId) {
        void playbackAdapter.load(track).then(() => {
          if (current.status === "playing") return playbackAdapter.play();
        });
      }
      return next;
    });
  }, [library, playbackAdapter]);

  const previousTrack = useCallback(() => {
    setPlayback((current) => {
      const next = reducePlayback(current, { type: "previous" });
      const track = findTrack(library, next.currentTrackId);
      if (playbackAdapter && track && track.id !== current.currentTrackId) {
        void playbackAdapter.load(track).then(() => {
          if (current.status === "playing") return playbackAdapter.play();
        });
      }
      return next;
    });
  }, [library, playbackAdapter]);

  const selectAt = useCallback((index: number) => {
    const item = items[index];
    if (!item) return;
    if (navigation.screen === "home" && item.screen) {
      setNavigation((current) => reduceNavigation(current, { type: "select" }, items.length, item.screen));
      return;
    }
    if (item.trackId) {
      playTrack(item.trackId);
      return;
    }
    if (navigation.screen === "now-playing") togglePlayback();
  }, [items, navigation.screen, playTrack, togglePlayback]);

  const dispatchDial = useCallback((action: DialAction) => {
    if (action.type === "play") {
      togglePlayback();
      return;
    }
    if (action.type === "next") {
      nextTrack();
      return;
    }
    if (action.type === "select") {
      selectAt(navigation.focusIndex);
      return;
    }
    setNavigation((current) => reduceNavigation(current, action, items.length));
  }, [items.length, navigation.focusIndex, nextTrack, selectAt, togglePlayback]);

  const activate = useCallback((index: number) => {
    setNavigation((current) => ({ ...current, focusIndex: index }));
    selectAt(index);
  }, [selectAt]);

  const openScreen = useCallback((screen: PlayerScreen) => {
    setNavigation((current) => enterScreen(current, screen));
  }, []);

  const importFiles = useCallback(async () => {
    if (!fileImport || fileImport.availability !== "available") return;
    setIsImporting(true);
    try {
      const candidates = await fileImport.chooseMp3Files();
      if (candidates.length === 0) return;
      const seedOnly = library.tracks.length > 0 && library.tracks.every((track) =>
        track.source.kind === "local-file" && track.source.locator.startsWith("/demo/")
      );
      const baseLibrary = seedOnly ? createEmptyLibrary() : library;
      const batch = runImportPipeline(candidates, baseLibrary);
      const nextLibrary = mergeImportBatch(baseLibrary, batch);
      setLastImport(batch);
      setLibrary(nextLibrary);
      const queue = trackIds(nextLibrary);
      setPlayback((current) => {
        if (batch.accepted.length > 0 && (seedOnly || !current.currentTrackId)) {
          return createInitialPlaybackState(queue);
        }
        const queueIndex = Math.max(0, queue.indexOf(current.currentTrackId ?? ""));
        return { ...current, queue, queueIndex };
      });
      setNavigation((current) => enterScreen(current, "imports"));
    } finally {
      setIsImporting(false);
    }
  }, [fileImport, library]);

  return {
    library,
    navigation,
    playback,
    nowPlaying,
    items,
    isHydrated,
    isImporting,
    lastImport,
    dispatchDial,
    activate,
    openScreen,
    importFiles,
    togglePlayback,
    seek,
    nextTrack,
    previousTrack
  };
}

function getItemsForScreen(
  screen: PlayerScreen,
  library: LibraryRecord,
  nowPlaying?: TrackRecord
): PlayerListItem[] {
  if (screen === "home") {
    return playerScreens.map((target) => ({
      id: target,
      primary: screenLabels[target],
      secondary: countForScreen(target, library),
      screen: target
    }));
  }
  if (screen === "library") {
    return library.tracks.map((track, index) => ({
      id: track.id,
      primary: track.title,
      secondary: `${track.artistName} · ${track.albumTitle}`,
      meta: String(track.trackNumber ?? index + 1).padStart(2, "0"),
      trackId: track.id
    }));
  }
  if (screen === "artists") {
    return library.artists.map((artist) => ({
      id: artist.id,
      primary: artist.name,
      secondary: `${artist.albumIds.length} ${artist.albumIds.length === 1 ? "album" : "albums"}`,
      meta: String(artist.trackIds.length).padStart(2, "0"),
      trackId: artist.trackIds[0]
    }));
  }
  if (screen === "albums") {
    return library.albums.map((album) => {
      const firstTrack = findTrack(library, album.trackIds[0]);
      return {
        id: album.id,
        primary: album.title,
        secondary: firstTrack?.artistName,
        meta: String(album.trackIds.length).padStart(2, "0"),
        trackId: album.trackIds[0]
      };
    });
  }
  if (screen === "imports") {
    return [...library.tracks].reverse().map((track) => ({
      id: track.id,
      primary: track.title,
      secondary: `${track.source.kind === "local-file" ? track.source.filename : "Ahoy purchase"} · ${metadataLabel(track.displayMetadata.policy)}`,
      meta: "local",
      trackId: track.id
    }));
  }
  return nowPlaying ? [{
    id: nowPlaying.id,
    primary: nowPlaying.title,
    secondary: `${nowPlaying.artistName} · ${nowPlaying.albumTitle}`,
    meta: "current",
    trackId: nowPlaying.id
  }] : [];
}

function countForScreen(screen: PlayerScreen, library: LibraryRecord): string {
  if (screen === "library") return `${library.tracks.length} tracks`;
  if (screen === "artists") return `${library.artists.length}`;
  if (screen === "albums") return `${library.albums.length}`;
  if (screen === "imports") return `${library.imports.length}`;
  if (screen === "now-playing") return "current";
  return "";
}

function metadataLabel(policy: TrackRecord["displayMetadata"]["policy"]): string {
  if (policy === "embedded-tag") return "embedded tags";
  if (policy === "path-fallback") return "path fallback";
  if (policy === "purchase-manifest") return "purchase manifest";
  return "filename display";
}
