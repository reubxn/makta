// Renders the burned-in captions as transparent PNG strips (one band + one text strip per caption),
// and writes deck/matka-demo.srt with the same lines in video time.
//
//   node deck/video/captions.mjs        -> out/captions/band.png, out/captions/cap-NN.png, ../matka-demo.srt
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAND, CAPTIONS, DEMO_OFFSET, WIDTH } from './timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, 'out', 'captions');

const CSS = `
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${WIDTH}px; height: ${BAND.h}px; background: transparent; overflow: hidden; }
  .band { position: absolute; inset: 0; background: rgb(36, 40, 40); border-top: 3px solid #00626a; }
  .text { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 0 200px;
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 500; font-size: 31px; line-height: 1.28;
    color: #fff; text-align: center; text-wrap: balance; -webkit-font-smoothing: antialiased; letter-spacing: 0.005em; }
`;

const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

fs.mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: BAND.h }, deviceScaleFactor: 1 });
const shoot = async (html, file) => {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, omitBackground: true });
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

await shoot('<div class="band"></div>', path.join(DIR, 'band.png'));
const lines = [];
for (const [i, c] of CAPTIONS.entries()) {
  const file = path.join(DIR, `cap-${String(i).padStart(2, '0')}.png`);
  await shoot(`<div class="text">${esc(c.text)}</div>`, file);
  // Fail loudly if a caption needs more than two lines.
  const h = await page.evaluate(() => {
    const el = document.querySelector('.text');
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().height;
  });
  if (h > 31 * 1.28 * 2 + 2) throw new Error(`caption ${i} wraps to more than two lines: ${c.text}`);
  lines.push(`${i + 1}\n${srtTime(c.start + DEMO_OFFSET)} --> ${srtTime(c.end + DEMO_OFFSET)}\n${c.text}\n`);
}
await browser.close();
fs.writeFileSync(path.join(HERE, '..', 'matka-demo.srt'), lines.join('\n'));
console.log(`${CAPTIONS.length} captions -> ${DIR}; SRT -> deck/matka-demo.srt`);
