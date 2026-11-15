import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

// Every demo step at three projector/laptop sizes. Fails if any visible panels, cards or labels
// ([data-box]) overlap within the same layer ([data-layer]; the drawer, popovers, tooltips and the
// help overlay are their own layers), or if any text is clipped: an element's scrollWidth exceeds its
// clientWidth, or a box is cut off by its scroll container or the window. Screenshots go to
// screenshots/redesign/<size>/.

const SIZES: [number, number][] = [
  [1280, 720],
  [1440, 900],
  [1920, 1080],
];

interface Problem {
  kind: string;
  a: string;
  b?: string;
  detail: string;
}

async function layoutProblems(page: Page): Promise<Problem[]> {
  return page.evaluate(() => {
    const out: { kind: string; a: string; b?: string; detail: string }[] = [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    const name = (el: Element) => {
      const box = el.getAttribute('data-box');
      const txt = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      return `${el.tagName.toLowerCase()}${box ? `[${box}]` : ''}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${txt}"`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      let p: Element | null = el;
      while (p) {
        const st = getComputedStyle(p);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
        p = p.parentElement;
      }
      return r.bottom > 0 && r.right > 0 && r.top < H && r.left < W;
    };
    const layer = (el: Element) => el.closest('[data-layer]')?.getAttribute('data-layer') ?? 'base';

    // 1. Overlaps between boxes in the same layer (ancestors/descendants excluded).
    const boxes = [...document.querySelectorAll('[data-box]')].filter(visible);
    const rects = boxes.map((b) => b.getBoundingClientRect());
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (a.contains(b) || b.contains(a) || layer(a) !== layer(b)) continue;
        const ra = rects[i];
        const rb = rects[j];
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 1 && h > 1) out.push({ kind: 'overlap', a: name(a), b: name(b), detail: `${w.toFixed(1)}x${h.toFixed(1)} px in layer ${layer(a)}` });
      }
    }

    // 2. Text clipped horizontally: any visible non-inline element with its own text.
    for (const el of document.querySelectorAll('body *')) {
      if (el instanceof SVGElement || el.tagName === 'CANVAS' || el.tagName === 'OPTION' || el.tagName === 'SELECT') continue;
      const st = getComputedStyle(el);
      if (st.display === 'inline' || st.display === 'contents') continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0);
      const he = el as HTMLElement;
      if (!hasText && !he.hasAttribute('data-box')) continue;
      if (!visible(el)) continue;
      if (he.scrollWidth > he.clientWidth + 1) out.push({ kind: 'clipped-x', a: name(el), detail: `scrollWidth ${he.scrollWidth} > clientWidth ${he.clientWidth}` });
    }

    // 3. Boxes cut off by a scroll container or by the window (e.g. the right column at 1280x720).
    for (const el of boxes) {
      const r = el.getBoundingClientRect();
      if (el.closest('[data-layer="map-labels"]')) continue; // placed inside the canvas by construction
      let p = el.parentElement;
      let clip = { left: 0, top: 0, right: W, bottom: H };
      while (p) {
        const st = getComputedStyle(p);
        if (st.overflowX !== 'visible' || st.overflowY !== 'visible') {
          const pr = p.getBoundingClientRect();
          clip = { left: Math.max(clip.left, pr.left), top: Math.max(clip.top, pr.top), right: Math.min(clip.right, pr.right), bottom: Math.min(clip.bottom, pr.bottom) };
        }
        p = p.parentElement;
      }
      if (r.left < clip.left - 1 || r.top < clip.top - 1 || r.right > clip.right + 1 || r.bottom > clip.bottom + 1)
        out.push({ kind: 'cut-off', a: name(el), detail: `box ${r.left.toFixed(0)},${r.top.toFixed(0)}-${r.right.toFixed(0)},${r.bottom.toFixed(0)} outside visible ${clip.left.toFixed(0)},${clip.top.toFixed(0)}-${clip.right.toFixed(0)},${clip.bottom.toFixed(0)}` });
    }
    if (document.documentElement.scrollWidth > W + 1) out.push({ kind: 'page-scroll-x', a: 'html', detail: `${document.documentElement.scrollWidth} > ${W}` });
    return out;
  });
}

interface Step {
  name: string;
  run: (page: Page) => Promise<void>;
}

const key = (k: string, wait: number) => async (page: Page) => {
  await page.keyboard.press(k);
  await page.waitForTimeout(wait);
};

const STEPS: Step[] = [
  { name: '00-initial', run: async () => {} },
  { name: '01-finland', run: key('1', 2200) },
  {
    name: '02a-utsjoki-flight',
    run: async (page) => {
      // Hold the route flight part-way so the tilted, bearing-following camera can be captured.
      await page.evaluate(() => ((window as unknown as { __matkaFlightHold?: number }).__matkaFlightHold = 0.42));
      await page.keyboard.press('2');
      await expect(page.getByTestId('travel-label')).not.toHaveText(/^0 km/, { timeout: 20_000 });
      await page.waitForTimeout(800);
    },
  },
  {
    name: '02b-utsjoki-route',
    run: async (page) => {
      await page.evaluate(() => delete (window as unknown as { __matkaFlightHold?: number }).__matkaFlightHold);
      await expect(page.getByTestId('travel-label')).toHaveText('676 km · 9 h 22 min', { timeout: 20_000 });
      await page.waitForTimeout(2600);
      await expect(page.getByTestId('night-icons')).toHaveAttribute('data-nights', '16');
      await expect(page.getByTestId('trip-dots')).toHaveAttribute('data-count', '4');
    },
  },
  {
    name: '03-breast-lever',
    run: async (page) => {
      await page.keyboard.press('3');
      await expect(page.getByTestId('lever')).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
      await page.waitForTimeout(2200);
      await expect(page.getByTestId('night-icons')).toHaveAttribute('data-nights', '6');
      await expect(page.getByTestId('trip-dots')).toHaveAttribute('data-count', '2');
    },
  },
  {
    name: '04-bone-lever',
    run: async (page) => {
      await page.keyboard.press('4');
      await expect(page.getByTestId('lever')).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
      await page.waitForTimeout(2200);
    },
  },
  {
    name: '05a-terrain',
    run: async (page) => {
      // Hold the key-5 sequence before the lever flips: terrain up on 15 sessions.
      await page.evaluate(() => ((window as unknown as { __matkaHold?: boolean }).__matkaHold = true));
      await page.keyboard.press('5');
      await page.waitForTimeout(3500);
      await expect(page.getByTestId('lever')).toHaveAttribute('aria-checked', 'false');
    },
  },
  {
    name: '05b-terrain-sunk',
    run: async (page) => {
      await page.evaluate(() => delete (window as unknown as { __matkaHold?: boolean }).__matkaHold);
      await expect(page.getByTestId('lever')).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 });
      await page.waitForTimeout(3000);
    },
  },
  {
    name: '05c-fold',
    run: async (page) => {
      await page.keyboard.press('1');
      await page.waitForTimeout(1800);
      await page.getByTestId('fold-toggle').click();
      await page.waitForTimeout(1500);
    },
  },
  {
    name: '05d-assumptions',
    run: async (page) => {
      await page.getByTestId('fold-toggle').click();
      await page.getByTestId('assumptions-toggle').click();
      await page.waitForTimeout(600);
      await expect(page.getByTestId('today-line')).toBeVisible();
    },
  },
  {
    name: '06-units',
    run: async (page) => {
      await page.keyboard.press('Escape');
      await page.keyboard.press('6');
      await page.waitForTimeout(1200);
    },
  },
  { name: '07-memo-lapland', run: key('7', 5500) },
  { name: '08-help', run: key('?', 500) },
  {
    name: '09-reset',
    run: async (page) => {
      await page.keyboard.press('Escape');
      await page.keyboard.press('0');
      await page.waitForTimeout(2200);
    },
  },
  {
    name: '10-sources',
    run: async (page) => {
      await page.getByRole('tab', { name: /Sources/ }).click();
      await page.waitForTimeout(800);
    },
  },
  {
    name: '11-provenance',
    run: async (page) => {
      await page.getByRole('tab', { name: 'Map' }).click();
      await page.waitForTimeout(1500);
      await page.getByTestId('route-line').getByTestId('prov-badge').click();
      await page.waitForTimeout(500);
    },
  },
];

for (const [width, height] of SIZES) {
  test(`layout at ${width}x${height}: no overlaps, no clipped text`, async ({ page, baseURL }) => {
    test.setTimeout(420_000);
    const dir = `screenshots/redesign/${width}x${height}`;
    fs.mkdirSync(dir, { recursive: true });
    const errors: string[] = [];
    const external: string[] = [];
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith(baseURL!) && !url.startsWith('data:') && !url.startsWith('blob:')) external.push(url);
    });
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByTestId('app-ready')).toBeAttached({ timeout: 20_000 });
    await page.waitForTimeout(2000);

    const failures: string[] = [];
    for (const step of STEPS) {
      await step.run(page);
      await page.screenshot({ path: `${dir}/${step.name}.png` });
      const problems = await layoutProblems(page);
      for (const p of problems) failures.push(`${step.name}: ${p.kind} ${p.a}${p.b ? ` × ${p.b}` : ''} (${p.detail})`);
    }
    // The map takes at least 60% of the width.
    await page.locator('.popover-backdrop').click();
    const mapW = await page.getByTestId('mapcanvas').evaluate((el) => el.getBoundingClientRect().width);
    expect(mapW / width, 'map share of width').toBeGreaterThanOrEqual(0.6);

    expect(failures, failures.join('\n')).toEqual([]);
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
    expect(external, `external requests:\n${external.join('\n')}`).toEqual([]);
  });
}
