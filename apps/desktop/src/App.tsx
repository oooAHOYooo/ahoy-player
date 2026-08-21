import { useCallback, useEffect, useMemo } from "react";
import {
  demoLibrary,
  playerScreens,
  type DialAction
} from "@ahoy/player-core";
import { PlayerList, screenLabels, useAhoyPlayer } from "@ahoy/player-react";
import { useAhoyInput } from "@ahoy/player-ui-dial";
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
      return `${model.lastImport.receipt.imported} added · ${model.lastImport.receipt.duplicates} duplicate`;
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
  return (
    <section className="playback-dock" aria-label="Playback dock">
      <button className="dock-art" type="button" onClick={openDeckWindow} aria-label="Open Deck">
        <SignalArtwork />
      </button>
      <div className="dock-copy">
        <p>{model.playback.status === "playing" ? "PLAYING" : "READY"}</p>
        <h2>{track?.title ?? "Nothing queued"}</h2>
        <small>{track ? `${track.artistName} / ${track.albumTitle}` : "Import a local MP3"}</small>
      </div>
      <div className="dock-transport" aria-label="Transport controls">
        <button type="button" onClick={model.previousTrack} aria-label="Previous track">←</button>
        <button className="dock-play" type="button" onClick={model.togglePlayback}>
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

  return (
    <main className="deck-window" data-testid="deck-window">
      <header className="deck-window__header">
        <div><strong>DECK</strong><span>AHOY / LOCAL</span></div>
        <p><i className={model.playback.status === "playing" ? "is-live" : ""} /> {model.playback.status}</p>
      </header>

      <section className="deck-window__art" aria-label="Current track artwork">
        <SignalArtwork />
        <span>{String(queuePosition).padStart(2, "0")} / {String(model.playback.queue.length).padStart(2, "0")}</span>
      </section>

      <section className="deck-window__copy">
        <p>CURRENT SIGNAL</p>
        <h1>{track?.title ?? "Nothing queued"}</h1>
        <h2>{track ? `${track.artistName} / ${track.albumTitle}` : "Import a local MP3 in the library"}</h2>
      </section>

      <div className="deck-progress" aria-label="Playback progress">
        <span style={{ width: model.playback.status === "playing" ? "38%" : "12%" }} />
      </div>
      <div className="deck-readout"><span>00:00</span><span>LOCAL</span><span>--:--</span></div>

      <section className="sweep" aria-label="Sweep transport">
        <div className="sweep__heading"><span>SWEEP</span><small>ARROWS / MOVE · SPACE / PLAY</small></div>
        <div className="sweep__controls">
          <button type="button" onClick={model.previousTrack}><span>←</span> PREV</button>
          <button className="sweep__play" type="button" onClick={model.togglePlayback}>
            {model.playback.status === "playing" ? "PAUSE" : "PLAY"}
          </button>
          <button type="button" onClick={model.nextTrack}>NEXT <span>→</span></button>
        </div>
      </section>
    </main>
  );
}

function SignalArtwork() {
  return (
    <span className="signal-art" aria-hidden="true">
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
