// One clock for the demo recording, its captions and the script (deck/demo-script.md).
// Times are seconds of DEMO time: 0 = the moment the live demo starts (after pressing 0 to reset).
// The video puts a title card before it and an end card (the ask) after it; see VIDEO below.

export const FPS = 30;
/** Caption band: the bottom of the 1080 frame, over the app footer and the map-caption row. */
export const BAND = { y: 974, h: 106 };
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Demo section of the video: live script 0:00 to 1:40. The ask (1:40 to 2:00) is the end card. */
export const DEMO_SECONDS = 100;

export const VIDEO = {
  titleSeconds: 3.0, // title card, including its crossfade into the app
  endSeconds: 17.8, // end card (the recommendation and the ask), including its crossfade in
  xfade: 0.5, // crossfade length at both joins
};
/** Video time at which demo time 0 is shown (the title crossfade overlaps the demo's first 0.5 s). */
export const DEMO_OFFSET = VIDEO.titleSeconds - VIDEO.xfade;
/** Total length: 3.0 + 100 + 17.8 - 2 x 0.5 = 119.8 s. */
export const TOTAL_SECONDS = VIDEO.titleSeconds + DEMO_SECONDS + VIDEO.endSeconds - 2 * VIDEO.xfade;

/**
 * Recorder actions, in demo time. Keys are the app's demo shortcuts (src/App.tsx).
 * The one click (Helsinki) is the only pointer action; a drawn cursor glides to it so the click reads on video.
 */
export const ACTIONS = [
  // 0-10 s: the Finland map while A says where the team started (the roadmap's 100 km line).
  { t: 8.8, do: 'cursor-in', target: 'helsinki', from: [1040, 640], dur: 1.0 },
  { t: 9.8, do: 'hover', target: 'helsinki' },
  { t: 10.0, do: 'click', target: 'helsinki' },
  { t: 16.2, do: 'cursor-out' },
  // Off the map in two moves: over open sea first (deck.gl clears its hover tooltip), then off the canvas.
  { t: 16.3, do: 'hover', target: 'sea' },
  { t: 16.5, do: 'hover', target: 'offmap' },
  { t: 17.0, do: 'key', key: '2' }, // Utsjoki: fly the road to Oulu (7.8 s)
  { t: 33.5, do: 'key', key: '3' }, // breast lever, on "First, breast": on after 1.2 s
  { t: 51.0, do: 'key', key: '4' }, // bone lever: on after 1.0 s
  { t: 64.5, do: 'key', key: '5' }, // burden terrain; breast lever flips at +4.2 s
  { t: 76.0, do: 'key', key: '6' }, // What units say
  { t: 89.0, do: 'key', key: '7' }, // Lapland memo writes itself (4 s)
];

/**
 * Burned-in captions (demo time). Short versions of the spoken lines in deck/demo-script.md.
 * Every number here is checked against the app in the QA pass (deck/video/README.md).
 */
export const CAPTIONS = [
  { start: 0.3, end: 5.2, text: "For the AstraZeneca challenge, we started with Finland's national cancer roadmap." },
  { start: 5.2, end: 10.0, text: 'One line stuck with us: people over 100 km from a radiotherapy unit get less palliative radiotherapy.' },
  { start: 10.0, end: 12.6, text: 'So: two women with the same breast cancer.' },
  { start: 12.6, end: 17.0, text: 'One lives in Helsinki, 9 minutes from the hospital. Home every night.' },
  { start: 17.0, end: 21.8, text: 'The other lives in Utsjoki. Her nearest unit is in Oulu…' },
  { start: 21.8, end: 24.6, text: '…676 km away. More than 9 hours each way.' },
  { start: 24.6, end: 28.0, text: '15 sessions means 16 nights away from home.' },
  { start: 28.0, end: 33.5, text: 'Then we looked at the evidence: two shorter schedules already backed by trials.' },
  { start: 33.5, end: 38.0, text: "First, breast. If the lymph nodes don't need treating…" },
  { start: 38.0, end: 42.0, text: '…5 sessions in one week is at least as good as 15 over three weeks.' },
  { start: 42.0, end: 44.5, text: 'FAST-Forward trial: over 4,000 patients.' },
  { start: 44.5, end: 47.0, text: 'Utsjoki: 16 nights away become 6.' },
  { start: 47.0, end: 51.0, text: 'Across Finland: about 17,500 radiotherapy sessions freed a year. Goal 3: treatment within target times.' },
  { start: 51.0, end: 56.0, text: 'Second, painful bone metastases: one 8 Gy session relieves pain as well as a longer course.' },
  { start: 56.0, end: 60.5, text: 'More people need a second treatment, and the model counts it.' },
  { start: 60.5, end: 64.5, text: 'Nights away still drop: 6.2 → 2.4.' },
  { start: 64.5, end: 70.0, text: 'The whole country. Height = nights away per patient. The north and east carry it.' },
  { start: 70.0, end: 76.0, text: 'With 5 sessions: 16 nights become 6.' },
  { start: 76.0, end: 80.5, text: "What do hospitals do today? AI read every unit's public patient pages, checking every quote." },
  { start: 80.5, end: 84.8, text: 'Only 1 of 12 units says which schedule it uses.' },
  { start: 84.8, end: 89.0, text: "So today's mix is an assumption you can change." },
  { start: 89.0, end: 94.5, text: 'To make it usable, Matka writes a memo for every county.' },
  { start: 94.5, end: 99.4, text: 'Lapland: 3 proposals, each with an owner and a first step in 30 days. 9 of 9 numbers traced.' },
];
