// QA stills from the finished video: one at the middle of every caption, plus the title, the joins and the
// end card. Writes out/qa/NN-<time>.png and out/qa/sheet-*.png contact sheets, and prints what each caption says.
//
//   node deck/video/qa.mjs [deck/matka-demo.mp4]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS, CAPTIONS, DEMO_OFFSET, TOTAL_SECONDS } from './timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const video = process.argv[2] ?? path.join(HERE, '..', 'matka-demo.mp4');
const dir = path.join(HERE, 'out', 'qa');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const keyAt = (k) => ACTIONS.find((a) => a.do === 'key' && a.key === k).t;
const moments = [
  [1.5, 'title card'],
  [2.75, 'title -> demo crossfade'],
  ...CAPTIONS.map((c) => [DEMO_OFFSET + (c.start + c.end) / 2, `caption: ${c.text}`]),
  // key 2: 1.2 s fly-in + 5 s along the road; key 5: the lever flips 4.2 s in and the terrain sinks over 1.6 s.
  [DEMO_OFFSET + keyAt('2') + 6.3, 'counter reaches 676 km'],
  [DEMO_OFFSET + keyAt('5') + 4.9, 'terrain sinking'],
  [DEMO_OFFSET + 99.75, 'demo -> end crossfade'],
  [110, 'end card, mid reveal'],
  [TOTAL_SECONDS - 0.1, 'last frame'],
].sort((a, b) => a[0] - b[0]);

moments.forEach(([t, label], i) => {
  const file = path.join(dir, `${String(i).padStart(2, '0')}-${t.toFixed(2)}.png`);
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', t.toFixed(3), '-i', video, '-frames:v', '1', file]);
  if (r.status !== 0) throw new Error(`still at ${t} failed`);
  console.log(`${path.basename(file)}  ${label}`);
});
for (const [n, from] of [[1, 0], [2, 16]]) {
  spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(dir, '[0-9]*.png'), '-vf', `select='between(n\\,${from}\\,${from + 15})',scale=640:360,tile=4x4`, '-frames:v', '1', path.join(dir, `sheet-${n}.png`)]);
}
console.log(`stills and contact sheets in ${dir}`);
