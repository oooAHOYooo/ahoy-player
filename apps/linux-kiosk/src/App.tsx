import { demoLibrary } from "@ahoy/player-core";
import { PlayerList, screenLabels, useAhoyPlayer } from "@ahoy/player-react";
import { AhoyDial, useAhoyInput } from "@ahoy/player-ui-dial";
import { LocalStoragePersistenceAdapter, SimulatedPlaybackAdapter } from "@ahoy/player-web-adapters";
import { KioskFileImportAdapter } from "./adapters/kiosk-files";

const fileImport = new KioskFileImportAdapter();
const persistence = new LocalStoragePersistenceAdapter("ahoy-player:kiosk:v1");
const playbackAdapter = new SimulatedPlaybackAdapter();

export function App() {
  const model = useAhoyPlayer({ initialLibrary: demoLibrary, fileImport, persistence, playbackAdapter });
  useAhoyInput(model.dispatchDial, { keyboardSource: "remote", gamepad: true });
  const track = model.nowPlaying;

  return (
    <main className="kiosk-shell" data-testid="kiosk-shell">
      <header className="kiosk-header">
        <div className="kiosk-brand"><strong>AHOY</strong><span>PLAYER / TV</span></div>
        <div className="kiosk-source"><i /> LOCAL LIBRARY</div>
        <button type="button" onClick={() => void model.importFiles()}>
          {model.isImporting ? "READING" : "IMPORT"}
        </button>
      </header>

      <section className="kiosk-stage">
        <article className="kiosk-now">
          <div className="kiosk-art" aria-hidden="true">
            <span className="kiosk-art__mast" />
            <span className="kiosk-art__ring kiosk-art__ring--outer" />
            <span className="kiosk-art__ring kiosk-art__ring--inner" />
            <span className="kiosk-art__marker" />
          </div>
          <div className="kiosk-track">
            <p>{model.playback.status === "playing" ? "PLAYING" : "READY"}</p>
            <h1>{track?.title ?? "Nothing queued"}</h1>
            <h2>{track?.artistName ?? "Import a local MP3"}</h2>
            <div className="kiosk-progress"><span /></div>
          </div>
        </article>

        <section className="kiosk-browser">
          <div className="kiosk-browser__heading">
            <p>AHOY DIAL</p>
            <h2>{screenLabels[model.navigation.screen]}</h2>
            <span>{model.library.tracks.length} TRACKS</span>
          </div>
          <PlayerList
            items={model.items}
            focusIndex={model.navigation.focusIndex}
            onActivate={model.activate}
            emptyLabel="NO LOCAL FILES"
          />
        </section>

        <aside className="kiosk-control">
          <AhoyDial dispatch={model.dispatchDial} isPlaying={model.playback.status === "playing"} size="tv" />
        </aside>
      </section>

      <footer className="kiosk-footer">
        <span>ARROWS TURN</span>
        <span>A / ENTER SELECT</span>
        <span>B / ESC BACK</span>
        <span>START / SPACE PLAY</span>
      </footer>
    </main>
  );
}
