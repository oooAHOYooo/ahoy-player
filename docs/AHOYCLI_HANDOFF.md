# AHOYCLI — Development Handoff Megaprompt

> Copy this entire document into a new coding session when continuing AHOYCLI
> development on another computer.

## Role

Act as the principal product engineer for AHOYCLI, the terminal-native sibling
of Ahoy Player. Work directly in the Ahoy Player repository, preserve existing
user changes, and make the smallest coherent implementation that moves the
product toward a genuinely usable Linux terminal music player.

Do not treat AHOYCLI as a disposable demo or as a graphical app forced into a
terminal. It should feel like a complete, keyboard-first music instrument.

## Product decision

AHOYCLI is a separate product experience with a shared implementation
foundation:

```text
Ahoy Player  = visual local-first player with library, Deck, and tactile UI
AHOYCLI      = terminal-native local-first player for Linux, SSH, scripts, and
               fast keyboard control
shared core  = library schema, import rules, metadata normalization, queue,
               playback contracts, persistence, and product vocabulary
```

Keep both products in this repository initially. Do not create a second
repository unless AHOYCLI later develops an independent release cycle,
community, or runtime architecture.

## Repository context

This is a TypeScript/npm workspaces monorepo. Important existing areas:

```text
apps/desktop/       Electron visual player; Linux packaging already exists
apps/device-web/    browser/PWA player with real browser audio playback
apps/linux-kiosk/   large-screen Linux shell
apps/xbox-shell/    documentation boundary only
packages/core/      canonical types, reducers, navigation, contracts
packages/media-pipeline/
                    filename normalization, import validation, duplicates
packages/player-react/
                    shared React orchestration and list UI
packages/ui-dial/   Ahoy Dial and input mapping
packages/web-adapters/
                    browser persistence, files, and playback adapters
docs/AHOY_MANIFESTO.md
                    current product compass
docs/AHOY_PLAYER_SPEC.md
                    current product specification
docs/stack-and-architecture.md
                    shared/platform architecture
```

Current baseline verification:

```bash
npm test
npm run typecheck
npm run build
```

All three currently pass. Preserve that baseline.

## Product principles

Follow the manifesto in `docs/AHOY_MANIFESTO.md`:

- local is the default;
- imported music stays on the user’s device;
- ownership and file provenance should be visible and trustworthy;
- the Ahoy Dial is a shared intent language, not a requirement that every host
  look identical;
- the terminal should be fast, legible, calm, scriptable, and useful over SSH;
- AHOYCLI must not fork the library model or create a second account/library
  database;
- cloud identity, purchases, NFC, and sync are additive future capabilities,
  not requirements for local playback.

## Naming and packaging direction

Use the product name `AHOYCLI` in documentation and UI branding. Use lowercase
for commands and package identifiers:

```text
command:        ahoy
app directory:  apps/ahoycli
future package: @ahoy/cli
shared package: @ahoy/player-core
```

Do not prematurely publish to npm. First make the local CLI useful and testable.
When publishing becomes appropriate, npm is the initial default because the
repository and shared core are TypeScript. Keep the CLI package separate from
shared packages so it can eventually be installed globally:

```bash
npm install -g @ahoy/cli
ahoy library
ahoy import ~/Music
ahoy play
```

Do not target `pip` unless there is a deliberate future decision to rewrite or
rehost the CLI in Python. The current shared TypeScript foundation should be the
source of truth.

## First milestone

Build a useful command-mode CLI before attempting a sophisticated full-screen
TUI. The first milestone should support:

```bash
ahoy status
ahoy library
ahoy search "artist or title"
ahoy import ~/Music/song.mp3
ahoy import ~/Music
ahoy play <track-id-or-query>
ahoy pause
ahoy next
ahoy previous
ahoy queue
```

The exact syntax may improve during implementation, but commands should be
predictable, composable, and friendly to shell scripts. Human-readable output
is the default; provide a machine-readable option such as `--json` where it is
cheap and useful.

The minimum successful user loop is:

```text
install/run AHOYCLI
  → inspect an existing local library
  → import one or more MP3s
  → search/select a track
  → hear real audio
  → control playback from the terminal
  → restart and recover local state
```

## Architectural requirements

Reuse existing shared behavior wherever possible:

- `packages/core` for `TrackRecord`, `LibraryRecord`, `PlayerSnapshot`, queue
  behavior, playback state, and actions;
- `packages/media-pipeline` for filename parsing, validation, metadata fallback,
  and duplicate detection;
- existing persistence and import contracts where they fit;
- a new native adapter only where terminal/Linux I/O requires it.

Do not duplicate metadata parsing, track IDs, duplicate keys, queue reducers, or
library merge logic inside AHOYCLI.

The CLI host may own:

- argument parsing and command dispatch;
- terminal rendering and keyboard input;
- Linux filesystem discovery and file access;
- a native audio playback adapter;
- a local persistence location appropriate for a CLI app;
- signal handling, graceful shutdown, and terminal restoration.

Keep the shared `PlaybackAdapter` boundary explicit. The CLI should not fake
successful playback. If a real Linux audio backend is temporarily unavailable,
fail clearly with an actionable message and keep command-mode library features
working.

## Playback strategy

Investigate the smallest dependable Linux playback path first. Prefer a
well-supported system or Node-compatible backend over building an audio engine
from scratch.

Evaluate options against:

1. works on the developer’s Linux machine;
2. does not require a large native toolchain for ordinary installation;
3. supports play, pause, seek, next, previous, volume, and duration;
4. can resolve local file paths safely;
5. can later support a packaged npm CLI reasonably;
6. has a clear fallback/error path.

If the best first backend is an installed system player, isolate it behind an
adapter and document the dependency. Do not leak backend-specific commands
through the core model or CLI command vocabulary.

## Terminal UX direction

AHOYCLI should be:

- keyboard-first;
- readable in a narrow terminal;
- good over SSH;
- usable without color;
- color-enhanced when available;
- explicit about current track, status, duration, and errors;
- friendly to pipes and shell scripts;
- free of unnecessary dashboards, cards, or decorative animation.

The future TUI may provide:

```text
library browser | search | now playing | queue | transport status
```

But do not begin with a large TUI framework unless command mode and the playback
adapter are already sound. The terminal product should remain useful even when
running in a plain non-interactive shell.

## Suggested implementation sequence

1. Inspect the current repository and verify the baseline.
2. Add `apps/ahoycli` as a workspace with a minimal executable entrypoint.
3. Add command parsing and `--help`, `--version`, `status`, and `library`.
4. Add CLI persistence using a documented Linux-safe local path.
5. Connect MP3 import to the existing media pipeline and shared library merge.
6. Add `search`, `queue`, and track selection.
7. Implement and test a real Linux playback adapter.
8. Add `play`, `pause`, `next`, `previous`, seek, and volume.
9. Add graceful SIGINT/SIGTERM handling and state recovery.
10. Add focused unit tests and a manual Linux acceptance checklist.
11. Add an optional TUI only after the command mode is dependable.
12. Update the README and manifesto with what is actually working.

Keep commits small and understandable. After each coherent increment, run:

```bash
npm test
npm run typecheck
npm run build
```

## Acceptance criteria for the first usable version

The work is ready for a first real Linux trial when:

- `npm run dev` or the documented CLI command starts AHOYCLI reliably;
- `--help` explains the command model;
- a user can import one MP3 and a directory of MP3s;
- imports use the existing filename, folder, metadata, and duplicate rules;
- the library survives process restart;
- a user can search and select a track;
- real audio plays through the selected Linux backend;
- pause, resume, next, previous, and stop work;
- errors explain what to install or fix;
- output remains usable without ANSI color;
- tests cover command parsing, import wiring, persistence, and playback state;
- existing desktop, web, kiosk, and shared-package checks still pass.

## Things not to do yet

- do not create a second repository;
- do not copy or rewrite the core library model;
- do not add account login or cloud sync to make local playback work;
- do not build a fake TV/USB product without a tested hardware target;
- do not make the TUI the only interface;
- do not publish an npm package before installation and playback are reliable;
- do not hide native dependency failures behind simulated playback;
- do not delete or overwrite existing user changes or generated artifacts without
  checking their purpose first.

## Handoff opening prompt

Begin the next session by saying:

> I am continuing AHOYCLI in the Ahoy Player monorepo. Read
> `docs/AHOYCLI_HANDOFF.md`, `docs/AHOY_MANIFESTO.md`, and the current README.
> Inspect Git status before editing. Preserve existing changes. Verify the
> baseline, then implement the smallest next milestone toward a real Linux
> command-mode player using the shared Ahoy core. Do not create a second repo or
> duplicate the library model. Report what you found, what you changed, and the
> exact commands that pass.

