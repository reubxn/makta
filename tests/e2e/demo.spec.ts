import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// Runs demo keys 0-7, fails on console errors or any external request, saves screenshots.

const SHOTS = 'screenshots';

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
    ['1', '01-finland', 1500],
    ['2', '02-utsjoki', 2000],
    ['3', '03-bone-lever', 3000],
    ['4', '04-breast-lever', 3200],
    ['5', '05-totals', 2500],
    ['6', '06-units', 1200],
    ['7', '07-memo-lapland', 6000],
  ];
  for (const [key, name, wait] of steps) {
    await page.keyboard.press(key);
    await page.waitForTimeout(wait);
    await shot(page, name);
  }

  // Key 2 must select Utsjoki.
  await page.keyboard.press('2');
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('card-title')).toContainText('Utsjoki');

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
