#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  printf 'Usage: %s VERSION BINARY OUTPUT_DIR\n' "$0" >&2
  exit 2
fi

version=$1
binary=$2
output_dir=$3
bundle="$output_dir/Ahoy Player.app"
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)

rm -rf "$bundle"
mkdir -p "$bundle/Contents/Resources"
install -Dm755 "$binary" "$bundle/Contents/MacOS/ahoy-player"
install -Dm644 "$root/packaging/macos/Info.plist" "$bundle/Contents/Info.plist"
iconset=$(mktemp -d)
trap 'rm -rf "$iconset"' EXIT
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$root/apps/desktop/ahoy-logo.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$root/apps/desktop/ahoy-logo.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$bundle/Contents/Resources/AhoyPlayer.icns"
/usr/libexec/PlistBuddy -c 'Add :CFBundleIconFile string AhoyPlayer' "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $version" "$bundle/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $version" "$bundle/Contents/Info.plist"
printf '%s\n' "$bundle"
