#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
missing_libraries=$(ldd "$script_dir/bin/ahoy-player" | awk '/not found/ { print $1 }')
if [[ -n "$missing_libraries" ]]; then
  printf 'Ahoy Player is missing Linux libraries:\n%s\n' "$missing_libraries" >&2
  printf 'On Arch, install gtk3 libappindicator-gtk3 xdo alsa-lib fontconfig libxkbcommon wayland curl.\n' >&2
  exit 1
fi
bin_dir=${XDG_BIN_HOME:-"$HOME/.local/bin"}
applications_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}/applications
icons_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}/icons/hicolor/512x512/apps

install -Dm755 "$script_dir/bin/ahoy-player" "$bin_dir/ahoy-player"
install -Dm644 "$script_dir/share/applications/ahoy-player.desktop" "$applications_dir/ahoy-player.desktop"
install -Dm644 "$script_dir/share/icons/hicolor/512x512/apps/ahoy-player.png" "$icons_dir/ahoy-player.png"
printf 'Ahoy Player installed for this user.\n'
printf 'Run: %s/ahoy-player\n' "$bin_dir"
case ":${PATH}:" in
  *":${bin_dir}:"*) ;;
  *) printf 'Add %s to PATH to run ahoy-player from a terminal.\n' "$bin_dir" ;;
esac
