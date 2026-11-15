// Captures real screenshots of the Matka app for the deck.
// Needs the built app served on http://localhost:4173 (npm run build && npx vite preview --port 4173).
// Run: node deck/capture.mjs  ->  deck/shots/*.png (1600x900 CSS px at deviceScaleFactor 2)
// Uses the same demo keys and test-only hold hooks as tests/e2e/layout.spec.ts.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:4173/';
const OUT = new URL('./shots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const external = [];
page.on('request', (r) => { const u = r.url(); if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u); });
page.on('pageerror', (e) => console.error('pageerror', String(e)));

const shot = async (name) => { await page.screenshot({ path: `${OUT}${name}.png` }); console.log('shot', name); };
const wait = (ms) => page.waitForTimeout(ms);
const tid = (id) => page.getByTestId(id);

await page.goto(BASE);
await tid('app-ready').waitFor({ state: 'attached', timeout: 30_000 });
await wait(2500);

// Key 1: Finland, flat, north-up.
await page.keyboard.press('1');
await wait(3000);
await shot('01-finland');

// Key 2: Utsjoki, flight ends at the routes.json values.
await page.keyboard.press('2');
await page.waitForFunction(() => document.querySelector('[data-testid="travel-label"]')?.textContent === '676 km · 9 h 22 min', null, { timeout: 40_000 });
await wait(3500);
await shot('02-utsjoki');

// Key 3: breast lever on.
await page.keyboard.press('3');
await page.waitForFunction(() => document.querySelector('[data-testid="lever"]')?.getAttribute('aria-checked') === 'true', null, { timeout: 15_000 });
await page.waitForFunction(() => document.querySelector('[data-testid="night-icons"]')?.getAttribute('data-nights') === '6', null, { timeout: 15_000 });
await wait(2500);
await shot('03-breast-lever');

// Key 4: bone lever on.
await page.keyboard.press('4');
await page.waitForFunction(() => document.querySelector('[data-testid="lever"]')?.getAttribute('aria-checked') === 'true', null, { timeout: 15_000 });
await wait(2500);
await shot('04-bone-lever');

// Key 5: burden terrain on 15 sessions (held), then sunk after the lever flips.
await page.evaluate(() => (window.__matkaHold = true));
await page.keyboard.press('5');
await wait(4500);
await shot('05a-terrain');
await page.evaluate(() => delete window.__matkaHold);
await page.waitForFunction(() => document.querySelector('[data-testid="lever"]')?.getAttribute('aria-checked') === 'true', null, { timeout: 15_000 });
await wait(3500);
await shot('05b-terrain-sunk');

// Assumptions drawer (national view).
await page.keyboard.press('1');
await wait(2500);
await tid('assumptions-toggle').click();
await wait(900);
await shot('05d-assumptions');
await page.keyboard.press('Escape');
await wait(400);

// Key 6: what units say.
await page.keyboard.press('6');
await wait(1500);
await shot('06-units');

// Key 7: Lapland memo writes itself.
await page.keyboard.press('7');
await wait(6500);
await shot('07-memo-lapland');

// Sources & limitations tab.
await page.keyboard.press('0');
await wait(2500);
await page.getByRole('tab', { name: /Sources/ }).click();
await wait(1000);
await shot('10-sources');

// Provenance popover on the route line (Utsjoki selected).
await page.getByRole('tab', { name: 'Map' }).click();
await wait(1500);
await page.keyboard.press('2');
await page.waitForFunction(() => document.querySelector('[data-testid="travel-label"]')?.textContent === '676 km · 9 h 22 min', null, { timeout: 40_000 });
await wait(3000);
await tid('route-line').getByTestId('prov-badge').click();
await wait(700);
await shot('11-provenance');

await browser.close();
if (external.length) { console.error('external requests:', external); process.exit(1); }
console.log('no external requests');
