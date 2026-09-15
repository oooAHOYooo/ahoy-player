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
ahoy --help # terminal CLI/TUI
```

Both products use `~/.local/share/ahoy-player/library.json` (or `$XDG_DATA_HOME/ahoy-player`). The terminal companion automatically migrates its former `~/.ahoy-player/library.json` on first use; the old file is retained. The shared JSON is compatible with the native player, although terminal scans currently use filename/folder metadata rather than reading ID3 tags.

For an Arch package, run `packaging/linux/build-arch.sh`; it produces a `target/ahoy-player-*.pkg.tar.*` package. It depends on Node.js for the current terminal implementation, and `mpv` or `ffplay` is needed for terminal playback. For Debian packaging, install `cargo-deb` and run `packaging/linux/build-deb.sh`.

An AppImage is not produced or advertised as installing `ahoy` globally. It needs separate integration work.

## Terminal CLI/TUI

```bash
npm install
npm run ahoy -- scan ~/Music
npm run ahoy -- tui
```

The native desktop application does not use Electron, Tauri, Chromium, WebView, React, HTML, or CSS. `apps/device-web` is retained only as an optional browser experiment and is not part of the macOS/Linux desktop product.
