import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// Captures every view at 1440x900 for the design review.
// DESIGN_ROUND=round0 npx playwright test tests/e2e/design.spec.ts
const ROUND = process.env.DESIGN_ROUND ?? 'latest';
const DIR = `screenshots/design/${ROUND}`;

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

test('design views', async ({ page }) => {
  test.skip(!process.env.DESIGN_ROUND, 'design capture runs only with DESIGN_ROUND set');
  fs.mkdirSync(DIR, { recursive: true });
  await page.goto('/');
  await expect(page.getByTestId('app-ready')).toBeAttached({ timeout: 15_000 });
  await page.waitForTimeout(1800);
  await shot(page, '01-map-finland-bone-off');

  await page.keyboard.press('2');
  await page.waitForTimeout(2200);
  await shot(page, '02-map-utsjoki');

  await page.keyboard.press('3');
  await page.waitForTimeout(2600);
  await shot(page, '03-map-bone-lever-on');

  await page.keyboard.press('4');
  await page.waitForTimeout(3000);
  await shot(page, '04-map-breast-lever-on');

  await page.keyboard.press('5');
  await page.waitForTimeout(2500);
  await shot(page, '05-map-totals-highlight');

  await page.getByRole('button', { name: 'Hours on the road' }).click();
  await page.waitForTimeout(1200);
  await shot(page, '06-map-metric-hours');
  await page.getByRole('button', { name: 'Nights away' }).click();

  await page.getByRole('button', { name: /Assumptions/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '07-map-assumptions-open');
  await page.getByRole('button', { name: /Assumptions/ }).click();

  await page.getByTestId('prov-badge').first().click();
  await page.waitForTimeout(400);
  await shot(page, '08-provenance-popover');
  await page.mouse.click(5, 895);

  await page.getByRole('button', { name: /Flatten/ }).click();
  await page.waitForTimeout(1200);
  await shot(page, '09-map-flat');
  await page.getByRole('button', { name: /3D/ }).click();

  await page.keyboard.press('6');
  await page.waitForTimeout(800);
  await shot(page, '10-units');

  await page.keyboard.press('7');
  await page.waitForTimeout(9000);
  await shot(page, '11-memo-lapland');

  await page.getByRole('tab', { name: /Sources/ }).click();
  await page.waitForTimeout(600);
  await shot(page, '12-sources');

  await page.keyboard.press('?');
  await page.waitForTimeout(400);
  await shot(page, '13-help');
});
