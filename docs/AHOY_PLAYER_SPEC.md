# Ahoy Player — Product Specification

**Status:** active working specification  
**Version:** 0.1  
**Last updated:** 2026-08-28

## Product

Ahoy Player is a local-first music library and MP3 player. It combines a calm, glass-like library manager with a compact, classic-player experience inspired by Winamp. The product principle is ownership: a person’s music stays on their device and the interface makes that collection feel tangible, organized, and theirs.

## Current surfaces

### Public download hub

- `/` redirects to the download/documentation landing page.
- `/download.html` is the public download hub.
- It includes the Ahoy logo, product positioning, macOS and Linux downloads, browser preview, GitHub source, releases, and contact link.
- Apple Silicon, Intel, and Linux AppImage buttons link directly to the current GitHub Release assets. Each release shows its build number.

### Browser player

- `/player.html` opens the full web player.
- The player is an installable web/PWA surface, not the public landing page.
- It supports local MP3 import, library search, library navigation, playback controls, queue visibility, volume, customization, a light glass theme, and a dark hot-pink theme.
- The desktop-style menu bar exposes File, Edit, View, Playback, Window, and Help commands.
- A compact classic-player strip provides the Winamp-inspired now-playing view.

### Native desktop app

- Rust + Slint host in `apps/native`; no Electron, browser engine, or WebView.
- Native file picker, local metadata inspection, local SHA-256 fingerprinting, and Rodio playback.
- Build and run on Linux:

```bash
cargo test --workspace
cargo run -p ahoy-player
cargo build --release -p ahoy-player
```

- Package Debian artifacts:

```bash
cargo install cargo-deb
packaging/linux/build-deb.sh
```

The initial native release target is Linux. macOS and Windows are deliberately deferred until the core native workflow and packaging are stable.

## Visual system

- Light default: translucent white surfaces, soft blue/green ambient light, trustworthy Signal Blue accent (`#0a84ff`).
- Dark mode: deep charcoal/plum surfaces with hot pink accent (`#ff0060`).
- Typography: system sans for interface text and compact monospace labels for metadata, state, and ownership cues.
- Texture: restrained halftone/dot fields in artwork and surfaces.
- Brand: Ahoy wordmark plus nautical seagull language; the supplied Ahoy “A” is used for the public download hub and macOS icon.
- Interaction language: native desktop controls, visible active states, compact menus, clear hover feedback, and keyboard-friendly buttons.

## Data and privacy model

- The canonical product model is one person, one local library, one player.
- Imported audio is not uploaded by the web player.
- Browser persistence uses local storage and browser-selected files.
- The native host uses platform file selection, local metadata/hash processing, and local audio output.
- Transfer actions are currently interface scaffolding; remote transfer services are not yet implemented.

## Core capabilities

- Import MP3 files.
- Read embedded ID3 metadata where available.
- Fall back to filename and folder information for missing labels.
- Detect duplicate files using content fingerprints where available.
- Browse by library, artist, album, and recent imports.
- Search the local library.
- Play, pause, seek, previous, next, queue, and volume controls.
- Customize accent color, glass opacity, blur, ambient glow, and light/dark appearance.
- Open a separate compact deck from the desktop host.

## Deployment

Render deploys the web surface as a static site from `main`.

- Build command: `npm ci && npm run build --workspace @ahoy/player-web`
- Publish directory: `apps/device-web/dist`
- Auto-deploy: enabled for pushes to `main`
- Static site root: download hub
- Optional browser player: `/player.html`

GitHub Releases should initially store the Linux Debian artifact. AppImage, macOS, and Windows artifacts require separate packaging work after the native MVP is validated.

## Known limitations

- The current macOS builds are ad-hoc signed and not notarized.
- GitHub Release assets are test installers, not an auto-updating application channel.
- Transfer navigation is visual scaffolding until a transfer protocol and service are selected.
- Some host playback paths still use simulated playback adapters.
- The public download page does not upload or manage a user’s music.

## Verification checklist

Before a release:

1. Run `npm run typecheck`.
2. Run `npm test`.
3. Run `npm run build`.
4. Verify `/`, `/download.html`, and `/player.html` in the Render preview.
5. Test light and dark player states.
6. Build the Linux Debian package and verify its desktop entry.
7. Launch the native binary and test import, playback, themes, and persistence.
8. Update the GitHub Release assets and confirm the Linux download link.
