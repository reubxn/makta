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
  { t: 0.0, do: 'cursor-in', target: 'helsinki', from: [1040, 640], dur: 1.0 },
  { t: 1.0, do: 'hover', target: 'helsinki' },
  { t: 1.2, do: 'click', target: 'helsinki' },
  { t: 5.4, do: 'cursor-out' },
  // Off the map in two moves: over open sea first (deck.gl clears its hover tooltip), then off the canvas.
  { t: 5.5, do: 'hover', target: 'sea' },
  { t: 5.7, do: 'hover', target: 'offmap' },
  { t: 6.0, do: 'key', key: '2' }, // Utsjoki: fly the road to Oulu (7.8 s)
  { t: 22.5, do: 'key', key: '3' }, // breast lever: on after 1.2 s
  { t: 43.5, do: 'key', key: '4' }, // bone lever: on after 1.0 s
  { t: 60.0, do: 'key', key: '5' }, // burden terrain; breast lever flips at +4.2 s
  { t: 73.5, do: 'key', key: '6' }, // What units say
  { t: 86.0, do: 'key', key: '7' }, // Lapland memo writes itself (4 s)
];

/**
 * Burned-in captions (demo time). Short versions of the spoken lines in deck/demo-script.md.
 * Every number here is checked against the app in the QA pass (deck/video/README.md).
 */
export const CAPTIONS = [
  { start: 0.3, end: 2.6, text: 'Two women. Same breast cancer, same treatment.' },
  { start: 2.6, end: 6.0, text: 'Helsinki: 9 minutes from the hospital. Home every night.' },
  { start: 6.0, end: 10.6, text: 'Utsjoki: her nearest radiotherapy unit is in Oulu…' },
  { start: 10.6, end: 14.0, text: '…676 km away. Over 9 hours each way.' },
  { start: 14.0, end: 17.0, text: '15 sessions: 16 nights away from home.' },
  { start: 17.0, end: 22.5, text: 'Same cancer, different distance. 89 municipalities are more than 100 km from their unit.' },
  { start: 22.5, end: 26.8, text: 'Lever 1 · Breast, eligible patients (no nodal radiotherapy)' },
  { start: 26.8, end: 31.0, text: '5 sessions in one week: at least as good as 15 over three weeks.' },
  { start: 31.0, end: 34.5, text: 'FAST-Forward trial: 4,096 patients, 10-year results.' },
  { start: 34.5, end: 37.0, text: 'Utsjoki: 16 nights away become 6.' },
  { start: 37.0, end: 43.5, text: 'Finland: about 17,500 machine sessions freed a year. Goal 3: treatment within target times.' },
  { start: 43.5, end: 49.5, text: 'Lever 2 · Painful bone metastases: one 8 Gy session relieves pain as well as a longer course.' },
  { start: 49.5, end: 55.5, text: 'More retreatment, and the model counts it. Nights away still fall: 6.2 → 2.4.' },
  { start: 55.5, end: 60.0, text: 'Yet in a Turku study, only 7% of end-of-life courses were single sessions.' },
  { start: 60.0, end: 65.5, text: 'All of Finland. Height = nights away per patient. The north and east carry it.' },
  { start: 65.5, end: 68.5, text: '5 sessions: 16 nights become 6.' },
  { start: 68.5, end: 73.5, text: 'The national roadmap notes palliative radiotherapy is used less beyond 100 km.' },
  { start: 73.5, end: 79.0, text: "AI read the units' public patient pages. Every quote is checked against the page." },
  { start: 79.0, end: 86.0, text: "Only 1 of 12 units publishes which schedule it uses. So today's mix is an assumption you can set." },
  { start: 86.0, end: 93.0, text: 'A memo for every county. Lapland: no unit, 20 of 21 municipalities beyond 100 km.' },
  { start: 93.0, end: 99.4, text: '3 proposals, each with an owner and a first step within 30 days. 9 of 9 numbers traced.' },
];
