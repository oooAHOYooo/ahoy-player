import { demoLibrary } from "@ahoy/player-core";
import { PlayerList, screenLabels, useAhoyPlayer } from "@ahoy/player-react";
import { AhoyDial, useAhoyInput } from "@ahoy/player-ui-dial";
import {
  BrowserFileImportAdapter,
  BrowserAudioPlaybackAdapter,
  LocalStoragePersistenceAdapter,
} from "@ahoy/player-web-adapters";

const fileImport = new BrowserFileImportAdapter();
const persistence = new LocalStoragePersistenceAdapter("ahoy-player:web:v1");
const playbackAdapter = new BrowserAudioPlaybackAdapter();

export function App() {
  const model = useAhoyPlayer({ initialLibrary: demoLibrary, fileImport, persistence, playbackAdapter });
  useAhoyInput(model.dispatchDial, { gamepad: true });

  return (
    <main className="touch-shell">
      <header className="touch-header">
        <div><strong>AHOY</strong><span>PLAYER</span></div>
        <button type="button" onClick={() => void model.importFiles()}>
          {model.isImporting ? "Reading" : "Import"}
        </button>
      </header>

      <section className="touch-screen">
        <div className="touch-title">
          <p>LOCAL LIBRARY</p>
          <h1>{screenLabels[model.navigation.screen]}</h1>
          <span>{model.library.tracks.length} tracks</span>
        </div>
        <PlayerList
          items={model.items}
          focusIndex={model.navigation.focusIndex}
          onActivate={model.activate}
          emptyLabel="No local files"
        />
      </section>

      <section className="touch-controls">
        <div className="touch-now">
          <span className="touch-now__signal" />
          <p>NOW PLAYING</p>
          <h2>{model.nowPlaying?.title ?? "Nothing queued"}</h2>
          <small>{model.nowPlaying?.artistName ?? "Import an MP3"}</small>
        </div>
        <AhoyDial dispatch={model.dispatchDial} isPlaying={model.playback.status === "playing"} size="compact" />
      </section>
    </main>
  );
}
