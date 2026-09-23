# Ahoy Player distribution handoff

## What is now in place

- `ahoy player` launches the terminal UI; `ahoy scan ~/Music` indexes local MP3s.
- `apps/terminal` is prepared as the public npm package `@ahoy/player-terminal` at version `0.2.1`.
- `scripts/install-cli.sh` is the immediate macOS/Linux installer. It clones or fast-forwards this repository, then globally installs `apps/terminal`, making `ahoy` available from any directory.
- The public-site repository `oooAHOYooo.github.io` has an updated `download.html` CLI card that runs the raw installer above.
- `apps/device-web/public/download.html` no longer links to a nonexistent Arch package; it links to the verified native Linux archive and documents the CLI installer.

## Current user-facing installation

```bash
curl -fsSL https://raw.githubusercontent.com/oooAHOYooo/ahoy-player/main/scripts/install-cli.sh | bash
ahoy scan ~/Music
ahoy player
```

Run the curl command again to fast-forward the local checkout and refresh the global command. It requires Git and Node.js 20+.

## Verified locally

```bash
bash -n scripts/install-cli.sh
npm run typecheck --workspace @ahoy/player-terminal
npm test --workspace @ahoy/player-terminal
```

The CLI package was also packed and installed into an isolated npm prefix; its global `ahoy --version` and `ahoy --help` commands worked.

## Important follow-up work

1. Publish `apps/terminal` to npm as `@ahoy/player-terminal`. It has deliberately not been published yet. Until then, `npm install -g @ahoy/player-terminal` and `ahoy update` are not public installation/update paths; use the installer above.
2. Add a GitHub Actions tag-release workflow to run tests, publish npm with trusted publishing, build native release assets, create checksums, and attach the artifacts to GitHub Releases.
3. Publish the Arch `PKGBUILD` through AUR or a signed pacman repository. It currently exists in-repo only.
4. Once npm publishing exists, update the website to lead with `npm install --global @ahoy/player-terminal` for cross-platform CLI installation, while keeping the source installer as a fallback.

## Repository notes

- Player repo: `https://github.com/oooAHOYooo/ahoy-player`
- Public-site repo: `https://github.com/oooAHOYooo/oooAHOYooo.github.io`
- The local player worktree contains an unrelated untracked `squashfs-root/` directory. Do not add or remove it.
