# Ahoy Player Release Guardian

This is a repo-local release-readiness report for the Ahoy Player monorepo. It evaluates source, Git state, build/test results, the local web preview, existing macOS artifacts, and integration boundaries. It never commits, pushes, tags, uploads, deploys, edits GitHub Releases, or deletes/replaces artifacts.

## Requirements

Use the repository's existing Node.js 20+ and npm 10+ setup. Install the normal workspace dependencies first:

```bash
npm ci
```

No additional dependency is required. Browser interaction screenshots are optional: if an existing local `playwright` package is resolvable, the guardian uses it; it never installs it automatically.

## Run

From the repository root:

```bash
npm run run --prefix tools/release-guardian
```

The default run executes `npm run typecheck`, `npm test`, and `npm run build`; briefly starts the built web player with Vite preview; checks `/`, `/download.html`, and `/player.html`; then reads existing macOS artifacts. Build output and reports are local operational output, not source changes.

For a strict no-command/no-preview plan report:

```bash
npm run dry-run --prefix tools/release-guardian
```

For a deliberate macOS packaging evaluation (this writes Electron Builder artifacts into a new timestamped `.local/release-guardian/` staging directory; it never publishes or replaces existing artifacts):

```bash
npm run run --prefix tools/release-guardian -- --package-mac
```

To avoid starting the local web preview, add `--skip-web-qa`.

## Output and statuses

Reports and optional `web-desktop.png` / `web-mobile.png` screenshots go to `.local/release-guardian/`, which is gitignored. Reports exclude command environment values and do not inspect or print private local-media paths.

- **READY** means direct local evidence passed.
- **WARNING** is a release risk, such as ad-hoc signing.
- **BLOCKER** is a failed required command, critical route, or artifact inspection.
- **UNVERIFIED** is intentionally not claimed working; it includes unavailable live AHOY ID, entitlement, purchase/download, library-sync, and NFC integrations.
- **SKIPPED** is an intentional mode choice.

When a DMG exists, every run calls `hdiutil imageinfo` before it is reported usable. Signing and notarization are separate: an ad-hoc signature is never reported notarized or production-ready.

## What it verifies

The monorepo has Electron desktop, Vite/React web player, Linux kiosk, shared core/adapters/UI packages, and an Xbox boundary document rather than an Xbox app. The guardian distinguishes source-backed controls from rendered interaction evidence: without optional browser QA, play/pause, seek, next/previous, volume, queue, and mobile layout are **unverified**, not declared working. It treats desktop/kiosk simulated playback and all account/entitlement/NFC boundaries as incomplete unless future source evidence changes.

## Safe scheduling later

Keep scheduling local and non-publishing. For example, add a macOS `launchd` job or CI *report-only* job that runs the default command and saves `.local/release-guardian/` as a private local/CI artifact. Add `--package-mac` only to a dedicated Mac builder with enough disk space; retain `hdiutil imageinfo` as a required gate. Do not schedule publishing from this tool.
