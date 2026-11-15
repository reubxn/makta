# Demo video pipeline

Produces `deck/matka-demo.mp4` (captions burned in), `deck/matka-demo-clean.mp4` (no captions, for a voiceover) and `deck/matka-demo.srt`. All three follow `deck/demo-script.md`.

## How it works

- **`timeline.mjs`** is the single clock. It sets the demo key presses, the one Helsinki click and the caption lines, all in demo time. It also sets the title and end card lengths and the crossfades. The total is 119.8 s.
- **`vclock.js`** is injected into the page before the app loads. It replaces `performance.now`, `Date.now`, the timers and `requestAnimationFrame` with a virtual clock that moves only when the recorder steps it. CSS transitions are paused and seeked to the same clock.
  - Without it, deck.gl in a GPU-less container draws about 1 frame a second, so a screen recording would stutter.
  - With it, every frame is exact. The app's animations step at 60 Hz, every second step is recorded (30 fps), and deck.gl draws once per recorded frame, after React commits, so the map and its DOM labels always match.
- **`record.mjs`** drives the built app with its own demo keys (`0`, `2`–`7`) and writes lossless masters to `out/` (gitignored).
  - The pointer is never shown by the browser. The Helsinki click gets a drawn cursor that glides along an eased arc. The real pointer moves once to hover, once to click, and then off the map over open sea, so the tooltip clears.
  - The run fails on any console error or any request that leaves localhost.
- **`cards/`** has the title and end cards, in the app's visual language. They're recorded with the same clock.
- **`captions.mjs`** renders each caption as a transparent strip for a fixed graphite band over the bottom 106 px of the frame (the app footer and map-caption row), and writes the SRT.
- **`build.mjs`** runs ffmpeg in this order:
  - title (3 s), crossfade 0.5 s, demo (100 s), crossfade 0.5 s, end card (17.8 s);
  - overlays the caption band and text, with 0.15 s fades, on the captioned version;
  - encodes H.264 with `-preset veryfast -crf 18`, yuv420p, 30 fps and faststart.

## Rebuild

```bash
npm run build && npx vite preview --port 4173 &   # the app, offline
node deck/video/record.mjs demo                     # ~15 min in a GPU-less container (camera moves ~1 s/frame)
node deck/video/record.mjs title
node deck/video/record.mjs end
node deck/video/captions.mjs
node deck/video/build.mjs
```

To change only a caption's wording or timing, edit `CAPTIONS` in `timeline.mjs`, then rerun `captions.mjs` and `build.mjs`. That takes about 1 minute. Changing `ACTIONS` means recording the demo again.

### Quick looks without a full recording

```bash
node deck/video/record.mjs demo --preview 1        # one PNG per second of demo time -> out/preview/
node deck/video/record.mjs demo --stills 14,37.5   # PNGs at these demo times -> out/stills/
```

## QA

- Stills were pulled from the final MP4 at every caption change and key moment, and checked against the app:
  - each caption matches what is on screen at that moment;
  - every number matches the app.
- Video time = demo time + 2.5 s.
