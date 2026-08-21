# Ahoy Player

Ahoy Player is one local-first music product with separate platform hosts. Its shared behavior lives in TypeScript packages; Electron, the touch PWA, the Linux TV kiosk, and a future Xbox host each own their platform APIs.

The first milestone imports MP3 files, deliberately ignores embedded tags in the display model, derives clean labels from filenames and folders, detects duplicates, persists library metadata, and drives every screen through the same Ahoy Dial action model. Playback state is working; audio output remains behind the `PlaybackAdapter` boundary and uses a simulated adapter in this milestone.

## Run it

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
npm run typecheck
npm test
npm run build
```

Desktop development launches Vite and the Electron host together:

```bash
npm run dev:desktop
```

The desktop library keeps playback in a compact bottom dock. Choose **Open Deck** (or press `D`) to open the separate playback window. The Electron host creates or focuses one Deck window rather than duplicating it.

The touch PWA and TV kiosk run independently:

```bash
npm run dev:web
npm run dev:kiosk -- --host 0.0.0.0
```

Run the built desktop host:

```bash
npm run build --workspace @ahoy/player-desktop
npm run start --workspace @ahoy/player-desktop
```

Preview a production kiosk bundle for a Linux media box:

```bash
npm run build --workspace @ahoy/player-linux-kiosk
npm run preview --workspace @ahoy/player-linux-kiosk -- --host 127.0.0.1 --port 4174
chromium --kiosk http://127.0.0.1:4174
```

The Chromium command is an example launcher, not a complete appliance image. Autostart, remote administration, display rotation, and hardware audio selection belong to the Linux image/service configuration.

## Repository map

```text
apps/
  desktop/          Electron main/preload + React desktop renderer
  device-web/       installable touch/web PWA
  linux-kiosk/      big-screen React shell for a Linux media box
  xbox-shell/       boundary document only; no pretend desktop-compatible package
packages/
  core/             canonical schema, reducers, actions, and adapter contracts
  media-pipeline/   filename normalization and duplicate detection
  player-react/     shared React player model and semantic list UI
  ui-dial/          Ahoy Dial control and DOM/gamepad input mapping
  web-adapters/     browser picker, localStorage, and simulated playback adapters
docs/
  stack-and-architecture.md
  megaprompts.md     historical design input, not build instructions
```

## Milestone behavior

### Import and normalization

1. A host produces an `ImportCandidate` with an opaque locator, byte size, dates, MIME type, and optional SHA-256 fingerprint.
2. Non-MP3 and zero-byte files are rejected.
3. The pipeline never reads ID3 values into the local display model.
4. It parses track number, artist, album, and title from common filename forms.
5. Missing labels fall back to meaningful parent folders, then `Unknown Artist` / `Local Imports`.
6. SHA-256 is the strong duplicate key. Hosts that cannot read bytes fall back to normalized filename plus byte size.
7. Accepted tracks merge into the same normalized `LibraryRecord`; the batch produces a durable `ImportReceipt`.

The Electron bridge uses the native file dialog and SHA-256 hashes. The PWA hashes browser-selected file bytes with Web Crypto. A real Linux launcher can inject `window.ahoyKiosk.chooseMp3Files()`; the development kiosk falls back to the browser picker.

### Ahoy Dial

The canonical actions are:

- `turn(-1 | 1)`
- `menu`
- `select`
- `back`
- `next`
- `play`

Keyboard and remote-style arrows turn the current list, Enter selects, Escape/Backspace goes back, Space toggles play, `N` advances, and `M` returns to menu. Pointer/touch can press the five controls or rotate the ring. Standard gamepads map D-pad/axes plus A, B, X, Y, and Start into the same actions.

### Persistence and playback

`PlayerSnapshot` is shared; desktop, PWA, and kiosk currently persist it through host-keyed localStorage adapters. The adapter's optional subscription channel keeps the desktop library and Deck popup synchronized in both directions. The playback queue and state machine are shared pure reducers. `SimulatedPlaybackAdapter` proves the port; a future Web Audio, HTML Audio, or native backend can replace it without changing library/navigation behavior.

Only normalized library metadata and opaque locators are persisted. Browser `File` objects are not retained across sessions yet.

## Verification

`npm test` covers filename parsing, path fallbacks, fingerprint keys, existing-library duplicates, same-batch duplicates, and invalid inputs. `npm run typecheck` checks every workspace, including Electron main/preload code. `npm run build` builds all three implemented hosts.

See [stack-and-architecture.md](./docs/stack-and-architecture.md) for the shared/platform boundary and contract locations.
