# Native build notes

Updated 2026-09-14.

The native desktop application is the shared macOS/Linux product and builds with Rust stable:

- `cargo check -p ahoy-player`
- `cargo test --workspace` — 8 Rust tests passed
- `cargo build --release -p ahoy-player` — optimized Linux binary produced
- `cargo build --release -p ahoy-player` — macOS release binary when run on macOS
- `npm test -- --run` — 16 JavaScript tests passed
- `npm run typecheck` — all workspaces passed

The release binary is approximately 34 MB and is written to `target/release/ahoy-player` by the normal build. A clean release build was also verified with an isolated target directory.

Debian packaging is prepared in `packaging/linux`, but cannot be completed until `cargo-deb` is installed in the build environment:

```bash
cargo install cargo-deb
packaging/linux/build-deb.sh
```

The macOS development loop is the preferred visual workflow: run `cargo run -p ahoy-player` on a graphical Mac, iterate on `apps/native/ui/main.slint`, and then run the same Cargo target on Linux for platform smoke testing. The current container does not provide `rustfmt` or a desktop display, so GUI smoke testing remains a host follow-up.
