import { test, expect } from '@playwright/test';
import fs from 'node:fs';

// The map's zoom-to-fit used to throw when the map area was smaller than its overlay margins,
// blanking the page (e.g. 1024x768). Every common projector / laptop size must render.
const SIZES: [number, number][] = [
  // 1024x768 at 150% and 200% OS/browser scaling: 512x384 blanked the page before the fix.
  [683, 512],
  [512, 384],
  [1024, 768],
  [800, 600],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1600, 1000],
  [1920, 1080],
  [390, 844],
];

for (const [width, height] of SIZES) {
  test(`renders at ${width}x${height}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByTestId('app-ready')).toBeAttached({ timeout: 15_000 });
    await expect(page.getByText('Matka').first()).toBeVisible();
    await expect(page.locator('canvas').first()).toBeAttached();
    // Exercise the fit paths: Finland, a municipality, back to Finland, and a resize while running.
    for (const k of ['1', '2', '3', '1']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(500);
    }
    await page.setViewportSize({ width: Math.max(320, width - 300), height: Math.max(400, height - 200) });
    await page.waitForTimeout(500);
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(500);
    await expect(page.getByTestId('app-ready')).toBeAttached();
    await expect(page.getByText('Matka').first()).toBeVisible();
    fs.mkdirSync('screenshots/viewports', { recursive: true });
    await page.screenshot({ path: `screenshots/viewports/${width}x${height}.png` });
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
