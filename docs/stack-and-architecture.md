# Stack and architecture

Ahoy’s native GUI is a Rust stable Cargo workspace member at `apps/native`. Slint owns the compiled desktop UI; Rust owns all state and platform integration. The desktop application has no browser engine or web runtime.

```text
Slint window + native keyboard/mouse
  -> Rust app state
  -> rfd native MP3 file chooser
  -> lofty ID3 metadata + filename/folder fallback
  -> SHA-256 duplicate check
  -> JSON library/theme/layout persistence
  -> Rodio local playback
```

The library persists local source paths, content hashes, user-visible metadata, and import time. The queue state controls previous/next/play/pause while Rodio resolves the local path only at playback time.

Themes contain validated color, typography, spacing, border, shadow, radius, artwork, and control-style tokens. Layout data is separately persisted and records each modular panel’s visibility and ordering. This JSON boundary intentionally supports future skin sharing without coupling it to UI code.

`apps/terminal` remains a separate Node.js CLI/TUI product. The desktop runtime is Rust and Slint on both macOS and Linux. Browser UI packages and the React player have been removed so desktop behavior has one shared implementation.
