#!/usr/bin/env bash
# Install or update Ahoy Player's terminal companion for every local user.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  printf 'Run this installer as root, for example: curl -fsSL URL | sudo bash\n' >&2
  exit 1
fi

repository='https://github.com/oooAHOYooo/ahoy-player.git'
install_root='/usr/local/lib/ahoy-player-terminal'
command_path='/usr/local/bin/ahoy'
command_target="$install_root/apps/terminal/ahoy.mjs"

if [ -e "$command_path" ] || [ -L "$command_path" ]; then
  existing_target=$(readlink -f "$command_path" 2>/dev/null || true)
  if [ "$existing_target" != "$command_target" ]; then
    printf 'Cannot install: %s already exists and is not Ahoy Player.\n' "$command_path" >&2
    exit 1
  fi
fi

for required in git node npm; do
  if ! command -v "$required" >/dev/null 2>&1; then
    printf 'Ahoy Player needs %s. Install Node.js 20+ and Git, then try again.\n' "$required" >&2
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
  exit 1
else
  printf 'Downloading Ahoy Player…\n'
  mkdir -p "$(dirname "$install_root")"
  git clone --depth 1 "$repository" "$install_root"
fi

printf 'Installing terminal player dependencies…\n'
npm install --prefix "$install_root/apps/terminal" --omit=dev
chmod 755 "$install_root/apps/terminal/ahoy.mjs"
mkdir -p "$(dirname "$command_path")"
ln -sfn "$command_target" "$command_path"
printf '\nAhoy Player CLI is ready for all users. Run: ahoy player\n'
