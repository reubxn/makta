# Matka: 2-minute demo

For the AstraZeneca judges (innovation director and Medical Affairs). Scoring: actionability 30%, insight 25%, data 20%, execution 15%, clarity 10%.

Tell it as what happened: what we read, the problem we found, the evidence, what we built, what we're asking for.

**Two voices**
- **A is you.** You open and close (0:00–1:04 and 1:40–2:00), facing the judges.
- **B is Balint.** He takes the middle (1:04–1:40), stays at the laptop, and presses every key and the one click.
- If Balint should open instead, just swap the letters.

Don't learn it word for word. Know the beats and say them your way. Only the **bold** numbers have to be exact.

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

| Time | Who | What we say | What B presses or clicks |
|---|---|---|---|
| 0:00 | A | "So for the AstraZeneca challenge, we started with Finland's national cancer roadmap. One line stuck with us: people more than **100 km** from a radiotherapy unit get less palliative radiotherapy." | Nothing. The map of Finland is up, with every route to its unit. |
| 0:10 | A | "So, take two women with the same breast cancer. One lives in Helsinki. She's **nine minutes** from the hospital, and home every night." | **Click Helsinki**, just right of the *HUS Helsinki* square. The tooltip should say *Helsinki · 0 nights away*. |
| 0:17 | A | "The other lives up in Utsjoki. Her nearest unit is in Oulu…" | **Press `2`.** The camera flies the road down to Oulu. |
| 0:22 | A | "…which is **676 km** away. More than nine hours each way." | The counter stops at *676 km · 9 h 22 min*. |
| 0:25 | A | "And fifteen sessions means **sixteen nights** away from home." | The card shows the 16 moons. |
| 0:28 | A | "So then we looked at the evidence, and found two shorter schedules that are already backed by trials." | |
| 0:33 | A | "First, breast. If the lymph nodes don't need treating, **five sessions** in one week is **at least as good** as fifteen over three." | **Press `3`.** The lever flips on after a second and ten moons fade. |
| 0:42 | A | "That's from FAST-Forward, which had over **4,000** patients." | |
| 0:44 | A | "So for her, sixteen nights turns into **six**." | Card: nights *16 → 6*. |
| 0:47 | A | "And across Finland, that frees up about **17,500** radiotherapy sessions a year." | Totals: *17,500 radiotherapy machine sessions freed*. |
| 0:51 | A | "Second one's painful bone metastases. One **8 Gy** session relieves pain as well as a longer course." | **Press `4`.** |
| 0:56 | A | "More people end up needing a second treatment, and we built that in. But nights away still drop, from **6.2 to 2.4**." | Card: *6.2 → 2.4*. Trips go up slightly (*2.2 → 2.4*), and the card says why. |
| 1:04 | B | "So this is the whole country. The height is nights away per patient, and it's basically all in the north and east." | **Press `5`.** The map flies out and the terrain rises. |
| 1:10 | B | "With five sessions, it drops from sixteen nights to six." | The lever flips by itself at about 1:09 and the terrain sinks. |
| 1:16 | B | "Then we wanted to know what hospitals do today. So we had AI read every unit's public patient pages, and we checked every quote." | **Press `6`.** |
| 1:23 | B | "Only **one of twelve** says which schedule it uses. So today's mix is just an assumption you can change." | Point at the *1 of 12 units* headline and the slider. |
| 1:29 | B | "And to make it usable, Matka writes a memo for every county. Here's Lapland's: three proposals, each with an owner and a first step within **30 days**, every number traced." | **Press `7`.** The memo writes itself in 4 seconds. |
| 1:40 | A | "So we'd recommend three things. Five sessions as the default for eligible breast patients, naming distance as a reason. A single 8 Gy session for uncomplicated painful bone metastases. And every unit publishing its schedule mix by distance, every year." | **Press `1`** for the Finland map. |
| 1:54 | A | "It's the clinical teams' call, so our ask is a **six-month pilot with Lapland and OYS**." | Hands off the keyboard. |

**Timing**
- **If you run long:**
  - drop "That's from FAST-Forward…" (it's in the questions below);
  - drop the "to make it usable" part.
- **If you want the Helsinki–Utsjoki comparison inside 15 seconds:** skip the two roadmap sentences and open on "Take two women…". The comparison then lands by 0:15.

**If something goes wrong**
- Keys 3 and 4 act on the selected municipality, so if `2` got skipped, press `2` first.
- A key pressed during the flight cancels it. Press `2` again.
- If the click lands on Espoo or Vantaa, say "twenty minutes from the hospital" (Espoo is 19 min, Vantaa 25 min). Both still have no nights away.
- If the map goes blank, press `0`, then carry on from the next key.

## 30-second fallback (if the live demo breaks)

First try the backup, https://matka-hack-europe.vercel.app, or play `deck/matka-demo.mp4` muted. If nothing works, A says:

> "So for the AstraZeneca challenge, we looked at what radiotherapy costs patients who live far away. A woman in Helsinki with breast cancer goes home every night. The same woman in Utsjoki drives 676 km to Oulu and spends 16 nights away. For eligible patients, five sessions in a week is at least as good as fifteen, so 16 nights become 6, and Finland frees about 17,500 radiotherapy sessions a year. Only one of twelve units says which schedule it uses. So we'd recommend the short schedules as defaults, published schedule mixes, and a six-month pilot with Lapland and OYS."

## Likely questions from Medical Affairs

Answer in your own words. Source ids are in the app's *Sources & limitations* tab if they want to check.

1. **"So is five sessions better than fifteen?"**
   No, and we're careful about that. FAST-Forward showed five sessions is non-inferior, so at least as good, with similar cancer control at ten years [S9–S13]. We don't claim it's better, and we make no survival claims.

2. **"Who's actually eligible?"**
   Only patients who don't need their lymph nodes treated: whole breast or chest wall. If the nodes are treated, fifteen stays standard [S14, S15]. The 70% who get radiotherapy and the 60% who are eligible are assumptions you can change in the app, because we couldn't find Finnish figures.

3. **"Doesn't a single 8 Gy session mean more retreatment?"**
   Yes: 20% against 8%, with the same pain response, in a review of 29 trials [S30, S31]. It's built into the model. That's why trips go up slightly, from 2.2 to 2.4, while nights still drop from 6.2 to 2.4.

4. **"You don't know today's schedule mix, so aren't the totals made up?"**
   We don't, and that's honestly one of our findings. Only Jyväskylä publishes a usual schedule, and Oulu's page just says one to four weeks [S65, S66, S68]. That's why it's a slider, set at 20%. If half of patients already get five sessions, the 17,500 drops to about 10,900.

5. **"Where does 'about 1,750 patients a year' come from?"**
   It starts from 5,204 new breast cancers on the mainland in 2024, from the Cancer Registry [S33, S34]. We multiply by 70% treated with radiotherapy, 60% eligible and 80% not already on five sessions. Those cases are spread over municipalities by age-weighted female population, so they're calculated, not registry counts.

6. **"Will freed sessions actually cut waiting times?"**
   They free capacity: ten sessions per patient switched. Whether waits drop depends on how units use that capacity, so we'd measure it in the pilot against the Goal 3 target-times indicator rather than claim it [S24, S25].

7. **"Distances from municipality centres, and the 100 km overnight rule, sound rough."**
   They are rough, and the app labels them:
   - distances are road routes from each municipality's centre point [S59, S60];
   - 100 km is our assumption, based on the roadmap's 100 km line [S21, S29].

   Move the threshold to 50 or 150 km and nights saved change (about 6,300 or 710 a year). The 17,500 sessions don't change, because they don't depend on distance.

8. **"Isn't this an app telling doctors what to do?"**
   No. It proposes, and the clinical teams decide; it says so on every screen. Every memo's first step is the clinical team reviewing it within 30 days, and there's no medicine involved.

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
- `deck/matka-demo-clean.mp4`: the same video without captions, for your voiceover.
- `deck/matka-demo.srt`: the captions as a subtitle file.

The video follows this script with a 2.5-second offset: a 3-second title card, then the demo from 0:00 to 1:40 (the Helsinki click and the keys happen by themselves), then an end card with the recommendation and the ask in place of the 1:40 to 2:00 part.

**Recording the voiceover**
- Play the clean version muted and read along. A starts when the map appears, at 0:02.5 in the video.
- One phone between you, a quiet room, about 20 cm from your mouths. Leave 3 seconds of silence at the start.
- Send the audio and it gets laid in, with the captions re-timed to your actual pauses.

How to rebuild the video is in `deck/video/README.md`.
