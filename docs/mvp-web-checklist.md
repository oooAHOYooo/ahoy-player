# Ahoy Player web MVP

The first shippable MVP is an installable web player, not a television app or native iOS download client.

## Included now

- Browser MP3 import
- Embedded metadata and filename/folder fallback
- Duplicate detection
- IndexedDB persistence for imported media blobs
- LocalStorage persistence for library metadata and playback state
- Real browser audio playback
- Touch Dial, keyboard, pointer, and gamepad input
- PWA manifest, service worker, and install prompt where the browser supports it
- iPhone/iPad Home Screen metadata

## User promise

“Import your own MP3s, install Ahoy Player, and play them from this device.”

The web MVP does not upload private MP3 files to AHOY. The files remain in browser-managed local storage. Users should still be warned that private browsing, clearing site data, browser storage eviction, or device replacement can remove the local media cache.

## Not included yet

- AHOY ID login and cross-device library sync
- app.ahoy.ooo purchase entitlement sync
- NFC card resolution and physical NFC reader support
- Native Android/Google TV package
- iOS App Store package
- USB boot image or dedicated player hardware
- File System Access API folder permissions

## Acceptance test

1. Open the web app in a supported browser.
2. Import one or more MP3 files.
3. Select a track and confirm audible playback.
4. Reload the page and confirm the track remains listed and playable.
5. Install the PWA where the browser offers installation.
6. Close and reopen the installed app and confirm the library remains available.

The next MVP increment should add a small AHOY card landing route that resolves a public card ID and offers “Add to my library” after account/entitlement support exists.

## Render preview

The repository includes `render.yaml` for a Render Static Site. In the Render Dashboard, choose **New → Blueprint** and select the `oooAHOYooo/ahoy-player` repository. Render will use:

```text
Build: npm ci && npm run build --workspace @ahoy/player-web
Publish: apps/device-web/dist
```

After the first deploy, add `player.ahoy.ooo` as a custom domain in the service settings. Add a link to that URL from `ahoy.ooo` and `app.ahoy.ooo`. The wildcard rewrite in the blueprint keeps future client-side routes working.
