import { useCallback, useEffect, useMemo, type CSSProperties } from "react";
import {
  demoLibrary,
  playerScreens,
  type DialAction,
  type TrackRecord
} from "@ahoy/player-core";
import { PlayerList, screenLabels, useAhoyPlayer } from "@ahoy/player-react";
import { SignalField, signalThemeFor, useAhoyInput } from "@ahoy/player-ui-dial";
import { LocalStoragePersistenceAdapter, SimulatedPlaybackAdapter } from "@ahoy/player-web-adapters";
import { DesktopFileImportAdapter } from "./adapters/desktop-files";

const fileImport = new DesktopFileImportAdapter();
const persistence = new LocalStoragePersistenceAdapter("ahoy-player:desktop:v1");
const playbackAdapter = new SimulatedPlaybackAdapter();
const libraryScreens = playerScreens.filter((screen) => screen !== "now-playing");

export function App() {
  const isDeckWindow = new URLSearchParams(window.location.search).get("view") === "deck";
  const model = useAhoyPlayer({ initialLibrary: demoLibrary, fileImport, persistence, playbackAdapter });

  const dispatchInput = useCallback((action: DialAction) => {
    if (!isDeckWindow) {
      model.dispatchDial(action);
      return;
    }
    if (action.type === "turn") {
      if (action.direction < 0) model.previousTrack();
      else model.nextTrack();
      return;
    }
    if (action.type === "next") model.nextTrack();
    if (action.type === "play" || action.type === "select") model.togglePlayback();
  }, [isDeckWindow, model]);

  useAhoyInput(dispatchInput, { gamepad: true });

  useEffect(() => {
    if (!isDeckWindow && (model.navigation.screen === "home" || model.navigation.screen === "now-playing")) {
      model.openScreen("library");
    }
  }, [isDeckWindow, model.navigation.screen, model.openScreen]);

  useEffect(() => {
    if (isDeckWindow) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d" || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      openDeckWindow();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDeckWindow]);

  if (isDeckWindow) return <DeckWindow model={model} />;
  return <LibraryWindow model={model} />;
}

function LibraryWindow({ model }: { model: ReturnType<typeof useAhoyPlayer> }) {
  const status = useMemo(() => {
    if (model.isImporting) return "Reading files";
    if (model.lastImport) {
      const refreshed = model.lastImport.duplicates.filter((duplicate) =>
        duplicate.reason === "already-in-library" && Boolean(duplicate.candidate.embeddedMetadata)
      ).length;
      const parts = [`${model.lastImport.receipt.imported} added`];
      if (refreshed) parts.push(`${refreshed} metadata refreshed`);
      if (model.lastImport.receipt.duplicates - refreshed) {
        parts.push(`${model.lastImport.receipt.duplicates - refreshed} duplicate`);
      }
      return parts.join(" · ");
    }
    return window.ahoyDesktop ? "Desktop library" : "Browser preview";
  }, [model.isImporting, model.lastImport]);

  return (
    <main className="desktop-shell" data-testid="desktop-shell">
      <aside className="side-rail">
        <div className="brand-lockup" aria-label="Ahoy local library">
          <span className="brand-mark"><i /><i /><i /></span>
          <div><strong>AHOY</strong><small>LOCAL LIBRARY</small></div>
        </div>

        <nav className="primary-nav" aria-label="Library views">
          {libraryScreens.map((screen, index) => (
            <button
              key={screen}
              className={model.navigation.screen === screen ? "is-active" : ""}
              type="button"
              onClick={() => model.openScreen(screen)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {screenLabels[screen]}
            </button>
          ))}
        </nav>

        <SidebarDataPanel model={model} />

        <div className="rail-bottom">
          <button className="import-button" type="button" onClick={() => void model.importFiles()}>
            <span>＋</span> Import MP3
          </button>
          <p>{status}</p>
        </div>
      </aside>

      <section className="library-deck">
        <header className="deck-header">
          <div>
            <p>LOCAL / BROWSE</p>
            <h1>{screenLabels[model.navigation.screen]}</h1>
          </div>
          <div className="library-counts" aria-label="Library totals">
            <span><strong>{model.library.tracks.length}</strong> tracks</span>
            <span><strong>{model.library.artists.length}</strong> artists</span>
            <span><strong>{model.library.albums.length}</strong> albums</span>
          </div>
        </header>

        <div className="deck-rule"><span /></div>

        {model.navigation.screen === "imports" && model.items.length === 0 && (
          <div className="empty-imports">
            <p>No imports yet.</p>
            <button type="button" onClick={() => void model.importFiles()}>Choose MP3 files</button>
          </div>
        )}
        <PlayerList
          items={model.items}
          focusIndex={model.navigation.focusIndex}
          onActivate={model.activate}
          emptyLabel={model.navigation.screen === "imports" ? "No imports yet" : "Library empty"}
        />

        <footer className="deck-footer">
          <span>ARROWS / BROWSE</span>
          <span>ENTER / SELECT</span>
          <span>SPACE / PLAY</span>
          <span>D / OPEN DECK</span>
        </footer>

        <PlaybackDock model={model} />
      </section>
    </main>
  );
}

function PlaybackDock({ model }: { model: ReturnType<typeof useAhoyPlayer> }) {
  const track = model.nowPlaying;
  const theme = signalThemeFor(signalSeed(track));
  return (
    <section className="playback-dock" aria-label="Playback dock">
      <button className="dock-art" type="button" onClick={openDeckWindow} aria-label="Open Deck">
        <SignalArtwork theme={theme} />
      </button>
      <div className="dock-copy">
        <p>{model.playback.status === "playing" ? "PLAYING" : "READY"}</p>
        <h2>{track?.title ?? "Nothing queued"}</h2>
        <small>{track ? `${track.artistName} / ${track.albumTitle}` : "Import a local MP3"}</small>
      </div>
      <div className="dock-transport" aria-label="Transport controls">
        <button type="button" onClick={model.previousTrack} aria-label="Previous track">←</button>
        <button className={`dock-play${model.playback.status === "playing" ? " is-playing" : ""}`} type="button" onClick={model.togglePlayback}>
          {model.playback.status === "playing" ? "PAUSE" : "PLAY"}
        </button>
        <button type="button" onClick={model.nextTrack} aria-label="Next track">→</button>
      </div>
      <button className="open-deck" type="button" onClick={openDeckWindow}>
        <span>OPEN</span> DECK
      </button>
    </section>
  );
}

function DeckWindow({ model }: { model: ReturnType<typeof useAhoyPlayer> }) {
  const track = model.nowPlaying;
  const queuePosition = model.playback.queueIndex >= 0 ? model.playback.queueIndex + 1 : 0;
  const durationMs = model.playback.durationMs ?? track?.durationMs ?? 240_000;
  const progress = Math.min(1, Math.max(0, model.playback.positionMs / durationMs));
  const theme = signalThemeFor(signalSeed(track));

  return (
    <main className="deck-window" data-testid="deck-window">
      <header className="deck-window__header">
        <div><strong>AHOY MP3</strong><span>LOCAL PLAYER // 01</span></div>
        <p><i className={model.playback.status === "playing" ? "is-live" : ""} /> {model.playback.status}</p>
      </header>

      <section className="deck-window__art" aria-label="Current track artwork">
        <SignalField
          progress={progress}
          isPlaying={model.playback.status === "playing"}
          onSeek={(nextProgress) => model.seek(Math.round(nextProgress * durationMs))}
          onToggle={model.togglePlayback}
          theme={theme}
        />
        <span>{String(queuePosition).padStart(2, "0")} / {String(model.playback.queue.length).padStart(2, "0")}</span>
      </section>

      <section className="deck-window__copy">
        <p>NOW PLAYING</p>
        <h1>{track?.title ?? "Nothing queued"}</h1>
        <h2>{track ? `${track.artistName} / ${track.albumTitle}` : "Import a local MP3 in the library"}</h2>
      </section>

      <div className="deck-progress" aria-label="Playback progress">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <div className="deck-readout"><span>{formatTime(model.playback.positionMs)}</span><span>LOCAL MP3</span><span>{formatTime(durationMs)}</span></div>

      <LocalSourcePanel track={track} />

      <section className="sweep" aria-label="Sweep transport">
        <div className="sweep__heading"><span>CONTROLS</span><small>← / → MOVE · SPACE PLAY</small></div>
        <div className="sweep__controls">
          <button type="button" onClick={model.previousTrack} aria-label="Previous track"><span>←</span> PREV</button>
          <button className={`sweep__play${model.playback.status === "playing" ? " is-playing" : ""}`} type="button" onClick={model.togglePlayback}>
            {model.playback.status === "playing" ? "PAUSE" : "PLAY"}
          </button>
          <button type="button" onClick={model.nextTrack} aria-label="Next track">NEXT <span>→</span></button>
        </div>
      </section>
    </main>
  );
}

function SidebarDataPanel({ model }: { model: ReturnType<typeof useAhoyPlayer> }) {
  const latestTrack = [...model.library.tracks].reverse().find((track) =>
    track.source.kind === "local-file" && !track.source.locator.startsWith("/demo/")
  );
  const receipt = model.library.imports[0];
  const refreshed = model.lastImport?.duplicates.filter((duplicate) =>
    duplicate.reason === "already-in-library" && Boolean(duplicate.candidate.embeddedMetadata)
  ).length ?? 0;
  return (
    <section className="sidebar-data" aria-label="Local library data">
      <div>
        <p>LOCAL DATA</p>
        <h2>{latestTrack ? localLocation(latestTrack) : "No personal files imported"}</h2>
        <small>{latestTrack
          ? `Latest file: ${sourceFilename(latestTrack)}`
          : "Import an MP3 to add its local source record."}</small>
      </div>
      {receipt && <span>{receipt.imported} ADDED · {refreshed ? `${refreshed} METADATA REFRESHED` : `${receipt.duplicates} DUPLICATE`}</span>}
    </section>
  );
}

function LocalSourcePanel({ track }: { track?: TrackRecord }) {
  if (!track || track.source.kind !== "local-file") return null;
  return (
    <details className="local-source">
      <summary>FILE INFO</summary>
      <dl>
        <div><dt>FILE</dt><dd>{track.source.filename}</dd></div>
        <div><dt>LOCATION</dt><dd>{localLocation(track)}</dd></div>
        <div><dt>DISPLAY</dt><dd>{metadataDescription(track.displayMetadata.policy)}</dd></div>
      </dl>
    </details>
  );
}

function SignalArtwork({ theme }: { theme: ReturnType<typeof signalThemeFor> }) {
  return (
    <span className="signal-art" aria-hidden="true" style={{
      "--signal-field": theme.field,
      "--signal-accent": theme.accent,
      "--signal-ink": theme.ink
    } as CSSProperties}>
      <i className="signal-art__axis" />
      <i className="signal-art__orbit signal-art__orbit--one" />
      <i className="signal-art__orbit signal-art__orbit--two" />
      <i className="signal-art__point" />
    </span>
  );
}

function openDeckWindow() {
  if (window.ahoyDesktop) {
    void window.ahoyDesktop.openDeck();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("view", "deck");
  const deck = window.open(
    url,
    "ahoy-deck",
    "popup=yes,width=430,height=660,resizable=yes,scrollbars=no"
  );
  deck?.focus();
}

function localLocation(track: TrackRecord): string {
  if (track.source.kind !== "local-file") return "Ahoy purchase library";
  if (track.source.locator.startsWith("browser-file:")) return "Browser-selected file — folder private";
  return track.source.locator;
}

function sourceFilename(track: TrackRecord): string {
  return track.source.kind === "local-file" ? track.source.filename : "Ahoy purchase";
}

function signalSeed(track?: TrackRecord): string | undefined {
  if (!track) return undefined;
  return track.source.kind === "local-file"
    ? track.source.fingerprint ?? track.source.duplicateKey
    : track.id;
}

function metadataDescription(policy: TrackRecord["displayMetadata"]["policy"]): string {
  if (policy === "embedded-tag") return "Embedded tags preferred — filename fills gaps";
  if (policy === "path-fallback") return "Filename and folder fallback";
  if (policy === "purchase-manifest") return "Ahoy purchase manifest";
  return "Filename only";
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
