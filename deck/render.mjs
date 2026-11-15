// Renders deck/deck.html to deck/matka.pdf and deck/slides/slide-NN.png, then checks
//  1. layout: nothing overflows a slide, no text is clipped, the body never runs into the footer;
//  2. numbers: every number in the slide text appears in the repo data (deck/numbers.json,
//     public/data/*.json), like the app's memo validator. Report: deck/number_check.txt.
// Run: node deck/render.mjs   (after node deck/build.mjs)
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const D = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(D, '..');
const readJ = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.goto('file://' + path.join(D, 'deck.html'));
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);

// ---------- 1. layout checks ----------
const problems = await page.evaluate(() => {
  const out = [];
  for (const s of document.querySelectorAll('.slide')) {
    const n = s.dataset.slide;
    const sr = s.getBoundingClientRect();
    const body = s.querySelector('.body');
    const foot = s.querySelector('.foot');
    const br = body.getBoundingClientRect();
    if (body.scrollHeight > body.clientHeight + 1) out.push(`slide ${n}: body content taller than its box by ${body.scrollHeight - body.clientHeight}px`);
    const fr = foot.getBoundingClientRect();
    if (fr.bottom > sr.bottom + 0.5) out.push(`slide ${n}: footer runs off the slide by ${(fr.bottom - sr.bottom).toFixed(1)}px`);
    for (const el of s.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const tag = `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} "${(el.textContent || '').trim().slice(0, 40)}"`;
      if (r.right > sr.right - 40 + 0.5 && !el.closest('.top') && !el.closest('.foot')) out.push(`slide ${n}: ${tag} crosses the right margin (${(r.right - sr.right + 40).toFixed(1)}px)`);
      if (r.left < sr.left + 40 - 0.5 && !el.closest('.top')) out.push(`slide ${n}: ${tag} crosses the left margin`);
      if (body.contains(el) && r.bottom > br.bottom + 0.5 && !el.closest('.top')) out.push(`slide ${n}: ${tag} below the body box by ${(r.bottom - br.bottom).toFixed(1)}px`);
      const st = getComputedStyle(el);
      const ownText = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim());
      if (ownText && st.display !== 'inline' && el.scrollWidth > el.clientWidth + 1 && st.overflow !== 'visible') out.push(`slide ${n}: ${tag} clips text horizontally`);
      if (ownText && st.display !== 'inline' && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && !['TD', 'TH'].includes(el.tagName)) out.push(`slide ${n}: ${tag} text wider than its box (${el.scrollWidth} > ${el.clientWidth})`);
    }
    // images must load
    for (const img of s.querySelectorAll('img')) if (!img.complete || img.naturalWidth === 0) out.push(`slide ${n}: image ${img.getAttribute('src')} did not load`);
  }
  return out;
});

// ---------- 2. render ----------
const outDir = path.join(D, 'slides');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const slides = await page.locator('.slide').all();
for (const [i, s] of slides.entries()) {
  await s.screenshot({ path: path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`) });
}
await page.pdf({ path: path.join(D, 'matka.pdf'), width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true });

// ---------- 3. number check ----------
const texts = await page.evaluate(() => {
  // hide the top bar, file paths, URLs and [S..] ids, read the rendered text, then restore
  const hide = [...document.querySelectorAll('.top, .code, .url, .cite')];
  hide.forEach((e) => (e.style.display = 'none'));
  const out = [...document.querySelectorAll('.slide')].map((s) => ({ n: s.dataset.slide, text: s.innerText }));
  hide.forEach((e) => (e.style.display = ''));
  return out;
});
await browser.close();

const allowed = new Set();
const fmtR = (v) => { if (Math.abs(v) < 1000) return Math.round(v); const m = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 2); return Math.round(v / m) * m; };
const addNum = (v) => {
  if (!Number.isFinite(v)) return;
  for (const x of [v, Math.round(v), Math.round(v * 10) / 10, Math.round(v * 100) / 100, fmtR(v)]) allowed.add(+x.toFixed(4));
  if (v > 0 && v <= 1) for (const x of [v * 100, Math.round(v * 100), Math.round(v * 1000) / 10]) allowed.add(+x.toFixed(4));
};
const numRe = /\d+(?:[.,·]\d+)*/g;
const addText = (s) => {
  for (const m of String(s).matchAll(numRe)) {
    const raw = m[0];
    // "4096", "0,33" (Finnish decimal), "2·1" (Lancet decimal), "1,867" (thousands)
    if (/^\d{1,3}(,\d{3})+$/.test(raw)) addNum(+raw.replace(/,/g, ''));
    else addNum(+raw.replace(/[,·]/g, '.'));
    raw.split(/[.,·]/).forEach((p) => addNum(+p));
  }
};
const walk = (o) => {
  if (typeof o === 'number') addNum(o);
  else if (typeof o === 'string') addText(o);
  else if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === 'object') Object.values(o).forEach(walk);
};
walk(readJ('deck/numbers.json'));
for (const f of ['parameters.json', 'sources.json', 'facts.json', 'cases.json', 'unit_statements.json', 'rt_units.json']) walk(readJ(`public/data/${f}`));
walk(readJ('public/data/memos.json').memos.map((m) => [m.county_name, m.numbers_checked, m.numbers_passed]));

// Numbers that are part of the proposal or the deck itself, not data claims.
const PLAN = [
  { re: /\b12-month\b/g, why: 'pilot length (proposal)' },
  { re: /\b30-day\b/g, why: 'first-step window (SPEC, proposal)' },
  { re: /# Matka: 2-minute/g, why: 'talk-track length' },
  { re: /\bDays 0–30\b/g, why: 'pilot timeline (proposal)' },
  { re: /\bMonth (2|6|12)\b/gi, why: 'pilot timeline (proposal)' },
  { re: /\bwithin 30 days\b/gi, why: 'first-step window (SPEC, proposal)' },
  { re: /\b3 significant figures\b/g, why: 'rounding rule (src/hooks.ts fmtRounded)' },
  { re: /\((1|2) of 2\)/g, why: 'appendix page' },
  { re: /\bchange (1|2|3)\b|\bchanges 1 and 2\b/g, why: 'cross-reference to the numbered changes' },
  { re: /\b0\b(?=\s*\n?\s*AI in the numbers)/g, why: 'design statement: no AI in the numbers' },
  { re: /× 2\b|ceil\(n \/ 5\)|\(15 − 5\)/g, why: 'model formula (src/model/metrics.ts)' },
];
// the talk track is checked like a slide
texts.push({ n: 'notes.md', text: fs.readFileSync(path.join(D, 'notes.md'), 'utf8').replace(/\*\*\[[\d–]+\] \d:\d\d\*\*/g, ' ').replace(/^About \d+ words.*$/m, ' ') });
const lines = [];
let checked = 0, passed = 0;
const fails = [];
for (const { n, text } of texts) {
  let t = text;
  const planHits = [];
  for (const p of PLAN) t = t.replace(p.re, (m) => { planHits.push(`${m} (${p.why})`); return ' '; });
  // ranges like 2005–2013 or 30–300 → check each end
  t = t.replace(/(\d)\s*[–-]\s*(\d)/g, '$1 $2');
  const found = [];
  for (const m of t.matchAll(/(?<![A-Za-z])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![A-Za-z])\d+(?:\.\d+)?/g)) {
    const raw = m[0];
    const v = +raw.replace(/,/g, '');
    checked += 1;
    const ok = allowed.has(+v.toFixed(4));
    if (ok) passed += 1; else fails.push(`slide ${n}: ${raw}`);
    found.push(ok ? raw : `${raw} ✗`);
  }
  lines.push(`slide ${n}: ${found.length} numbers: ${found.join(' · ')}`);
  if (planHits.length) lines.push(`  not data (proposal/format): ${planHits.join('; ')}`);
}
const report = [
  `Deck number check: ${passed} of ${checked} numbers found in the repo data (deck/numbers.json, public/data/*.json).`,
  `Rule: each number in the slide text (footnotes included; S-ids, URLs and file paths excluded) must equal a value in the data,`,
  `allowing the app's rounding (whole numbers, 1 decimal, 3 significant figures) and shares shown as percentages.`,
  fails.length ? `NOT FOUND: ${fails.join('; ')}` : 'Not found: none.',
  '',
  ...lines,
].join('\n');
fs.writeFileSync(path.join(D, 'number_check.txt'), report + '\n');

const pdfSize = fs.statSync(path.join(D, 'matka.pdf')).size;
console.log(`rendered ${slides.length} slides; PDF ${(pdfSize / 1e6).toFixed(2)} MB`);
console.log(problems.length ? `LAYOUT PROBLEMS (${problems.length}):\n  ${problems.join('\n  ')}` : 'layout: no problems');
console.log(`numbers: ${passed} of ${checked} traced${fails.length ? `; NOT FOUND: ${fails.join('; ')}` : ''}`);
if (problems.length || fails.length) process.exitCode = 1;
