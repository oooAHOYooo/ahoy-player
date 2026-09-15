# Handoff: Linux GUI + CLI Packaging

## Objective

Turn Ahoy into a coherent, installable Linux product where one installation provides both:

- `ahoy-player` — the native graphical desktop player
- `ahoy` — the terminal CLI/TUI companion

The product brand remains **Ahoy Player**.

## Repository context

- Repository: `/home/ag/Projects/ahoy-player`
- Primary target machine: x86_64 Arch Linux/Omarchy, Wayland/Hyprland
- Rust/Cargo is installed and the native GUI release build succeeds.
- Local audio tooling available on the development machine includes `mpv` and `ffplay`.
- Native GUI: `apps/native`, Rust + Slint + Rodio
- Current terminal companion: `apps/terminal`, Node.js CLI/TUI
- Root Cargo workspace currently includes the native GUI.
- Existing Linux packaging script: `packaging/linux/build-deb.sh`
- Existing desktop entry: `packaging/linux/ahoy-player.desktop`
- Download page: `apps/device-web/public/download.html`

## Naming decision

Use these user-facing executable names:

```text
ahoy-player   # GUI
ahoy           # CLI/TUI
```

Keep `ahoy` as the short terminal command. Do not rename it to `ahoy-player-cli` unless a real technical conflict is discovered. The package and documentation should explicitly explain that both commands are part of Ahoy Player.

## Current state and known issues

1. The Rust GUI builds as an x86-64 Linux executable:

   ```bash
   cargo build --release -p ahoy-player
   ```

2. The current CLI is Node-based rather than Rust-based. It supports scanning MP3 folders, listing/searching the library, playback, and a TUI. It delegates playback to `mpv`, VLC, or `ffplay` on Linux.

3. The GUI and CLI currently have separate implementations and storage conventions:

   - GUI data normally lives under `~/.local/share/ahoy-player`.
   - CLI data currently lives under `~/.ahoy-player`.

   Decide whether to migrate both to a shared documented path. Avoid silent data loss; provide migration or compatibility handling if changing the CLI path.

4. The checked-in packaging script currently builds a Debian package with `cargo-deb`, but the repository does not yet provide a complete verified Arch/pacman or AppImage build pipeline.

5. The download page currently contains Linux links for pacman and AppImage artifacts. Do not assume those links are valid. Verify them or update the page so it does not advertise artifacts that the repository cannot produce and verify.

6. A GUI process launched from an automated shell previously failed to connect to the available Wayland compositor. This may be an environment limitation rather than an application failure. Test GUI startup in the real graphical session when possible and report any limitation precisely.

## Preferred implementation direction

### Rust architecture

If practical, create a shared Rust crate for reusable library, metadata, filesystem, and playback behavior. Add a Rust CLI/TUI binary named `ahoy` to the Cargo workspace.

The GUI and CLI should share:

- track and library data models
- MP3 import and metadata fallback behavior
- duplicate detection rules
- local persistence format/path
- playback abstractions where practical

Do not create two divergent implementations of core library behavior.

If a complete Rust CLI migration is too large for one safe change, implement the smallest coherent milestone and document the remaining work. A fragile partial rewrite is not acceptable.

### Packaging

Start with Arch Linux because it matches the primary development machine. Add or repair a package that installs both:

```text
/usr/bin/ahoy-player
/usr/bin/ahoy
```

Preserve the GUI desktop entry and include required runtime dependencies.

Add Debian packaging if practical.

Treat AppImage separately. An AppImage can contain both binaries, but it does not automatically place `ahoy` on the user’s PATH. Either document that limitation or provide an appropriate installation/integration mechanism. Do not describe an AppImage as installing the CLI globally unless that is genuinely implemented.

## Download/release requirements

- Make the download page accurately describe the GUI and CLI relationship.
- Do not leave download links pointing to nonexistent or unverified artifacts.
- Use consistent artifact names and versions.
- Add checksums where appropriate.
- Prefer a repeatable release script or CI workflow that builds the GUI and CLI together.
- Do not commit, push, publish releases, or delete existing artifacts unless explicitly requested.

## Required verification

Run the relevant checks, including:

```bash
cargo test --workspace
cargo check -p ahoy-player
cargo build --release -p ahoy-player
npm run typecheck --workspace @ahoy/player-terminal
npm test --workspace @ahoy/player-terminal
```

Then build the selected Linux package and inspect its contents. Confirm both commands are included and executable.

Exercise the installed or staged product with:

```bash
ahoy --help
ahoy scan <test music directory>
ahoy library
ahoy tui
ahoy-player
```

Verify that GUI and CLI library data remain compatible and that neither corrupts the other’s state. Verify audio playback on Linux where the environment permits it.

If graphical testing is blocked by the compositor/session, complete all non-GUI checks and report the exact blocker.

## Deliverables

- Implement the changes directly in the repository.
- Update README and relevant packaging/native-build documentation.
- Add focused tests for shared library compatibility and packaging.
- Show final `git diff` and `git status`.
- Summarize what works, what was verified, and any remaining release blockers.
