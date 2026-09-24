# Ahoy Player

Ahoy has one desktop product: `apps/native`, a compiled Rust player using Slint and Rodio. The same Rust/Slint frontend is used on macOS and Linux; there is no Electron desktop application. `apps/terminal` is a separate CLI/TUI companion.

## Native desktop player (macOS + Linux)

The native desktop player is the product source of truth. Develop and visually inspect it on macOS, then build the same Slint UI for Linux. Rust owns application state, local files, metadata, persistence, and audio; Slint owns the cross-platform presentation.

On macOS, install Apple’s command-line tools and Rust once:

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

Run the visual MVP with:

```bash
cargo run -p ahoy-player
```

Install Rust stable, then run:

```bash
cargo test --workspace
cargo run -p ahoy-player
cargo build --release -p ahoy-player
```

The Linux binary is `target/release/ahoy-player`. It has native MP3 selection, SHA-256 duplicate detection, ID3 metadata with filename/folder fallbacks, local JSON persistence, and Rodio playback. Data lives below the platform local-data directory (normally `~/.local/share/ahoy-player`).

Themes and layouts persist separately. Starter themes: Neutral, Winamp-inspired, Terminal green, Monochrome, and High contrast. Users can save, switch, import validated JSON, and export themes.

## Linux packages

One Linux installation supplies both commands:

```bash
ahoy-player # graphical player
ahoy player  # terminal player / TUI
ahoy --help  # terminal CLI/TUI help
```

Both products use `~/.local/share/ahoy-player/library.json` (or `$XDG_DATA_HOME/ahoy-player`). The terminal companion automatically migrates its former `~/.ahoy-player/library.json` on first use; the old file is retained. The shared JSON is compatible with the native player, although terminal scans currently use filename/folder metadata rather than reading ID3 tags.

For an Arch package, run `packaging/linux/build-arch.sh`; it produces a `target/ahoy-player-*.pkg.tar.*` package. It depends on Node.js for the current terminal implementation, and `mpv` or `ffplay` is needed for terminal playback. For Debian packaging, install `cargo-deb` and run `packaging/linux/build-deb.sh`.

An AppImage is not produced or advertised as installing `ahoy` globally. It needs separate integration work.

## Terminal CLI/TUI

Install it once on any macOS, Linux, or Windows machine with Node.js 20+:

```bash
npm install --global @ahoy/player-terminal
```

Until the npm package is published, macOS and Linux users can install directly
from the public source repository instead:

```bash
curl -fsSL https://raw.githubusercontent.com/oooAHOYooo/ahoy-player/main/scripts/install-cli.sh | bash
```

Run that command again later to fast-forward to the latest source and reinstall
the global command. It never resets a modified local checkout.

Then, from any terminal directory:

```bash
ahoy player
```

`ahoy player` is the interactive terminal player. Run `ahoy update` whenever you
want the latest published version (or use your package manager's normal global
update command). The package needs to be published to npm before this installation
command is available publicly.

```bash
npm install
npm run ahoy -- scan ~/Music
npm run ahoy -- player
```

In the terminal player, press **v** to switch between the original live deck and
**Terminal Art**. Artwork uses monochrome Unicode braille within the original
left-aligned deck, preserving the terminal's own colors and track list, sized to
the terminal (up to 90 columns; shorter terminals use fewer columns to preserve
the square artwork). Install FFmpeg for cover decoding and duration metadata.

An empty library still opens the player with a welcome screen. Press **s** to
scan `~/Music`, or **r** to reload after adding files from another shell.
`ahoy scan` defaults to `~/Music`; if an interactive scan leaves the library
empty, it opens this welcome screen automatically. Piped scans still exit normally.
Embedded MP3 covers take priority over adjacent `cover.jpg`, `cover.png`,
`folder.jpg`, or `folder.png`. Missing artwork shows a procedural braille CD with
rotating reflections and a dot orbiting its track, in either deck view.

Terminal Art keys: **↑/↓** select, **Enter** play, **Space** play/pause,
**[ / ]** previous/next, **Tab / Shift+Tab** focus labeled controls, **Enter**
activate, **b** toggle ASCII fallback, **v** return to the deck, **x** quit.
Use `AHOY_ASCII=1` for fonts without braille support. The CD spins only during
playback and freezes on pause. Press **z** to turn motion off, or launch with
`AHOY_REDUCED_MOTION=1`. Album covers themselves remain static;
elapsed time is estimated from the playback process clock and freezes on pause.
Terminal emulators do not expose font coverage or DOM accessibility semantics;
the fallback is explicit, with visible keyboard focus and text labels.

Mixer keys work in both views: **8/9** lower/raise master volume, **1/2** lower/raise
the original song, and **3/4** lower/raise remix notes, in 5% steps (0–100%).
Master multiplies both channel levels; it never changes your system volume.
Press **m** during playback to toggle QWERTY remix notes in either view.
The piano layout and uppercase synth/delay sounds are available in remix mode.
**5/6/7** toggle echo, chorus, and lo-fi (moved from 1–3 to avoid mixer conflicts).
**Esc** leaves remix mode; letter shortcuts such as **z**, **v**, and **b** then
control the deck again. **8/9** always control master volume.
The TUI prefers **mpv** for live mixing without restarting tracks. With fallback
players, levels apply when starting a track or note; the mixer displays a notice
that mpv is required for live changes. Levels last for the current TUI session.

Artwork processing runs in a Node worker with asynchronous FFmpeg subprocesses.
Bounded in-memory caches share decoded images by SHA-256 and rendered results by
hash/size; returning to a cached cover does not decode it again. Resize only
converts a small cached grayscale image. Caches reset when the TUI exits.
Run `npm test --workspace @ahoy/player-terminal` for conversion, caching, and
FFmpeg integration tests (the integration test skips when FFmpeg is unavailable).

The native desktop application does not use Electron, Tauri, Chromium, WebView, React, HTML, or CSS. `apps/device-web` is retained only as an optional browser experiment and is not part of the macOS/Linux desktop product.
