# Design pass (end of Phase 2)

Every view captured at 1440×900 by `tests/e2e/design.spec.ts`
(`DESIGN_ROUND=<name> npx playwright test tests/e2e/design.spec.ts`).
Each round, a fresh design-critic sub-agent that had not seen the code judged the screenshots
and returned its top 10 fixes. Compare `round0-before/` with `round3-after/` (same file names).

## Round 1 (critique of round0-before → round1)
- Main message moved onto the map: a large headline "Utsjoki: X nights away · Helsinki: 0", computed live from the model.
- The bone lever no longer colours increases teal: values that go up (round trips, hours and cost, from retreatment) stay ink with an amber note.
- Bone totals: replaced four grey "0"s with a per-patient bone line and the note that no national count is published.
- Camera fits Finland and the selected county to the map panel; column height scales with zoom (no clipping).
- Provenance popover: max-height, flips upward, scrolls inside.
- Left panel scrolls with a fade; body text raised; slider card neutral; badges larger; goal chips plain text; stronger totals highlight; footer 14 px.
- Units table: units without a public page merged into one line; table text 15 px.

## Round 2 (critique of round1 → round2)
- Two-line headline (big figure line + "Helsinki: 0" line); story card switches with the indication.
- Popover rendered in a portal (it was being clipped by the panel's fade mask).
- Card with lever off shows the current value in ink and the short-schedule value as a muted hint.
- Totals strip: first figure is the hero (56 px); bone strip now summarises every patient beyond the threshold instead of repeating the card.
- Highlight is an inset ring with a soft tint; footer has its own band; memo source chips grouped per sentence ("S52 +4"), all sources shown on click.
- Linear colour ramp so the map visibly lightens when a lever switches on.

## Round 3 (critique of round2 → round3-after)
- Tagline "Same cancer, same treatment. Different distance." shown on the map above a 40 px headline.
- Evidence text in the left panel is a two-line summary ending on a full stop, with "More evidence" for the full statement.
- Card "after" hint on its own line; one-line amber note explaining why bone trips can rise.
- Badges sentence case ("Sourced", "Calc", "Assumption") at 12 px; popover narrower; pages padded above the footer.
- Thinner columns to reduce the "wall" in the south; story card moved to the empty top-right of the map.

Not done (logged in MORNING.md): a small inset map of Finland in the Lapland zoom; turning sourced parameters into static rows (the spec asks for a slider for every parameter).
