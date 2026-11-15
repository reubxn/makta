// Assembles the submission videos from the recorded masters (record.mjs) and caption strips (captions.mjs).
//
//   node deck/video/build.mjs   -> deck/matka-demo.mp4 (captions burned in), deck/matka-demo-clean.mp4 (no captions)
//
// Title card -> demo -> end card, joined with 0.5 s crossfades; H.264, -preset veryfast, yuv420p, faststart.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAND, CAPTIONS, DEMO_OFFSET, DEMO_SECONDS, FPS, TOTAL_SECONDS, VIDEO } from './timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const DECK = path.join(HERE, '..');
for (const f of ['title.mkv', 'demo.mkv', 'end.mkv', 'captions/band.png']) {
  if (!fs.existsSync(path.join(OUT, f))) throw new Error(`missing out/${f}: run record.mjs and captions.mjs first`);
}

const ENCODE = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an'];
const join = `[0:v]settb=AVTB,fps=${FPS}[t];[1:v]settb=AVTB,fps=${FPS}[d];[2:v]settb=AVTB,fps=${FPS}[e];` +
  `[t][d]xfade=transition=fade:duration=${VIDEO.xfade}:offset=${VIDEO.titleSeconds - VIDEO.xfade}[td];` +
  `[td][e]xfade=transition=fade:duration=${VIDEO.xfade}:offset=${DEMO_OFFSET + DEMO_SECONDS - VIDEO.xfade}[v0]`;

function run(args) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status})`);
}
const inputs = ['-i', path.join(OUT, 'title.mkv'), '-i', path.join(OUT, 'demo.mkv'), '-i', path.join(OUT, 'end.mkv')];

// 1. Clean version (for a voiceover): no captions.
run([...inputs, '-filter_complex', join, '-map', '[v0]', ...ENCODE, '-t', TOTAL_SECONDS.toFixed(3), path.join(DECK, 'matka-demo-clean.mp4')]);

// 2. Captioned version: a graphite band for the whole demo section, the caption text crossfading inside it.
const F = 0.15; // fade length
const bandStart = CAPTIONS[0].start + DEMO_OFFSET;
const bandEnd = CAPTIONS[CAPTIONS.length - 1].end + DEMO_OFFSET;
const capInputs = ['-loop', '1', '-framerate', String(FPS), '-t', (bandEnd - bandStart).toFixed(3), '-i', path.join(OUT, 'captions', 'band.png')];
let graph = `${join};[3:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1,fade=t=out:st=${(bandEnd - bandStart - 0.3).toFixed(3)}:d=0.3:alpha=1,setpts=PTS-STARTPTS+${bandStart.toFixed(3)}/TB[band];` +
  `[v0][band]overlay=0:${BAND.y}:eof_action=pass:enable='between(t,${bandStart.toFixed(3)},${bandEnd.toFixed(3)})'[c0]`;
CAPTIONS.forEach((c, i) => {
  const s = c.start + DEMO_OFFSET;
  const d = c.end - c.start;
  capInputs.push('-loop', '1', '-framerate', String(FPS), '-t', d.toFixed(3), '-i', path.join(OUT, 'captions', `cap-${String(i).padStart(2, '0')}.png`));
  const k = i + 4;
  const fin = i === 0 ? 0.3 : F;
  graph += `;[${k}:v]format=rgba,fade=t=in:st=0:d=${fin}:alpha=1,fade=t=out:st=${(d - F).toFixed(3)}:d=${F}:alpha=1,setpts=PTS-STARTPTS+${s.toFixed(3)}/TB[k${i}];` +
    `[c${i}][k${i}]overlay=0:${BAND.y}:eof_action=pass:enable='between(t,${s.toFixed(3)},${(s + d).toFixed(3)})'[c${i + 1}]`;
});
run([...inputs, ...capInputs, '-filter_complex', graph, '-map', `[c${CAPTIONS.length}]`, ...ENCODE, '-t', TOTAL_SECONDS.toFixed(3), path.join(DECK, 'matka-demo.mp4')]);

for (const f of ['matka-demo.mp4', 'matka-demo-clean.mp4']) {
  const p = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate,pix_fmt', '-of', 'compact', path.join(DECK, f)], { encoding: 'utf8' });
  console.log(f, p.stdout.trim().replace(/\n/g, ' | '));
}
