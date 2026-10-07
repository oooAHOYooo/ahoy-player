#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  printf 'Usage: %s VERSION BINARY OUTPUT_DIR\n' "$0" >&2
  exit 2
fi

version=$1
binary=$2
output_dir=$3
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

install -Dm755 "$binary" "$stage/bin/ahoy-player"
install -Dm644 "$root/packaging/linux/ahoy-player.desktop" "$stage/share/applications/ahoy-player.desktop"
install -Dm644 "$root/apps/desktop/ahoy-logo.png" "$stage/share/icons/hicolor/512x512/apps/ahoy-player.png"
install -Dm755 "$root/packaging/linux/install-release.sh" "$stage/install.sh"
cat > "$stage/README.txt" <<'EOF'
Ahoy Player for Linux

Requirements: x86_64 Linux with Wayland or X11, GTK 3, the AppIndicator GTK 3
library, xdo, ALSA, D-Bus, fontconfig, and curl. The update checker uses curl
to read GitHub Releases; audio playback uses ALSA.

Run ./bin/ahoy-player to try the app. Run ./install.sh to install it for the
current user under ~/.local and create a desktop launcher. The installer can
be run again after downloading a newer release. The CLI is distributed as a
separate ahoy-player-terminal package asset.
EOF

mkdir -p "$output_dir"
tar -C "$stage" -czf "$output_dir/ahoy-player-v${version}-linux-x86_64.tar.gz" .
