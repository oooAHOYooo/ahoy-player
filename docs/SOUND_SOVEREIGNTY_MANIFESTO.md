# Ahoy Player: Sound Sovereignty

**Status:** research-backed product manifesto  
**Written:** 2026-09-09

Ahoy is a player for people who own their music. That ownership should reach
all the way into the sound: the listener should know what is happening to the
signal, be able to change it without hunting through a settings maze, and be
able to turn every convenience off.

## The short version

Herdr is not the music engine.

Herdr is a useful local companion for completion and attention sounds. Its own
configuration describes local MP3 notification playback, per-agent on/off
overrides, and platform fallbacks such as `afplay`, `paplay`, `pw-play`, and
`mpv`. That is exactly the right scope for “Ahoy needs you” or “import done”
signals. It should not sit between a user’s music file and the player output:
it has no library, queue, transport, gapless, ReplayGain, DSP, or device
control model.

Ahoy’s music path should remain a first-class playback adapter owned by Ahoy:

```text
local file
  -> decoder / media element
  -> explicit loudness policy (optional)
  -> user gain and mute
  -> optional user DSP
  -> selected output device
```

The important word is **explicit**. A listener may choose “flat and faithful,”
“steady volume,” “night listening,” or a custom chain, but the player must show
which choice is active and what it changes.

## What other players teach us

VLC makes a broad DSP vocabulary discoverable: graphic EQ, compressor,
spatializer, stereo widener, and pitch controls. Its lesson is breadth, but
also a warning: effects need clear enable states and safe defaults.

MusicBee treats listening context as real product behavior: album-vs-track
ReplayGain, optional crossfade, smooth stopping, dynamic normalization, and
logarithmic volume scaling. Its best idea for Ahoy is not “add every knob”; it
is to separate album continuity from playlist loudness.

MPD is a strong model for honest power-user control. It exposes ReplayGain
mode, preamp, missing-tag behavior, peak limiting, crossfade duration, and
MixRamp as runtime settings. It also documents the tradeoff: software gain is
not bit-perfect, while crossfade can require matching formats or resampling.

Audirvana demonstrates the value of naming the volume layer. Its guidance
distinguishes internal software volume from device volume and explains when a
nominal hardware level avoids unnecessary attenuation or boost.

The synthesis for Ahoy is simple:

1. **Transport first:** play, pause, seek, previous, next, repeat, queue, and
   gapless transitions must be reliable before decorative DSP.
2. **One obvious volume:** a responsive, logarithmic-feeling control with mute,
   keyboard/media-key support, and a visible numeric or dB readout.
3. **Two loudness intentions:** “preserve album dynamics” and “steady playlist
   volume.” Never silently apply one when the other was intended.
4. **Effects are opt-in:** every EQ, compressor, spatial, or balance change has
   a visible bypass and a one-click flat/reset state.
5. **No magic clipping:** gain changes should provide headroom or a limiter
   choice and should never imply that 200% volume is free.

## How to maximize user control without making a cockpit

Ahoy should expose control in layers:

### The deck

- play/pause, previous/next, seek, queue, repeat, mute, and volume;
- current volume as a persistent user preference, not a component-local value;
- a small “sound state” label: `FLAT`, `ALBUM`, `TRACK`, `NIGHT`, or `CUSTOM`;
- hardware media keys and lock-screen/media-session integration where the host
  supports it.

### The sound panel

- preamp/output gain in dB;
- left/right balance and mono switch;
- ReplayGain: off, album, track, or auto;
- peak protection: off or on, with the consequence explained;
- crossfade: off or a duration, with “never crossfade within an album”;
- a transparent signal-chain summary and bypass-all button.

### The advanced room

- a small parametric or graphic EQ;
- compressor controls only after a plain-language preset exists;
- optional stereo/spatial tools, clearly labeled as coloration;
- per-device or per-host profiles later, never required for normal playback.

The order matters. A beautiful equalizer cannot compensate for a broken seek,
an untrustworthy queue, or a volume slider that changes pixels but not sound.

## Current-build audit

The repository’s current checks are green:

- `npm test`: **12 tests passed** across 3 test files.
- `npm run typecheck`: **all workspaces passed**.
- `npm run build`: **desktop, web, and Linux kiosk bundles passed**.

The build is therefore a healthy foundation, not yet a sound-sovereignty
release. The audit found these concrete gaps:

- The shared core already has `PlaybackState.volume` and a `set-volume`
  reducer command.
- `BrowserAudioPlaybackAdapter` has `setVolume`, but the React player model
  does not expose a volume action or call that adapter method.
- The web slider currently owns a local `useState(72)`, so its visual value is
  not connected to the actual audio adapter or persisted playback snapshot.
- The browser adapter starts with a model volume of `0.82`, while the
  `HTMLAudioElement` is not initialized from that value.
- Desktop and kiosk still use `SimulatedPlaybackAdapter`; their controls can
  express playback state without producing real audio.
- There is no ReplayGain/tag scan, EQ/DSP graph, balance, output-device choice,
  crossfade, or Media Session wiring yet.

This is a useful truth to preserve: the product has the right seams, but the
sound contract is not connected end to end.

## The build order

### Now: make the existing promise true

1. Add `setVolume` to `useAhoyPlayer` and route it through the adapter.
2. Bind the web slider to `playback.volume`; persist it with the snapshot.
3. Initialize the browser audio element from the restored volume.
4. Subscribe the shared model to adapter transport updates so duration,
   position, ended, and errors cannot drift apart.
5. Add tests for volume clamping, persistence, adapter invocation, and the
   browser adapter’s initial volume.
6. Replace desktop simulation with a real host adapter or explicitly label the
   desktop build as preview-only until that path is real.

### Next: trustworthy listening

1. Add Media Session metadata and action handlers.
2. Add gapless transition tests using known fixtures.
3. Read ReplayGain tags where available and expose off/album/track/auto.
4. Add peak-aware headroom and a plainly labeled protection policy.
5. Add crossfade only as a deliberate queue setting, with album protection.

### Later: expressive sound

1. Introduce a Web Audio graph for the web host: source → gain → optional
   filters/compressor → destination.
2. Save named presets, but keep the raw settings inspectable and exportable.
3. Add output-device selection only where the host can report it reliably.
4. Add per-device profiles after the global model is stable.

## Non-negotiable vows

- No network connection is required to play owned local files.
- No automatic loudness processing is hidden.
- No “louder” control is allowed to masquerade as fidelity.
- No effect ships without bypass and reset.
- Album order and dynamics are treated as authored, not inconvenient.
- The user can always answer: **what is playing, what changed the signal, and
  how do I get back to flat?**

Ahoy should feel like a small instrument with a big memory: tactile enough to
invite play, honest enough to trust, and open enough to let a listener make the
last decision.

## Research notes

- [Herdr configuration: sound notifications](https://dontreadthisline.github.io/herdr/docs/configuration/)
- [VLC Desktop Documentation: Adjustment & Effects](https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/settings/adjustmentsandeffects.html)
- [MusicBee Player Preferences](https://musicbee.fandom.com/wiki/Player_Preferences)
- [MPD user documentation: ReplayGain and crossfade](https://github.com/MusicPlayerDaemon/MPD/blob/master/doc/user.rst)
- [Audirvana: volume control and ReplayGain](https://audirvana.freshdesk.com/en/support/solutions/articles/202000050819-which-volume-setting-can-i-change-in-audirv%C4%81na-)
- [MDN: Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MDN: Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
