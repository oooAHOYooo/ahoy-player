# Ahoy MP3 Player Megaprompts

> Historical design input only. This file is not an operative build instruction; the repository README and current user request define the implementation.

## 1. UI direction megaprompt

```text
Design an MP3 player interface for a product called Ahoy MP3 Player.

The product has an original circular navigation system called the Ahoy Dial. It must feel like a premium music object from an alternate timeline, with a cinematic, artful, slightly maritime identity. Do not reference or imitate any existing consumer music player.

Priorities:
- tactile navigation
- instantly legible hierarchy
- minimal text clutter
- surprising but disciplined motion
- album, playlist, and song browsing that feels satisfying even before playback starts

Constraints:
- avoid skeuomorphic overload
- avoid generic streaming-app layouts
- avoid purple gradients and startup-app aesthetics
- keep typography distinctive and intentional
- prefer restrained copy and diegetic labels
- support desktop and touch adaptations from the same navigation model

Invent:
- the visual language
- the menu structure
- the Ahoy Dial interaction model
- the now-playing screen
- the library/import screen
- motion rules
- empty states

Deliver:
- product design principles
- screen inventory
- interaction model
- visual tokens
- a sample layout for desktop
- a sample layout for touch/device
```

## 2. Functionality megaprompt

```text
Act as a principal product engineer helping design the first functional architecture for Ahoy MP3 Player.

We are building a cross-platform music player with:
- a desktop app for macOS and Windows
- a device-friendly web shell
- local MP3 upload for now
- metadata stripping/normalization into a clean local library
- a future sync path to app.ahoy.ooo purchases

Goals:
- propose modules and boundaries
- define the import pipeline
- define the canonical track/library schema
- define playback, queue, and persistence state
- design the adapter boundary for future AHOY purchase sync
- call out tradeoffs clearly

Bias toward:
- TypeScript
- shared core logic
- desktop-first delight
- clean migration path

Output:
- architecture diagram in text
- folder structure
- API contracts
- state model
- milestone plan
- explicit risks and unknowns
```

## 3. Interaction tuning prompt

```text
You are refining the navigation feel of Ahoy MP3 Player.

The product should feel tactile, confident, and slightly uncanny in a good way, like a music device from a different timeline.

Focus only on interaction:
- wheel rotation behavior
- acceleration and deceleration
- menu depth
- selection sounds or silence
- transitions between browsing and now-playing
- keyboard and touch equivalents

Do not redesign the whole product.

Deliver:
- 3 interaction models
- pros/cons of each
- the best recommendation
- implementation notes for React
```

## 4. Metadata import prompt

```text
Help design a robust local music import system for Ahoy MP3 Player.

Current requirement:
- users choose local MP3 files
- the app strips or ignores embedded metadata
- the app normalizes each song into a clean internal schema
- the library can still display sensible title/artist/album values

Assume many files have bad metadata, inconsistent filenames, or missing artwork.

Design:
- import stages
- fallback parsing rules
- normalized schema
- duplicate detection strategy
- persistence strategy
- future compatibility with marketplace-bought tracks from app.ahoy.ooo
```

## 5. Cross-platform build megaprompt

```text
Build Ahoy Player as one shared music product with multiple platform shells.

Product direction:
- Ahoy Player is a local-first music library and playback product, with a future connection to purchases from app.ahoy.ooo.
- Its signature navigation system is called the Ahoy Dial: a tactile circular control concept with menu, select, back, next, and play actions.
- The experience should be original, calm, cinematic, and deliberate. Do not imitate or reference an existing consumer music player.

Architecture requirement:
- Use a TypeScript monorepo.
- Keep library schema, playback state, queue behavior, import normalization, navigation actions, persistence contracts, and future purchase-sync contracts in shared packages.
- Create separate hosts instead of one compromised universal app:
  - Electron + React for macOS, Windows, and Linux desktop.
  - React PWA for touch devices and the web.
  - React big-screen kiosk shell for a Linux media box attached to a TV.
  - An Xbox shell boundary only; do not fake an Xbox package or assume desktop APIs work there.
- Reuse shared React UI where appropriate, but give each host its own input and storage adapters.

First functional milestone:
- Import local MP3 files.
- Ignore or strip embedded tags from the display model.
- Build a normalized local library using filename fallback rules.
- Display library, artists, albums, imports, and a now-playing state.
- Make keyboard, mouse/touch, remote-style arrows, and gamepad intent map into the same navigation actions.
- Use mock playback state if a real audio engine is not ready, but keep the playback adapter boundary explicit.

Deliver:
- the monorepo folder structure
- canonical TypeScript types
- platform adapter interfaces
- import and duplicate-detection pipeline
- navigation action model for the Ahoy Dial
- initial working desktop and Linux-kiosk screens
- a clear list of what is shared and what is platform-specific
- build and verification instructions

Guardrails:
- Do not build a generic streaming dashboard.
- Avoid default SaaS styling, purple gradients, and excessive cards.
- Keep labels short and functional.
- Make the TV surface legible from across a room.
- Do not tie marketplace implementation details into the local-first prototype.
```
