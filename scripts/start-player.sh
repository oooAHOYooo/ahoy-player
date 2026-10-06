#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -P "${script_dir}/.." && pwd)"
cd "${repo_root}"

if [[ "$#" -ne 2 ]]; then
  printf 'Usage: start tui player | start gui player\n' >&2
  exit 2
fi

case "$1 $2" in
  "tui player")
    exec npm run dev:terminal
    ;;
  "gui player")
    if [[ "$(uname -s)" != "Linux" ]]; then
      printf 'The GUI launch shortcut currently targets the Linux native desktop build.\n' >&2
      exit 1
    fi
    exec cargo run -p ahoy-player
    ;;
  *)
    printf 'Usage: start tui player | start gui player\n' >&2
    exit 2
    ;;
esac
