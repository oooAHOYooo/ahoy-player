# Stack and architecture

## Product rule

Ahoy Player shares product behavior, not platform assumptions. A host is allowed to look and feel different while consuming the same normalized library, queue, persistence snapshot, purchase contract, and Dial actions.

## Runtime flow

```text
host file picker / managed folder
  -> ImportCandidate[]
  -> media-pipeline validation + filename normalization + duplicate check
  -> ImportBatchResult
  -> core mergeImportBatch()
  -> LibraryRecord + ImportReceipt
  -> player-react view model
  -> platform shell

Dial / keyboard / touch / remote / gamepad
  -> DialAction
  -> shared navigation + playback reducers
  -> PlaybackAdapter side effects
```

Future purchases join after the host boundary:

```text
app.ahoy.ooo
  -> PurchaseSyncAdapter
  -> entitlement + manifest + local locator
  -> the same TrackRecord and LibraryRecord
```

No marketplace endpoint, authentication scheme, or download policy is hard-coded in the local milestone.

## Canonical code locations

| Concern | Shared location | Platform implementation |
| --- | --- | --- |
| Track, artist, album, library, imports | `packages/core/src/types.ts` | None |
| Queue and playback behavior | `packages/core/src/playback.ts` | Audio I/O through `PlaybackAdapter` |
| Dial actions and navigation | `packages/core/src/navigation.ts` | DOM/gamepad binding in `packages/ui-dial` |
| Persistence, file import, input, playback ports | `packages/core/src/contracts.ts` | Electron IPC or `packages/web-adapters` |
| Purchase sync boundary | `PurchaseSyncAdapter` in `contracts.ts` | Not implemented yet |
| Metadata normalization | `packages/media-pipeline/src/metadata.ts` | Candidate construction in each host |
| Duplicate detection | `runImportPipeline()` | SHA-256 supplied by Electron/Web Crypto |
| Shared React state orchestration | `packages/player-react/src/useAhoyPlayer.ts` | Initial adapters chosen by each app |
| Tactile circular control | `packages/ui-dial/src/AhoyDial.tsx` | Shell CSS can size/place it |

## Host responsibilities

### Electron desktop

- owns the native file dialog and native filesystem paths
- hashes MP3 bytes in the main process
- exposes one narrow, context-isolated preload API
- owns a single compact Deck playback window, created or focused through IPC
- keeps the library and Deck on the shared `PlayerSnapshot` subscription contract
- packages the desktop renderer for macOS, Windows, and Linux
- later supplies a real desktop `PlaybackAdapter`, updater, menus, and media keys

The renderer never imports Node or Electron APIs directly.

### Touch/web PWA

- owns browser file selection and Web Crypto hashing
- ships a web manifest and cache-first fallback service worker
- uses touch-sized layout and the shared DOM/gamepad input layer
- later chooses durable browser file handles or IndexedDB media storage

### Linux kiosk

- owns big-screen layout, remote conventions, and boot/full-screen behavior
- can accept a launcher-injected managed-folder bridge
- uses browser selection only as a development fallback
- later supplies hardware-specific audio, mount discovery, and watchdog behavior

### Xbox boundary

`apps/xbox-shell` contains documentation only. A future host must implement approved Xbox storage, input, playback, lifecycle, packaging, and certification behavior. It must not import Electron, Node filesystem, or Linux kiosk APIs.

## Import rules

The local display model is filename-first by design. Embedded tags are ignored rather than trusted or surfaced.

Supported examples include:

```text
03 Artist - Title.mp3
Artist - Album - Title.mp3
Artist - Album - 03 - Title.mp3
Artist/Album/03 Title.mp3
```

The parser normalizes underscores and whitespace, keeps user-visible words intact, and records whether a path fallback was needed. It does not mutate source MP3 bytes.

Duplicate priority:

1. `sha256:<content digest>` when the host can read bytes.
2. `file:<normalized filename>:<byte size>` as a weaker fallback.

Stable track IDs derive from the duplicate key, never from batch order.

## Audio adapter milestone

The UI, queue, current-track selection, play/pause state, and next behavior are functional. Audio output is intentionally not coupled to those reducers. `SimulatedPlaybackAdapter` is the current implementation; a real adapter must resolve a `TrackSource.locator` using host permissions and report transport state through the same port.
