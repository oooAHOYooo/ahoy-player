#!/usr/bin/env bash
# Install or update the Ahoy Player terminal companion on macOS or Linux.
set -euo pipefail

repository='https://github.com/oooAHOYooo/ahoy-player.git'
install_root="${AHOY_PLAYER_INSTALL_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/ahoy-player/source}"
terminal_package="$install_root/apps/terminal"

for required in git node npm; do
  if ! command -v "$required" >/dev/null 2>&1; then
    printf 'Ahoy Player needs %s. Install Node.js 20+ (which includes npm) and Git, then try again.\n' "$required" >&2
    exit 1
  fi
done

node_major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$node_major" -lt 20 ]; then
  printf 'Ahoy Player needs Node.js 20 or newer (found %s).\n' "$(node --version)" >&2
  exit 1
fi

if [ -d "$install_root/.git" ]; then
  printf 'Updating Ahoy Player in %s\n' "$install_root"
  git -C "$install_root" fetch origin main --prune
  git -C "$install_root" merge --ff-only origin/main
elif [ -e "$install_root" ]; then
  printf 'Cannot install: %s exists but is not an Ahoy Player checkout.\n' "$install_root" >&2
  printf 'Move it aside or set AHOY_PLAYER_INSTALL_DIR to a different directory.\n' >&2
  exit 1
else
  printf 'Downloading Ahoy Player…\n'
  mkdir -p "$(dirname "$install_root")"
  git clone --depth 1 "$repository" "$install_root"
fi

printf 'Installing the global ahoy command…\n'
npm install --global "$terminal_package"

if ! command -v ahoy >/dev/null 2>&1; then
  printf "%s\n" "Ahoy was installed, but npm's global bin directory is not on PATH." >&2
  printf 'Add this directory to PATH, then open a new terminal: %s/bin\n' "$(npm prefix --global)" >&2
  exit 1
fi

printf '\nAhoy Player CLI is ready. Run: ahoy player\n'
