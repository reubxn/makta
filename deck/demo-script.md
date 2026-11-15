# Matka: 2-minute live demo

For the AstraZeneca judges (innovation director and Medical Affairs). Scoring: actionability 30%, insight 25%, data 20%, execution 15%, clarity 10%.

**What each part scores on**
- **Clarity:** one human comparison, Helsinki against Utsjoki, lands by 0:15.
- **Data:** each lever has its trial and its numbers on screen.
- **Insight:**
  - the burden sits in the north and east, where the roadmap says palliative radiotherapy is used less;
  - only 1 of 12 units publishes its schedule.
- **Actionability:** a county memo with owners and 30-day steps, then the ask and a pilot.
- **Execution:** the flight, the lever and the terrain all run live.

## Before you start

1. Run it locally, offline. The backup is https://matka-hack-europe.vercel.app.

   ```bash
   npm ci && npm run build && npx vite preview --port 4173
   ```

   Then open http://localhost:4173.
2. Chrome, full screen, zoom 100%.
3. Press `0`. Park the mouse on the right panel, off the map.
4. Rehearse once on the presenting laptop:
   - the key 2 flight takes 8 seconds;
   - the key 5 terrain takes 6 seconds.

**The keys**

| Key | What it does |
|---|---|
| `0` | Reset everything |
| `1` | All of Finland |
| `2` | Utsjoki: flies the road to Oulu |
| `3` | Breast lever |
| `4` | Bone lever |
| `5` | Burden terrain |
| `6` | What units say |
| `7` | Lapland memo |
| `?` | List of keys |

## The script (2:00)

Say the lines as written. They're short on purpose: pause where there's a full stop.

| Time | What I say | What I press or click |
|---|---|---|
| 0:00 | "Two women. Same breast cancer, same treatment." | **Click Helsinki**, just right of the *HUS Helsinki* square. The tooltip should say *Helsinki · 0 nights away*. |
| 0:03 | "One lives in Helsinki. Nine minutes from the hospital. She sleeps at home every night." | Card: *To HUS, Helsinki · 3 km · 0 h 09 min*, *No nights away*. |
| 0:06 | "The other lives in Utsjoki. Her nearest radiotherapy unit is in Oulu…" | **Press `2`.** The camera flies the road from Utsjoki to Oulu. |
| 0:10 | "…676 kilometres away. Over nine hours, each way." | The counter stops at *676 km · 9 h 22 min*. |
| 0:14 | "Fifteen sessions: sixteen nights away from home." | Point at the 16 moons in the card. |
| 0:17 | "Same cancer, different distance. And 89 municipalities are more than 100 kilometres from their unit." | Caption under the map: *89 municipalities, home to 637,661 people*. |
| 0:22 | "Lever one: breast. For eligible patients, with no nodal radiotherapy…" | **Press `3`.** The lever flips on after a second. |
| 0:27 | "…five sessions in one week is at least as good as fifteen over three weeks." | Ten moons fade. |
| 0:31 | "That's the FAST-Forward trial: 4,096 patients, ten-year results." | |
| 0:34 | "For her, sixteen nights away become six." | Card: nights *16 → 6*, round trips *4 → 2*. |
| 0:37 | "Across Finland, about 17,500 machine sessions freed a year. That serves Goal 3: treatment within target times." | Totals: *Removed every year · 17,500 radiotherapy machine sessions freed*. |
| 0:43 | "Lever two: painful bone metastases. One 8 Gy session relieves pain as well as a longer course." | **Press `4`.** The lever flips on after a second. |
| 0:49 | "More patients need retreatment, and the model counts it. Nights away still fall, from 6.2 to 2.4." | Card: *6.2 → 2.4* nights. Trips go *2.2 → 2.4*, and the card says why. |
| 0:55 | "Yet in a Turku study, only seven percent of end-of-life courses were single sessions." | |
| 1:00 | "Now all of Finland. Height is nights away per patient. The north and east carry it." | **Press `5`.** The map flies out, tilts, and the terrain rises. |
| 1:05 | "Five sessions: sixteen nights become six." | The lever flips by itself at about 1:04 and the terrain sinks. |
| 1:08 | "And the national roadmap notes palliative radiotherapy is used less beyond 100 kilometres." | |
| 1:13 | "We had AI read the units' public patient pages. Every quote is checked against the page." | **Press `6`.** |
| 1:19 | "Only one of twelve units publishes which schedule it uses. So today's mix is an assumption you can set." | Headline: *1 of 12 units publishes…*. Point at the slider. |
| 1:26 | "Every county gets an action memo. Lapland has no unit. 20 of its 21 municipalities are beyond 100 kilometres." | **Press `7`.** The memo writes itself in 4 seconds. |
| 1:33 | "Three proposals, each with an owner and a first step within 30 days. Nine of nine numbers traced to sources." | Badge: *9 of 9 numbers traced to the sourced facts*. |
| 1:40 | "We recommend three things. Five sessions as the default for eligible breast patients, naming distance as a reason." | **Press `1`.** Back to Finland; the totals show what's removed. |
| 1:46 | "A single 8 Gy session as the default for uncomplicated painful bone metastases." | |
| 1:51 | "And every unit publishes its schedule mix by distance, every year." | |
| 1:55 | "Our ask: help us start a six-month pilot with Lapland and OYS, beginning with the memo's 30-day review." | Stop. Hands off the keyboard. |

**If something goes wrong mid-demo**
- Keys 3 and 4 act on the selected municipality, so if you skipped `2`, press `2` first.
- A key pressed during the flight cancels it. Press `2` again.
- If the click lands on Espoo or Vantaa, say "twenty minutes from the hospital" (Espoo is 19 min, Vantaa 25 min). Both have no nights away.
- If the map goes blank, press `0`, then carry on from the next key.

## 30-second fallback (if the live demo breaks)

First try the backup: https://matka-hack-europe.vercel.app, or play `deck/matka-demo.mp4` muted. If nothing works, say this:

> "Two women, same breast cancer, same treatment. In Helsinki, she sleeps at home every night. In Utsjoki, her radiotherapy is 676 kilometres away in Oulu: sixteen nights away from home. For eligible patients, five sessions in one week is at least as good as fifteen. Her sixteen nights become six, and Finland frees about 17,500 machine sessions a year. Only one of twelve units publishes its schedule. We recommend five sessions and a single 8 Gy session as defaults, and publishing the schedule mix by distance. Our ask: a six-month pilot with Lapland and OYS."

## Likely questions from Medical Affairs

Source ids are in the app's *Sources & limitations* tab.

1. **"Are you saying five sessions is better than fifteen?"**
   No. FAST-Forward (4,096 patients) found 26 Gy in 5 fractions non-inferior to 40 Gy in 15, with a similar level of cancer control at 10 years [S9, S10, S11, S13]. So we say "at least as good", never "better", and we make no survival claims for either short schedule.

2. **"Which breast patients does this apply to? What about nodal radiotherapy?"**
   Only eligible patients: whole breast or chest wall without nodal radiotherapy, where the RCR recommends 26 Gy in 5 [S15]. With nodes, 40 Gy in 15 stays standard [S14]. In the model, 70% of new cases get radiotherapy and 60% of those are eligible. Both are visible, editable assumptions, because we found no citable Finnish share.

3. **"A single 8 Gy session means more retreatment. Doesn't that cancel the benefit?"**
   It's in the model. A review of 29 trials found the same pain response (61% vs 62%) but more retreatment (20% vs 8%) [S30, S31], so each patient's expected course includes 0.2 of an extra single session. Nights away still fall from 6.2 to 2.4 beyond 100 km. Expected trips rise slightly, from 2.2 to 2.4, and the card says so.

4. **"Nobody knows what schedules Finnish units use today. Aren't your totals invented?"**
   The current mix isn't public, and that is a finding. Of 12 units, only Jyväskylä's pages state a usual breast schedule: 15 sessions, though its leaflet says "5 or 15" [S65, S66]. Oulu's page says "1 to 4 weeks" [S68]. So the share already on 5 sessions is a visible dial, set to 20% by default. At 50%, the 17,500 sessions freed become about 10,900; at 80%, about 4,400. The bone baseline of 7% comes from one Turku study, 2005 to 2013, and covers all end-of-life courses [S16].

5. **"Where does 'about 1,750 patients a year' come from?"**
   It starts from 5,204 new breast cancers in women on the mainland in 2024 (Cancer Registry, 5,232 nationally) [S33, S34]. We multiply by 70% treated with radiotherapy, 60% eligible and 80% not already on 5 sessions. Cases are allocated to municipalities by age-weighted female population and scaled to county counts. They are calculated, not registry counts per municipality.

6. **"Will freed machine sessions actually shorten waiting times?"**
   They free capacity: 10 sessions per patient switched, about 17,500 a year nationally. Whether waits fall depends on how units use that capacity. So we file it under the Goal 3 indicator "patients receive treatment within target times" [S24, S25] and propose measuring it in the pilot, rather than claiming it.

7. **"Distances from municipality centres and 'stays overnight beyond 100 km' are crude. How robust is this?"**
   Both are labelled:
   - distances are road routes (OSRM) from each municipality's centre point [S59, S60];
   - the 100 km threshold is an assumption framed by the roadmap's 100 km fact on p. 13, which cites Norwegian data [S21, S29].

   At 50 km or 150 km, nights removed change (about 6,300 or 710 a year). The 17,500 machine sessions don't change, because they don't depend on distance.

8. **"Schedule choice is a clinical decision. Is this an app telling clinicians what to do?"**
   No. Matka proposes and doesn't prescribe, and every view says so. Every memo's first step is a clinical-team review within 30 days, with an owner role, not a named person. No medicine is involved: the pilot publishes the schedule mix by distance, and the clinical team reviews its own defaults.

## Numbers on screen (for quick reference)

| What | Value | Kind |
|---|---|---|
| Helsinki → HUS | 3 km, 9 min, 0 nights away | Calculated (OSRM, centre point) |
| Utsjoki → Oulu (OYS) | 676 km, 9 h 22 min | Calculated |
| Utsjoki, breast, 15 → 5 sessions | Nights 16 → 6 · round trips 4 → 2 · hours 75 → 37 · Kela at least €2,107 → €1,013 | Calculated |
| Utsjoki, bone, 5 → 1 session | Nights 6.2 → 2.4 · round trips 2.2 → 2.4 · hours 40 → 45 | Calculated, with retreatment |
| Beyond 100 km by road | 89 municipalities, 637,661 people | Calculated |
| Eligible breast patients still on 15 sessions | About 1,750 a year | Calculated from 3 assumptions |
| Removed a year, breast lever | 17,500 machine sessions · 1,950 nights · 15,900 round trips · 16,200 hours | Calculated |
| FAST-Forward | 4,096 patients, non-inferior, 10-year results | Sourced |
| Bone retreatment | 20% vs 8%; pain response 61% vs 62% | Sourced |
| Turku single sessions | 7% of courses in the last year of life (2005 to 2013) | Sourced |
| Units publishing their schedule | 1 of 12 | Calculated from AI-read pages |
| Lapland | No unit; 20 of 21 municipalities beyond 100 km; memo 9 of 9 numbers traced | Sourced and calculated |

## The video

- `deck/matka-demo.mp4`: 1:59.8, 1920×1080, with captions burned in.
- `deck/matka-demo-clean.mp4`: the same video without captions, for recording your own voiceover.
- `deck/matka-demo.srt`: the captions as a subtitle file.

The video follows this script with a 2.5-second offset: a 3-second title card, then the demo from 0:00 to 1:40, then an end card with the recommendation and the ask in place of the 1:40 to 2:00 part. For the voiceover, start the 0:00 line at 0:02.5 in the video. How to rebuild it is in `deck/video/README.md`.
