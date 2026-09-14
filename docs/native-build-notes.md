# Native build notes

Updated 2026-09-14.

The native desktop application builds successfully with Rust stable:

- `cargo check -p ahoy-player`
- `cargo test --workspace` — 8 Rust tests passed
- `cargo build --release -p ahoy-player` — optimized Linux binary produced
- `npm test -- --run` — 16 JavaScript tests passed
- `npm run typecheck` — all workspaces passed

The release binary is approximately 34 MB and is written to `target/release/ahoy-player` by the normal build. A clean release build was also verified with an isolated target directory.

Debian packaging is prepared in `packaging/linux`, but cannot be completed until `cargo-deb` is installed in the build environment:

```bash
cargo install cargo-deb
packaging/linux/build-deb.sh
```

The current container does not provide `rustfmt`, so `cargo fmt --check` remains an environment follow-up. The application itself is intentionally launched manually on a graphical Linux session because this build environment has no desktop display available for a reliable GUI smoke test.
