# Xbox Shell Boundary

This directory is deliberately **not** an Xbox package. It records the seam where a Microsoft-platform host can be added after platform access, packaging, and certification decisions exist.

## Shared code it may consume

- `@ahoy/player-core`: library, queue, navigation, persistence, playback, and purchase-sync contracts
- `@ahoy/player-media-pipeline`: normalization and duplicate rules, if the platform permits local-file import
- `@ahoy/player-react` and `@ahoy/player-ui-dial`: only if the selected Xbox host supports an appropriate web/React surface

## Services an Xbox host must implement

- `InputAdapter` for controller and platform navigation events
- `PersistenceAdapter` using an Xbox-supported storage API
- `PlaybackAdapter` using an approved media backend
- platform lifecycle, suspend/resume, safe-area, packaging, and certification behavior
- an optional `PurchaseSyncAdapter` when `app.ahoy.ooo` contracts are live

## Explicit non-assumptions

- No Electron, Node filesystem, macOS, Windows desktop, or Linux APIs are available here.
- A browser gamepad preview is not an Xbox application.
- No store package, UWP/WinUI choice, or certification claim is made in this milestone.
