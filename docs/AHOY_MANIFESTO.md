# The Ahoy Player Manifesto

**Status:** living product compass  
**Last updated:** 2026-09-09

Ahoy Player is a personal music object for people who own files, care about
where they live, and want playback to remain useful when the network is gone.

It is not a streaming catalog, an account dashboard, or a wrapper around a
remote service. It is the place where a person’s music becomes tangible:
imported, understood, browsed, played, and kept close.

## What we believe

- **Local is the default.** A person’s own music should play without a login,
  upload, subscription, or network connection.
- **Ownership should be visible.** File location, import state, metadata
  provenance, and device storage are meaningful parts of the experience, not
  implementation details to hide.
- **Playback is an activity, not a page.** The interface should make choosing,
  listening, and moving through a collection feel immediate and physical.
- **The Ahoy Dial is a language.** Turn, select, back, next, and play are the
  shared intent model across mouse, keyboard, touch, remote, gamepad, desktop,
  kiosk, and terminal.
- **Quiet software earns trust.** The product should be calm, legible, direct,
  and resilient instead of noisy, manipulative, or overloaded with decoration.
- **The ecosystem is additive.** AHOY ID, purchases, NFC cards, and sync may
  enrich a local library; they must not make ordinary local playback dependent
  on the cloud.

## Product shape

There is one Ahoy Player and many ways to inhabit it:

```text
shared core
  ├─ traditional desktop player       rich visual library + Ahoy Deck
  ├─ touch/web player                 installable, browser-local playback
  ├─ Linux kiosk                      room-scale player for defined hardware
  └─ terminal host                    fast, scriptable, keyboard-first control
```

These are hosts, not separate product identities. They share the canonical
library model, playback state, queue behavior, persistence contracts, and
navigation actions. Each host is allowed to have its own strengths and
constraints.

## The terminal decision

The terminal app should begin as an **Ahoy Player CLI/TUI host**, living in this
repository and using the shared packages. It should act like its own little
player while remaining the same player underneath.

The first terminal slice should be deliberately small:

1. inspect the local library and playback state;
2. import a file or folder of MP3s;
3. search and choose a track;
4. play, pause, seek, and move through the queue;
5. expose useful commands for scripts and vibe-coding workflows.

The TUI can later become a full-screen tactile surface, but a plain command
mode should remain available for SSH, automation, debugging, and low-resource
Linux machines. The terminal host must not fork metadata rules or invent a
second account/library database.

## What Ahoy is not

- not a generic streaming dashboard;
- not a cloud-first locker for private files;
- not a fake universal TV/USB product without a tested hardware target;
- not four independent apps that slowly disagree about what a track is;
- not skeuomorphic nostalgia for its own sake.

## Current truth

Today the repository has a working shared TypeScript foundation, real browser
audio playback, local MP3 import and normalization, duplicate detection, a
desktop Electron shell, a touch PWA, and a Linux kiosk shell. The desktop and
kiosk playback adapters are still simulated, and there is no terminal host yet.

The next proof point is not more surface area. It is a dependable Linux loop:

```text
start on Linux → import local MP3s → see a trustworthy library → hear a track
→ control it from keyboard/terminal → close and resume locally
```

## Decision filter

When choosing what to build next, ask:

1. Does this make a person’s own music easier to keep, understand, or play?
2. Does it work locally and degrade honestly when disconnected?
3. Can the behavior be shared while the host remains native to its medium?
4. Does it make Ahoy feel more like a calm instrument than a content feed?

If the answer is no, it belongs in the backlog, not in the critical path.

## Related documents

- [Product specification](./AHOY_PLAYER_SPEC.md) — current surface and
  capability inventory.
- [Stack and architecture](./stack-and-architecture.md) — code boundaries and
  adapters.
- [Ecosystem architecture](./ecosystem-architecture.md) — AHOY identity,
  purchases, and NFC boundaries.
- [Historical megaprompts](./megaprompts.md) — source material, not operating
  instructions.
