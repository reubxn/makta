# Matka deck

The Junction submission deck: `matka.pdf` (12 slides and 3 appendix pages, 16:9), one PNG per slide in `slides/`, and a 2-minute talk track in `notes.md`.

Every number is generated from the app's data, not typed:

1. `node deck/compute_numbers.mjs` runs the app's model (`src/model/metrics.ts`) on `public/data/` at the default parameters, re-runs the unit tests, and writes `numbers.json`.
2. `node deck/build.mjs` fills the slides and the talk track from `numbers.json`, `sources.json` and `parameters.json` into `deck.html`. Before it writes anything, it checks that each quoted sourced figure is in its source record.
3. `node deck/render.mjs` renders `matka.pdf` and `slides/*.png`. It fails if anything overflows a slide, and it traces every number in the slides and notes back to the repo data (`number_check.txt`).

Screenshots are real captures of the built app (`npm run build && npx vite preview --port 4173`, then `node deck/capture.mjs` and `python3 deck/crop.py`). Fonts are Zilla Slab and Inter (SIL OFL, licences in `fonts/`).
