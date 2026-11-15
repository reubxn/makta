import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// Runs demo keys 0-7, fails on console errors or any external request, saves screenshots.
// (Per-size screenshots of every step, with the overlap/clipping checks, are in layout.spec.ts.)

const SHOTS = 'screenshots/redesign/demo-1440x900';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

test('demo keys 0-7', async ({ page, baseURL }) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const errors: string[] = [];
  const external: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('request', (req) => {
    const url = req.url();
    if (!url.startsWith(baseURL!) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
  });

  const t0 = Date.now();
  await page.goto('/');
  await expect(page.getByTestId('app-ready')).toBeAttached({ timeout: 15_000 });
  const loadMs = Date.now() - t0;
  console.log(`app ready in ${loadMs} ms`);
  await page.waitForTimeout(1200);
  await shot(page, '00-initial');

  const steps: [string, string, number][] = [
    ['1', '01-finland', 2000],
    ['2', '02-utsjoki', 9000],
    ['3', '03-breast-lever', 3500],
    ['4', '04-bone-lever', 3500],
    ['5', '05-terrain', 8000],
    ['6', '06-units', 1200],
    ['7', '07-memo-lapland', 6000],
  ];
  for (const [key, name, wait] of steps) {
    await page.keyboard.press(key);
    await page.waitForTimeout(wait);
    await shot(page, name);
    if (key === '3') {
      // Breast is the lead lever and on by now.
      await expect(page.getByTestId('lever')).toContainText('5 sessions as default');
      await expect(page.getByTestId('lever')).toHaveAttribute('aria-checked', 'true');
    }
    if (key === '4') {
      // The bone line must be fully visible: inside the viewport and not clipped by its card.
      const note = page.getByTestId('bone-note');
      await expect(note).toBeVisible();
      await expect(note).toHaveText('Fewer nights away; trips about the same, because some patients need a second session.');
      const clipped = await note.evaluate((el) => {
        const r = el.getBoundingClientRect();
        let p: HTMLElement | null = el.parentElement;
        while (p) {
          const st = getComputedStyle(p);
          if (st.overflow !== 'visible' || st.overflowY !== 'visible') {
            const pr = p.getBoundingClientRect();
            if (r.bottom > pr.bottom + 0.5 || r.top < pr.top - 0.5) return true;
          }
          p = p.parentElement;
        }
        return r.bottom > window.innerHeight || el.scrollWidth > el.clientWidth + 1;
      });
      expect(clipped, 'bone note is clipped').toBe(false);
    }
  }

  // Key 2 must select Utsjoki and end the route counter exactly at the routes.json values.
  await page.keyboard.press('1');
  await page.waitForTimeout(1500);
  await page.keyboard.press('2');
  await expect(page.getByTestId('card-title')).toContainText('Utsjoki');
  await expect(page.getByTestId('travel-label')).toHaveText('676 km · 9 h 22 min', { timeout: 20_000 });
  await expect(page.getByTestId('route-line')).toContainText('676 km · 9 h 22 min');

  // Help overlay and reset.
  await page.keyboard.press('?');
  await page.waitForTimeout(400);
  await shot(page, '08-help');
  await page.keyboard.press('Escape');
  await page.keyboard.press('0');
  await page.waitForTimeout(1500);
  await shot(page, '09-reset');

  // Sources tab.
  await page.getByRole('tab', { name: /Sources/ }).click();
  await page.waitForTimeout(600);
  await shot(page, '10-sources');

  // Provenance popover on the map tab.
  await page.getByRole('tab', { name: 'Map' }).click();
  await page.waitForTimeout(600);
  await page.getByTestId('prov-badge').first().click();
  await page.waitForTimeout(400);
  await shot(page, '11-provenance');

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  expect(external, `external requests:\n${external.join('\n')}`).toEqual([]);
});
