# AHOY ecosystem architecture

This document describes the intended relationship between the AHOY websites, the local Ahoy Player, physical NFC cards, and the shared AHOY identity.

## Product shape

AHOY should feel like one ecosystem to a user, even though its surfaces can be deployed separately:

```text
ahoy.ooo          umbrella brand, account, AHOY ID, profiles, devices
app.ahoy.ooo      discovery, public artist pages, releases, previews, marketplace
library.ahoy.ooo  personal library, metadata editing, playlists, downloads, sync
player.ahoy.ooo   player downloads, pairing, updates, support, device information
Ahoy Player       local-first playback device and applications
```

The domains are product surfaces, not separate identities. A user should sign in once and move between them through shared navigation and single sign-on.

## Authority boundaries

`ahoy.ooo` is the identity authority. It owns the public, stable AHOY ID and account relationships. The other surfaces are relying parties and must not create competing users or public identity systems.

The central identity model should distinguish:

```text
internal database ID  private implementation detail
AHOY ID               stable public cross-platform identity
username              user-facing handle, changeable by policy
email                 login/contact attribute, not an identity URL
device ID             one registered player, computer, or kiosk
```

Digital ownership should be represented by entitlements rather than by a generic merchandise/tip purchase row. An entitlement connects an AHOY ID to a digital asset, order, checksum, and access state.

## User journey

```text
discover at app.ahoy.ooo
  -> add or purchase
  -> entitlement recorded for AHOY ID
  -> release appears in library.ahoy.ooo
  -> library syncs to an Ahoy Player
  -> playback continues locally and offline
```

The player should not require the web for ordinary playback after authorized content has been downloaded. It should sync identity, metadata, and entitlement changes when connected.

## NFC cards

An NFC card is a physical pointer or collectible, not the audio storage medium. A card should contain a compact NDEF URL such as:

```text
https://app.ahoy.ooo/tap/card_01K...
```

The card endpoint resolves the public card ID, shows a public preview when logged out, and checks the user’s entitlement when logged in. It must never expose a permanent raw MP3 URL.

The intended connected flow is:

```text
tap card
  -> player reads card ID
  -> player identifies the AHOY account/device
  -> service resolves card and entitlement
  -> authorized asset downloads to local storage
  -> track/album is added to the local library
```

NFC tags cannot realistically store MP3 files. The player therefore needs network access during activation/sync, or a preloaded local package for an intentionally offline product variant.

## Ahoy Player boundary

The player owns local concerns:

- importing ordinary MP3 files
- filename and embedded metadata normalization
- duplicate detection
- local library storage
- queue and playback state
- offline playback
- Dial, keyboard, touch, remote, and gamepad controls
- local device storage and cache management

The cloud ecosystem owns account and rights concerns:

- AHOY ID authentication
- public profiles and devices
- discovery and marketplace records
- digital assets and manifests
- entitlements and download authorization
- NFC card registration and resolution
- revocation, replacement, and transfer policy

The current player repository already has the right seams: `PurchaseSyncAdapter`, `PurchaseTrackSource`, opaque source locators, and shared playback reducers. The purchase adapter is a contract only; the live AHOY connector and real audio adapter remain future work.

## Suggested API contract

The exact host may evolve, but the player needs equivalents of:

```text
GET  /api/account
GET  /api/devices
POST /api/devices/pair
GET  /api/library
GET  /api/entitlements
GET  /api/assets/{asset_id}/manifest
POST /api/assets/{asset_id}/download-authorizations
GET  /api/cards/{card_id}
```

Responses should use opaque public IDs, checksums, metadata, and short-lived download authorization. Storage paths, private bucket URLs, session secrets, and internal numeric IDs should remain server-side.

## Web-first deployment path

The first public deployment target is the web player, not Google Play or an arbitrary television USB port. The web app should become a usable installable PWA first:

- import MP3 files in the browser
- play them through the browser audio engine
- persist normalized metadata and playback state locally
- continue working offline after the app shell has been cached
- make the limitation clear that browser-selected files must be re-imported after a browser session ends

The web player is the proving ground for the shared library, Dial, touch controls, keyboard controls, and real playback adapter. Android/Google TV packaging and a physical NFC reader come after this path is stable.

A USB stick cannot make arbitrary software execute on any television. The later TV product should be one of:

```text
USB + small Linux/Android player computer + TV HDMI
Android TV app installed on a supported device
Dedicated Ahoy Player hardware with storage, NFC reader, and HDMI
```

The current Linux kiosk shell can eventually become a bootable USB image for a compatible small computer. It should not be described as a TV-compatible USB app until a target hardware profile and boot process are tested.

## Repository and deployment strategy

Separate repositories are reasonable because the existing sites have different release and deployment lifecycles. They should still share one documented identity and API contract rather than copying auth, users, or entitlement logic.

The current player repository is the implementation home for the local player and its platform hosts. `player.ahoy.ooo` can initially be a small download/support site; it does not need to become a second player backend.

Recommended sequence:

1. Make the web player usable with real browser audio and local imports.
2. Establish the public AHOY ID and central account contract.
3. Add digital asset and entitlement records to the canonical platform.
4. Build library sync and download authorization.
5. Add device pairing and NFC card resolution.
6. Package Android/Google TV or a Linux USB image for a defined hardware target.
7. Validate the physical USB/NFC workflow.

## Non-goals

This architecture does not require four user-facing dashboards, four login systems, or four independent databases. It also does not make NFC a DRM mechanism by itself. Authentication, entitlement checks, and download policy must remain server-controlled.
