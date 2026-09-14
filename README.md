# Ahoy Player

Ahoy has two native products: `apps/native`, a compiled Rust desktop player using Slint and Rodio; and `apps/terminal`, a CLI/TUI companion. `apps/device-web` is an optional browser/PWA experiment and is not the desktop foundation.

## Native desktop player

Install Rust stable, then run:

```bash
cargo test --workspace
cargo run -p ahoy-player
cargo build --release -p ahoy-player
```

The Linux binary is `target/release/ahoy-player`. It has native MP3 selection, SHA-256 duplicate detection, ID3 metadata with filename/folder fallbacks, local JSON persistence, and Rodio playback. Data lives below the platform local-data directory (normally `~/.local/share/ahoy-player`).

Themes and layouts persist separately. Starter themes: Neutral, Winamp-inspired, Terminal green, Monochrome, and High contrast. Users can save, switch, import validated JSON, and export themes.

For Debian packaging, install `cargo-deb` and run `packaging/linux/build-deb.sh`. AppImage output requires an additional bundler/icon pipeline and is not produced yet.

## Terminal CLI/TUI

```bash
npm install
npm run ahoy -- scan ~/Music
npm run ahoy -- tui
```

The native desktop application does not use Electron, Tauri, Chromium, WebView, React, HTML, CSS, or the kiosk host.
