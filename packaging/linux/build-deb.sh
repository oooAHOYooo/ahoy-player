#!/usr/bin/env bash
set -euo pipefail
cargo build --release -p ahoy-player
command -v cargo-deb >/dev/null || { echo "Install cargo-deb: cargo install cargo-deb"; exit 1; }
cargo deb -p ahoy-player
