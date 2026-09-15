#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
version=$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$root/apps/native/Cargo.toml" | head -n 1)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
archive="$work/ahoy-player-$version.tar.gz"

git -C "$root" archive --format=tar --prefix="ahoy-player-$version/" HEAD | gzip > "$archive"
cp "$root/packaging/linux/PKGBUILD" "$work/PKGBUILD"
sed -i "s/^pkgver=.*/pkgver=$version/" "$work/PKGBUILD"
(
  cd "$work"
  makepkg --cleanbuild --syncdeps --noconfirm
)
find "$work" -maxdepth 1 -type f -name 'ahoy-player-*.pkg.tar.*' -exec cp {} "$root/target/" \;
