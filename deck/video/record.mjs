// Frame-by-frame recorder for the Matka demo video.
//
// The app runs on a virtual clock (vclock.js): nothing moves until this script advances it, so every
// frame is exact and smooth however slow WebGL is (the cloud container renders deck.gl in software,
// about 1 s per camera-move frame). The app is driven by its own demo keys, at the times in timeline.mjs.
//
//   node deck/video/record.mjs demo                 # app at http://localhost:4173 -> out/demo.mkv (lossless)
//   node deck/video/record.mjs title | end          # cards/title.html, cards/end.html -> out/<name>.mkv
//   node deck/video/record.mjs demo --preview 2     # PNG every 2 s of demo time -> out/preview/
//   node deck/video/record.mjs demo --stills 14,37  # PNG at these demo times -> out/stills/
//
// Needs `npm run build && npx vite preview --port 4173` running for `demo`.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ACTIONS, DEMO_SECONDS, FPS, HEIGHT, VIDEO, WIDTH } from './timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const TICK = 1000 / 60; // the app's animations step at 60 Hz; every second tick is recorded (30 fps)

const args = process.argv.slice(2);
const what = args[0] ?? 'demo';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const BASE = opt('base', 'http://localhost:4173/');
const preview = opt('preview', null) ? Number(opt('preview')) : null;
const stills = opt('stills', null) ? opt('stills').split(',').map(Number) : null;
const until = opt('until', null) ? Number(opt('until')) : null;

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/* ---------------- the drawn cursor (only for the Helsinki click) ---------------- */
const CURSOR_CSS = `
#__cursor{position:fixed;left:0;top:0;width:30px;height:30px;pointer-events:none;z-index:99999;will-change:transform}
#__cursor svg{display:block;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))}
#__ripple{position:fixed;pointer-events:none;z-index:99998;border:3px solid #00626a;border-radius:50%;opacity:0}
`;
const CURSOR_SVG = `<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 2.5 L5 19.5 L9.3 15.4 L12.2 21.6 L15.1 20.3 L12.3 14.3 L18.2 14.1 Z" fill="#15191e" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

function cursorState(t, targets) {
  const a = ACTIONS.find((x) => x.do === 'cursor-in');
  const out = ACTIONS.find((x) => x.do === 'cursor-out');
  const click = ACTIONS.find((x) => x.do === 'click');
  if (!a || t < a.t) return null;
  const to = targets[a.target];
  const k = easeInOut(clamp01((t - a.t) / a.dur));
  // A gentle arc, not a straight line, so the move reads as a hand.
  const x = a.from[0] + (to.x - a.from[0]) * k;
  const y = a.from[1] + (to.y - a.from[1]) * k - Math.sin(Math.PI * k) * 40;
  let opacity = clamp01((t - a.t) / 0.25);
  if (out && t >= out.t) opacity *= 1 - clamp01((t - out.t) / 0.35);
  let ripple = null;
  if (click && t >= click.t && t < click.t + 0.6) {
    const u = (t - click.t) / 0.6;
    ripple = { x: to.x, y: to.y, r: 6 + 30 * easeInOut(u), a: 0.9 * (1 - u) };
  }
  return { x, y, opacity, ripple };
}

/* ---------------- recorder ---------------- */
class Recorder {
  async open(url) {
    this.browser = await chromium.launch();
    this.ctx = await this.browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    this.page = await this.ctx.newPage();
    this.errors = [];
    this.external = [];
    this.page.on('console', (m) => m.type() === 'error' && this.errors.push(m.text()));
    this.page.on('pageerror', (e) => this.errors.push(String(e)));
    this.page.on('request', (r) => {
      const u = r.url();
      if (!u.startsWith('http://localhost') && !u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) this.external.push(u);
    });
    await this.page.addInitScript({ path: path.join(HERE, 'vclock.js') });
    this.cdp = await this.ctx.newCDPSession(this.page);
    await this.page.goto(url);
  }
  flush() {
    // Let React's scheduler (MessageChannel tasks) render, commit and run effects.
    return this.page.evaluate(
      () =>
        new Promise((r) => {
          let n = 0;
          const ch = new MessageChannel();
          ch.port1.onmessage = () => (++n >= 4 ? r() : ch.port2.postMessage(0));
          ch.port2.postMessage(0);
        }),
    );
  }
  async tick() {
    await this.page.evaluate((ms) => window.__vt.step(ms), TICK);
    await this.flush();
  }
  async draw() {
    await this.page.evaluate(() => window.__vt.draw());
    await this.flush();
    await this.page.evaluate(() => window.__vt.syncCss());
  }
  async screenshot() {
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    return Buffer.from(data, 'base64');
  }
  async close() {
    await this.browser.close();
  }
}

function encoder(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Lossless master (x264 qp 0, 4:4:4); the final MP4s are encoded from it by build.sh.
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', '-pix_fmt', 'yuv444p', file], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));
  return {
    write: (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res))),
    end: async () => {
      ff.stdin.end();
      await done;
    },
  };
}

async function resolveTargets(page) {
  // Helsinki: just inland (north-east) of the HUS square, inside Helsinki's polygon.
  const hus = await page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-box=hmark]')].find((e) => /HUS|Helsinki/i.test(e.getAttribute('title') || ''));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!hus) throw new Error('HUS marker not found');
  const off = (opt('helsinki-offset', '5,-4') || '5,-4').split(',').map(Number);
  // sea: open water west of Finland on the national view (nothing pickable); offmap: blank right panel.
  return { helsinki: { x: Math.round(hus.x + off[0]), y: Math.round(hus.y + off[1]) }, sea: { x: 520, y: 600 }, offmap: { x: 1720, y: 1000 } };
}

async function recordDemo() {
  const rec = new Recorder();
  await rec.open(BASE);
  const { page } = rec;
  // Boot on the virtual clock until the app and its fonts are ready, then reset with key 0.
  for (let i = 0; i < 600; i++) {
    await rec.tick();
    if (i % 10 === 0) await rec.draw();
    if (i > 30 && (await page.locator('[data-testid=app-ready]').count())) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: CURSOR_CSS });
  await page.evaluate((svg) => {
    const c = document.createElement('div');
    c.id = '__cursor';
    c.innerHTML = svg;
    c.style.opacity = '0';
    const r = document.createElement('div');
    r.id = '__ripple';
    document.body.append(r, c);
  }, CURSOR_SVG);
  await page.keyboard.press('0');
  for (let i = 0; i < 180; i++) {
    await rec.tick();
    if (i % 30 === 29) await rec.draw();
  }
  await rec.draw();
  const targets = await resolveTargets(page);
  console.log('targets', JSON.stringify(targets));

  const seconds = until ?? DEMO_SECONDS;
  const nFrames = Math.round(seconds * FPS);
  const sampleSet = stills ? new Set(stills.map((s) => Math.round(s * FPS))) : null;
  const isSample = (i) => (preview ? i % Math.round(preview * FPS) === 0 : sampleSet ? sampleSet.has(i) : true);
  const lastSample = sampleSet ? Math.max(...sampleSet) : nFrames - 1;
  const enc = !preview && !sampleSet ? encoder(path.join(OUT, 'demo.mkv')) : null;
  const dir = preview ? path.join(OUT, 'preview') : path.join(OUT, 'stills');
  if (!enc) fs.mkdirSync(dir, { recursive: true });

  const pending = [...ACTIONS].sort((a, b) => a.t - b.t);
  const runDue = async (t) => {
    while (pending.length && pending[0].t <= t + 1e-6) {
      const a = pending.shift();
      if (a.do === 'key') await page.keyboard.press(a.key);
      else if (a.do === 'hover') await page.mouse.move(targets[a.target].x, targets[a.target].y);
      else if (a.do === 'click') await page.mouse.click(targets[a.target].x, targets[a.target].y);
      await rec.flush();
    }
  };
  const setCursor = (t) =>
    page.evaluate((s) => {
      const c = document.getElementById('__cursor');
      const r = document.getElementById('__ripple');
      if (!s) {
        c.style.opacity = '0';
        r.style.opacity = '0';
        return;
      }
      // The arrow's tip is at (5, 2.5) of a 24-unit box drawn at 30 px.
      c.style.transform = `translate(${s.x - 6.25}px, ${s.y - 3.1}px)`;
      c.style.opacity = String(s.opacity);
      if (s.ripple) {
        Object.assign(r.style, { left: `${s.ripple.x - s.ripple.r}px`, top: `${s.ripple.y - s.ripple.r}px`, width: `${2 * s.ripple.r}px`, height: `${2 * s.ripple.r}px`, opacity: String(s.ripple.a) });
      } else r.style.opacity = '0';
    }, cursorState(t, targets));

  const t0 = Date.now();
  await runDue(0);
  for (let i = 0; i <= Math.min(nFrames - 1, lastSample); i++) {
    if (i > 0) {
      for (let k = 2 * i - 1; k <= 2 * i; k++) {
        await rec.tick();
        await runDue(k / 60);
      }
    }
    if (!isSample(i)) continue;
    await rec.draw();
    await setCursor(i / FPS);
    const png = await rec.screenshot();
    if (enc) await enc.write(png);
    else fs.writeFileSync(path.join(dir, `demo-${(i / FPS).toFixed(2).padStart(6, '0')}.png`), png);
    if (i % (FPS * 5) === 0) console.log(`demo ${(i / FPS).toFixed(1)} s  (${((Date.now() - t0) / 1000).toFixed(0)} s elapsed)`);
  }
  if (enc) await enc.end();
  console.log('console errors:', rec.errors.length ? rec.errors : 'none');
  console.log('external requests:', rec.external.length ? rec.external : 'none');
  await rec.close();
  if (rec.errors.length || rec.external.length) process.exitCode = 1;
}

async function recordCard(name, seconds) {
  const rec = new Recorder();
  await rec.open(pathToFileURL(path.join(HERE, 'cards', `${name}.html`)).href);
  await rec.page.evaluate(() => document.fonts.ready);
  for (let i = 0; i < 6; i++) await rec.tick();
  const n = Math.round(seconds * FPS);
  const enc = preview || stills ? null : encoder(path.join(OUT, `${name}.mkv`));
  const dir = path.join(OUT, preview ? 'preview' : 'stills');
  if (!enc) fs.mkdirSync(dir, { recursive: true });
  // The card's own CSS animations start at its time 0.
  await rec.page.evaluate(() => document.body.classList.add('go'));
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      await rec.tick();
      await rec.tick();
    }
    const sample = preview ? i % Math.round(preview * FPS) === 0 : stills ? stills.some((s) => Math.round(s * FPS) === i) : true;
    if (!sample) continue;
    await rec.draw();
    const png = await rec.screenshot();
    if (enc) await enc.write(png);
    else fs.writeFileSync(path.join(dir, `${name}-${(i / FPS).toFixed(2).padStart(6, '0')}.png`), png);
  }
  if (enc) await enc.end();
  console.log(name, 'console errors:', rec.errors.length ? rec.errors : 'none');
  await rec.close();
}

if (what === 'demo') await recordDemo();
else if (what === 'title') await recordCard('title', VIDEO.titleSeconds);
else if (what === 'end') await recordCard('end', VIDEO.endSeconds);
else throw new Error(`unknown: ${what}`);
