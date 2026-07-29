/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

const fixturePath = resolve(process.env.GM_MEMORY_VISUAL_PATH || resolve(__dirname, '../fixtures/memory_usage_visualization.json'));

type CanvasKind = 'red' | 'colored';

interface CanvasStats {
  canvasCount: number;
  hash: number;
  painted: number;
}

interface CanvasCandidate {
  canvasIndex: number;
  color: [number, number, number, number];
  x: number;
  y: number;
}

interface SelectionEvidence {
  candidateCount: number;
  point: CanvasCandidate;
  tabCount: number;
}

interface FilterEvidence {
  allCanvas: CanvasStats;
  restoredCanvas: CanvasStats;
  tabTitle: string | null;
  writeCanvas: CanvasStats;
}

interface RulerRange {
  max: number;
  min: number;
  span: number;
}

const RULER_DIVISORS: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

interface GmMemoryEvidence {
  console: Array<{ text: string; type: string }>;
  failedRequests: Array<{ error: string; url: string }>;
  pageErrors: string[];
  screenshots: string[];
  scenarios: Record<string, unknown>;
  tensorCount: number;
}

async function canvasStats(locator: Locator): Promise<CanvasStats> {
  return locator.evaluate((element) => {
    const canvases = (element.matches('canvas') ? [element] : Array.from(element.querySelectorAll('canvas'))).filter(
      (item): item is HTMLCanvasElement => item instanceof HTMLCanvasElement,
    );
    let hash = 2166136261;
    let painted = 0;
    for (const canvas of canvases) {
      const context = canvas.getContext('2d');
      if (!context || !canvas.width || !canvas.height) continue;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const stride = Math.max(1, Math.floor(Math.max(canvas.width, canvas.height) / 900));
      for (let y = 0; y < canvas.height; y += stride) {
        for (let x = 0; x < canvas.width; x += stride) {
          const offset = (y * canvas.width + x) * 4;
          const alpha = pixels[offset + 3];
          if (alpha > 16) painted++;
          hash ^= pixels[offset] + pixels[offset + 1] * 3 + pixels[offset + 2] * 7 + alpha * 11;
          hash = Math.imul(hash, 16777619);
        }
      }
    }
    return { canvasCount: canvases.length, hash: hash >>> 0, painted };
  });
}

async function waitForPaintedCanvas(locator: Locator): Promise<CanvasStats> {
  await expect.poll(async () => (await canvasStats(locator)).painted).toBeGreaterThan(100);
  return canvasStats(locator);
}

async function waitForCanvasHashChange(locator: Locator, previousHash: number, timeout = 30000): Promise<CanvasStats> {
  await expect.poll(async () => (await canvasStats(locator)).hash, { timeout }).not.toBe(previousHash);
  return canvasStats(locator);
}

async function canvasCandidates(container: Locator, kind: CanvasKind): Promise<CanvasCandidate[]> {
  return container.evaluate((element, requestedKind) => {
    const cells = new Set();
    const points: CanvasCandidate[] = [];
    const canvases = Array.from(element.querySelectorAll('canvas'));
    for (const [canvasIndex, canvas] of canvases.entries()) {
      const context = canvas.getContext('2d');
      if (!context) continue;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const scaleX = canvas.clientWidth / canvas.width;
      const scaleY = canvas.clientHeight / canvas.height;
      const step = Math.max(2, Math.floor(Math.max(canvas.width, canvas.height) / 700));
      for (let y = step; y < canvas.height - step; y += step) {
        for (let x = step; x < canvas.width - step; x += step) {
          const offset = (y * canvas.width + x) * 4;
          const [r, g, b, a] = [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]];
          // Conflict fills are alpha-blended over the dark chart, so their interior red is much dimmer than the border.
          const isRed = a > 45 && r > 75 && r > g * 1.3 && r > b * 1.15;
          const isColored = a > 45 && Math.max(r, g, b) - Math.min(r, g, b) > 34 && Math.max(r, g, b) > 90;
          if ((requestedKind === 'red' && !isRed) || (requestedKind === 'colored' && (!isColored || isRed))) continue;
          const cssX = x * scaleX;
          const cssY = y * scaleY;
          const key = `${canvasIndex}:${Math.floor(cssX / 14)}:${Math.floor(cssY / 10)}`;
          if (cells.has(key)) continue;
          cells.add(key);
          points.push({ canvasIndex, color: [r, g, b, a], x: cssX, y: cssY });
          if (points.length >= 480) return points;
        }
      }
    }
    return points;
  }, kind);
}

async function closeSidebar(page: Page): Promise<void> {
  const closeButton = page.getByRole('button', { name: 'Close panel' });
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await expect(page.locator('.right-sidebar')).toBeHidden();
  }
}

async function findSelection(page: Page, kind: CanvasKind, minimumTabs: number): Promise<SelectionEvidence> {
  await closeSidebar(page);
  const container = page.locator('.echarts-container');
  const candidates = await canvasCandidates(container, kind);
  let opened = 0;
  let maximumTabs = 0;
  for (const point of candidates) {
    const canvas = container.locator('canvas').nth(point.canvasIndex);
    const box = await canvas.boundingBox();
    if (!box) break;
    await page.mouse.click(box.x + point.x, box.y + point.y);
    if (!(await page.locator('.right-sidebar').isVisible().catch(() => false))) continue;
    opened++;
    const tabCount = await page.locator('.tensor-tab').count();
    maximumTabs = Math.max(maximumTabs, tabCount);
    if (tabCount >= minimumTabs) return { candidateCount: candidates.length, point, tabCount };
    await closeSidebar(page);
  }
  throw new Error(
    `Could not discover a visible ${kind} tensor area with at least ${minimumTabs} tab(s) ` +
      `(candidates=${candidates.length}, opened=${opened}, maximumTabs=${maximumTabs}, first=${JSON.stringify(candidates.slice(0, 5))})`,
  );
}

async function rulerLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const trace = window.__canvasTextTrace;
    const labels = trace
      .filter((entry) => String(entry.parentClass).includes('echarts-dom'))
      .filter((entry) => entry.rotated && /#666666|rgb\(102,\s*102,\s*102\)/i.test(entry.fillStyle))
      .filter((entry) => /-?[0-9.,]+\s*(?:B|KB|MB|GB)/i.test(entry.text))
      .slice(-16)
      .map((entry) => entry.text);
    return [...new Set(labels)];
  });
}

function rulerRange(labels: string[]): RulerRange | null {
  const values = labels.map((label) => {
    const match = label.trim().match(/^(-?(?:\d+(?:[.,]\d+)?))\s*(GB|MB|KB|B)$/i);
    if (!match) {
      return NaN;
    }
    return Number(match[1].replace(',', '.')) * RULER_DIVISORS[match[2].toUpperCase()];
  }).filter(Number.isFinite);
  return values.length ? { max: Math.max(...values), min: Math.min(...values), span: Math.max(...values) - Math.min(...values) } : null;
}

function requireRulerRange(range: RulerRange | null): RulerRange {
  if (!range) {
    throw new Error('Expected at least one ruler range');
  }
  return range;
}

async function clearRulerTrace(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__canvasTextTrace = [];
  });
}

async function capture(page: Page, testInfo: TestInfo, evidence: GmMemoryEvidence, name: string): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  evidence.screenshots.push(path);
}

async function attachEvidence(testInfo: TestInfo, evidence: GmMemoryEvidence): Promise<void> {
  const evidencePath = testInfo.outputPath('evidence.json');
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await testInfo.attach('GM memory evidence', { contentType: 'application/json', path: evidencePath });
}

async function selectFilterableTensor(page: Page, writeSwitch: Locator): Promise<FilterEvidence> {
  const tabs = page.locator('.tensor-tab');
  const tabCount = await tabs.count();
  for (let index = 0; index < tabCount; index++) {
    await tabs.nth(index).click();
    const chart = page.locator('.memory-lane-chart');
    const writeCanvas = await waitForPaintedCanvas(chart);
    await writeSwitch.click();
    let allCanvas: CanvasStats;
    try {
      allCanvas = await waitForCanvasHashChange(chart, writeCanvas.hash, process.env.GM_MEMORY_VISUAL_PATH ? 2000 : 30000);
    } catch {
      await writeSwitch.click();
      continue;
    }
    await writeSwitch.click();
    await expect.poll(async () => (await canvasStats(chart)).hash).toBe(writeCanvas.hash);
    const restoredCanvas = await canvasStats(chart);
    if (allCanvas.hash !== writeCanvas.hash && restoredCanvas.hash === writeCanvas.hash) {
      return { allCanvas, restoredCanvas, tabTitle: await tabs.nth(index).getAttribute('title'), writeCanvas };
    }
  }
  throw new Error('No visible conflict tensor exposed read cards when Write-only was disabled');
}

async function loadGmMemoryFixture(page: Page, baseURL: string | undefined): Promise<GmMemoryEvidence> {
  if (!baseURL) {
    throw new Error('Playwright baseURL is required');
  }

  const evidence: GmMemoryEvidence = { console: [], failedRequests: [], pageErrors: [], screenshots: [], scenarios: {}, tensorCount: 0 };
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') evidence.console.push({ text: message.text(), type: message.type() });
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.stack || error.message));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    evidence.failedRequests.push({ error: failure ? failure.errorText : 'unknown', url: request.url() });
  });

  await page.addInitScript(() => {
    const browserWindow = window;
    browserWindow.__vscodeMessages = [];
    browserWindow.acquireVsCodeApi = () => ({
      postMessage: (message) => browserWindow.__vscodeMessages.push(message),
      getState: () => null,
      setState: () => {},
    });
    browserWindow.__canvasTextTrace = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function fillText(text, x, y, maxWidth) {
      const canvasParentClass = this.canvas.parentElement && this.canvas.parentElement.className;
      const parentClass = this.canvas.closest('.echarts-dom') ? 'echarts-dom' : canvasParentClass || '';
      const transform = this.getTransform();
      const rotated = Math.abs(transform.b) > 0.5 || Math.abs(transform.c) > 0.5;
      browserWindow.__canvasTextTrace.push({
        fillStyle: String(this.fillStyle),
        parentClass,
        rotated,
        text: String(text),
        timestamp: performance.now(),
        x,
        y,
      });
      if (browserWindow.__canvasTextTrace.length > 20000) browserWindow.__canvasTextTrace.splice(0, 10000);
      return maxWidth === undefined ? originalFillText.call(this, text, x, y) : originalFillText.call(this, text, x, y, maxWidth);
    };
  });
  await page.route(`${baseURL}/`, async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replaceAll('{{staticPath}}', `${baseURL}/src`).replaceAll('{{ascTheme}}', 'dark').replaceAll('{{ascLang}}', 'en-us');
    body = body.replace(
      "window.extensionQuery = '{{query}}';",
      "window.extensionQuery = { _viewType: 'gmMemoryVisual', _uri: '', " +
        "_server: { refs: ['GmMemoryVisualData'], apis: ['reportGmMemoryVisualReady'] } };",
    );
    await route.fulfill({ body, headers: { ...response.headers(), 'content-type': 'text/html; charset=utf-8' }, response });
  });

  await page.goto('/');
  await expect(page.locator('#boot-middleLayer')).toBeAttached();
  const fixtureText = await readFile(fixturePath, 'utf8');
  const fixture = JSON.parse(fixtureText) as { rawTensors?: unknown[] };
  evidence.tensorCount = fixture.rawTensors ? fixture.rawTensors.length : 0;
  await page.evaluate((value) => {
    window.postMessage({ channel: 'viewServerRef', data: { key: 'GmMemoryVisualData', value }}, '*');
  }, fixtureText);

  return evidence;
}

async function assertInitialRender(page: Page, testInfo: TestInfo, evidence: GmMemoryEvidence): Promise<void> {
  await expect(page.locator('.search-input')).toBeVisible({ timeout: 60000 });
  const canvas = page.locator('.echarts-container canvas').last();
  await expect(canvas).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return box ? box.width : 0;
  }).toBeGreaterThan(100);
  const stats = await waitForPaintedCanvas(page.locator('.echarts-container'));
  if (process.env.GM_MEMORY_VISUAL_PATH) {
    expect(evidence.tensorCount).toBeGreaterThan(0);
  } else {
    expect(evidence.tensorCount).toBe(12);
  }
  expect(stats.painted).toBeGreaterThan(100);
  evidence.scenarios.initial = { canvas: stats, viewport: page.viewportSize() };
  await capture(page, testInfo, evidence, '01-initial');
}

test('GM memory representative fixture renders', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);
  await attachEvidence(testInfo, evidence);
});

test('GM memory representative fixture interactions', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);

  await test.step('single tensor selection', async () => {
    const selection = await findSelection(page, 'colored', 1);
    await expect(page.locator('.tensor-tab[aria-selected="true"]')).toHaveCount(1);
     await expect(page.locator('.memory-lane-chart canvas')).not.toHaveCount(0);
    await expect(page.getByLabel('Show writes only')).toHaveCount(1);
    evidence.scenarios.singleSelection = selection;
    await capture(page, testInfo, evidence, '02-sidebar');
  });

  await test.step('conflict tabs and navigation', async () => {
    const selection = await findSelection(page, 'red', 2);
    await expect(page.locator('.tensor-tab[aria-selected="true"]')).toHaveCount(1);
    const activeTab = page.locator('.tensor-tab[aria-selected="true"]');
    const initialTitle = await activeTab.getAttribute('title');
    await activeTab.hover();
    await expect(page.locator('.tensor-preview')).toBeVisible();
    const preview = await page.locator('.tensor-preview').innerText();
     const before = await canvasStats(page.locator('.memory-lane-chart'));
    const nextButton = page.getByRole('button', { name: 'Next tensor' });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();
    const nextTitle = await page.locator('.tensor-tab[aria-selected="true"]').getAttribute('title');
     const after = await canvasStats(page.locator('.memory-lane-chart'));
    expect(nextTitle).not.toBe(initialTitle);
    expect(after.hash).not.toBe(before.hash);
    const previousButton = page.getByRole('button', { name: 'Previous tensor' });
    await expect(previousButton).toBeEnabled();
    await previousButton.click();
    await expect(page.locator('.tensor-tab[aria-selected="true"]')).toHaveAttribute('title', initialTitle || '');
    evidence.scenarios.conflict = { preview, selection, initialTitle, nextTitle };
  });

  const writeSwitch = page.getByLabel('Show writes only');
  let fullRange: RulerRange;
  let zoomRange: RulerRange;
  await test.step('filter and horizontal zoom', async () => {
    const filterEvidence = await selectFilterableTensor(page, writeSwitch);
    const { restoredCanvas } = filterEvidence;

    const fullLabels = await rulerLabels(page);
    fullRange = requireRulerRange(rulerRange(fullLabels));
    await clearRulerTrace(page);
     await page.locator('.memory-lane-chart').hover();
    await page.keyboard.down('Control');
    for (let index = 0; index < 5; index++) {
      await page.mouse.wheel(0, -260);
    }
    await page.keyboard.up('Control');
    await expect.poll(async () => rulerRange(await rulerLabels(page))?.span || 0).toBeLessThan(fullRange.span);
      const zoomLabels = await rulerLabels(page);
      zoomRange = requireRulerRange(rulerRange(zoomLabels));
      expect(zoomRange.span, JSON.stringify({ fullLabels, zoomLabels })).toBeLessThan(fullRange.span);
      expect(zoomLabels.some((label) => label.includes('.'))).toBe(true);
      expect(zoomLabels.every((label) => !label.includes(','))).toBe(true);
     const zoomCanvas = await canvasStats(page.locator('.memory-lane-chart'));
     expect(zoomCanvas.painted).toBeGreaterThan(100);
       await test.step('fixed slider updates the shared range while lanes scroll', async () => {
         await page.setViewportSize({ width: 1900, height: 600 });
         const body = page.locator('.sidebar-body-wrapper');
         const controls = page.locator('.memory-zoom-controls');
         const beforeControls = await controls.boundingBox();
         await body.evaluate((element) => {
           element.style.flex = '0 0 200px';
           element.style.height = '200px';
           element.scrollTop = element.scrollHeight;
         });
         await expect.poll(async () => body.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(0);
         await body.evaluate((element) => {
           element.scrollTop = element.scrollHeight;
         });
         await expect.poll(async () => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
         const afterControls = await controls.boundingBox();
         expect(afterControls).not.toBeNull();
         expect(Math.abs((afterControls?.y || 0) - (beforeControls?.y || 0))).toBeLessThanOrEqual(1);
         const controlCanvas = page.locator('.memory-control-chart canvas');
         await expect(controlCanvas).toBeVisible();
         expect((await controlCanvas.boundingBox())?.height || 0).toBeGreaterThan(100);
         await expect(page.locator('.memory-lane-chart')).toBeVisible();

         const control = page.locator('.memory-control-chart');
         const box = await control.boundingBox();
         if (!box) {
           throw new Error('Memory control chart is not visible');
         }
          const total = fullRange.max || 1;
         const plotLeft = box.x + 110;
         const plotWidth = box.width - 140;
         const rangeDragStartX = plotLeft + ((zoomRange.min + zoomRange.max) / (2 * total)) * plotWidth;
         const rangeDragY = box.y + 18;
         const beforeRangeDrag = zoomRange;
         await clearRulerTrace(page);
         await page.mouse.move(rangeDragStartX, rangeDragY);
         await page.mouse.down();
         await page.mouse.move(rangeDragStartX + 200, rangeDragY, { steps: 10 });
         await page.mouse.up();
         await expect.poll(async () => rulerRange(await rulerLabels(page))?.min || 0).not.toBeCloseTo(beforeRangeDrag.min, 1);
         const afterRangeDrag = requireRulerRange(rulerRange(await rulerLabels(page)));
         const expectedRangeShift = (200 / plotWidth) * total;
         const rangeDrag = {
           before: beforeRangeDrag,
           after: afterRangeDrag,
           dragPixels: 200,
           expectedShift: expectedRangeShift,
           minShift: Math.abs(afterRangeDrag.min - beforeRangeDrag.min),
         };
         expect(rangeDrag.minShift).toBeGreaterThan(expectedRangeShift * 0.75);
         zoomRange = afterRangeDrag;

         const start = zoomRange.min - zoomRange.span / 16;
         const handleX = plotLeft + (start / total) * plotWidth;
        const handleY = box.y + 18;
        await clearRulerTrace(page);
        await page.mouse.move(handleX, handleY);
        await page.mouse.down();
          await page.mouse.move(handleX + 35, handleY, { steps: 6 });
          await page.mouse.up();
          await expect.poll(async () => rulerRange(await rulerLabels(page))?.min || 0).not.toBeCloseTo(zoomRange.min, 1);
          const afterSliderDrag = requireRulerRange(rulerRange(await rulerLabels(page)));
          const sliderDrag = {
            before: zoomRange,
            after: afterSliderDrag,
            dragPixels: 35,
            minShift: Math.abs(afterSliderDrag.min - zoomRange.min),
          };
          zoomRange = afterSliderDrag;
          const beforeRulerPan = zoomRange;
          const rulerPanPixels = 200;
          const rulerY = box.y + 90;
          await clearRulerTrace(page);
          await page.mouse.move(plotLeft + plotWidth / 2, rulerY);
          await page.mouse.down();
          await page.mouse.move(plotLeft + plotWidth / 2 + rulerPanPixels, rulerY, { steps: 10 });
          await page.mouse.up();
          await expect.poll(async () => rulerRange(await rulerLabels(page))?.min || 0).not.toBeCloseTo(beforeRulerPan.min, 1);
          zoomRange = requireRulerRange(rulerRange(await rulerLabels(page)));
          const expectedRulerShift = (rulerPanPixels / plotWidth) * total;
          const rulerShift = Math.abs(zoomRange.min - beforeRulerPan.min);
          expect(rulerShift).toBeGreaterThan(expectedRulerShift * 0.75);
          expect(Math.abs(zoomRange.span - beforeRulerPan.span)).toBeLessThan(Math.max(1, beforeRulerPan.span * 0.05));
          evidence.scenarios.fixedControls = {
            controlY: afterControls?.y,
            rulerPan: { after: zoomRange, before: beforeRulerPan, dragPixels: rulerPanPixels, expectedShift: expectedRulerShift,
              minShift: rulerShift, plotWidth },
            rangeDrag,
            scrollTop: await body.evaluate((element) => element.scrollTop),
            sliderDrag,
            zoomRange,
          };
         await body.evaluate((element) => {
           element.style.flex = '';
           element.style.height = '';
           element.scrollTop = 0;
         });
         await page.setViewportSize({ width: 1900, height: 950 });
       });
      evidence.scenarios.filterAndZoom = { ...filterEvidence, fullLabels, fullRange, zoomCanvas, zoomLabels, zoomRange };
     await capture(page, testInfo, evidence, '03-zoomed');

     await test.step('horizontal plot drag pans the shared range', async () => {
       const lane = page.locator('.memory-lane-chart');
       const box = await lane.boundingBox();
        if (!box) {
          throw new Error('Memory lane chart is not visible');
        }
        const beforePan = requireRulerRange(rulerRange(await rulerLabels(page)));
        const beforeStart = Number(await lane.getAttribute('data-zoom-start'));
        const y = box.y + Math.min(100, box.height / 2);
        await page.mouse.move(box.x + 260, y);
        await page.mouse.down();
        await expect(lane).toHaveCSS('cursor', 'grabbing');
        await page.mouse.move(box.x + 340, y, { steps: 8 });
        await page.mouse.up();
        await expect.poll(async () => Number(await lane.getAttribute('data-zoom-start'))).not.toBeCloseTo(beforeStart, 2);
        const afterStart = Number(await lane.getAttribute('data-zoom-start'));
        const plotWidth = box.width - 140;
        const expectedShift = (80 / plotWidth) * (fullRange.max || 1);
        const actualShift = Math.abs(afterStart - beforeStart);
        expect(actualShift).toBeGreaterThan(expectedShift * 0.75);
        evidence.scenarios.horizontalPan = { beforePan, beforeStart, afterStart, actualShift, expectedShift };
     });
   });

  await test.step('zoom state survives filtering and resizing', async () => {
    await clearRulerTrace(page);
    await writeSwitch.click();
    await expect.poll(async () => rulerRange(await rulerLabels(page))?.span || 0).toBeGreaterThan(0);
    const filteredRange = requireRulerRange(rulerRange(await rulerLabels(page)));
    await writeSwitch.click();
    await expect.poll(async () => rulerRange(await rulerLabels(page))?.span || 0).toBeGreaterThan(0);
    expect(Math.abs(filteredRange.span - zoomRange.span)).toBeLessThan(Math.max(0.01, zoomRange.span * 0.05));

    const handle = page.locator('.resize-handle');
    const box = await handle.boundingBox();
    if (!box) {
      throw new Error('Resize handle is not visible');
    }
     const beforeResize = await page.locator('.memory-lane-chart').boundingBox();
    const beforeResizeLabels = await rulerLabels(page);
    await clearRulerTrace(page);
    await page.mouse.move(box.x + box.width / 2, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x - 100, box.y + 100, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => {
       const currentBox = await page.locator('.memory-lane-chart').boundingBox();
      return currentBox ? currentBox.width : 0;
    }).not.toBe(beforeResize?.width || 0);
    const resizedRange = requireRulerRange(rulerRange(await rulerLabels(page)));
    expect(Math.abs(resizedRange.span - zoomRange.span)).toBeLessThan(Math.max(0.01, zoomRange.span * 0.08));
    expect(await rulerLabels(page)).toEqual(beforeResizeLabels);

    await clearRulerTrace(page);
    const tabs = page.locator('.tensor-tab');
    const originalTabTitle = await page.locator('.tensor-tab[aria-selected="true"]').getAttribute('title');
    const firstTabIsActive = (await tabs.first().getAttribute('aria-selected')) === 'true';
     const beforeSwitch = await canvasStats(page.locator('.memory-lane-chart'));
    await tabs.nth(firstTabIsActive ? 1 : 0).click();
     await waitForCanvasHashChange(page.locator('.memory-lane-chart'), beforeSwitch.hash);
    const switchedTensorRange = requireRulerRange(rulerRange(await rulerLabels(page)));
    const originalTabIndex = await tabs.evaluateAll(
      (elements, title) => elements.findIndex((element) => element.getAttribute('title') === title),
      originalTabTitle,
    );
    expect(originalTabIndex).toBeGreaterThanOrEqual(0);
    await clearRulerTrace(page);
     const beforeRestore = await canvasStats(page.locator('.memory-lane-chart'));
    await tabs.nth(originalTabIndex).click();
     await waitForCanvasHashChange(page.locator('.memory-lane-chart'), beforeRestore.hash);
    const restoredTensorRange = requireRulerRange(rulerRange(await rulerLabels(page)));
    expect(Math.abs(restoredTensorRange.span - fullRange.span)).toBeLessThan(Math.max(0.01, fullRange.span * 0.05));
    expect(restoredTensorRange.span).toBeGreaterThan(zoomRange.span);
    evidence.scenarios.statePreservation = { filteredRange, resizedRange, restoredTensorRange, switchedTensorRange };
    await capture(page, testInfo, evidence, '04-resized');
  });

  await test.step('narrow viewport and runtime health', async () => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect.poll(async () => {
       const currentBox = await page.locator('.memory-lane-chart').boundingBox();
      return currentBox ? currentBox.width : 0;
    }).toBeGreaterThan(300);
    const switchBox = await writeSwitch.boundingBox();
    const closeBox = await page.getByRole('button', { name: 'Close panel' }).boundingBox();
     const detailBox = await page.locator('.memory-lane-chart').boundingBox();
    if (!switchBox || !closeBox || !detailBox) {
      throw new Error('Expected the responsive detail controls to be visible');
    }
    expect(switchBox.x + switchBox.width).toBeLessThanOrEqual(closeBox.x + 1);
    expect(detailBox.width).toBeGreaterThan(300);
    expect(detailBox.height).toBeGreaterThan(200);
    await capture(page, testInfo, evidence, '05-final');

    const harnessNoise = new RegExp(
      [
        'swimDataPath',
        'welcome/getIsCompleteBoot.*timeout',
        'timeout.*welcome/getIsCompleteBoot',
        'Canvas2D:.*willReadFrequently',
        'WebSocket connection.*ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS',
        '\\[vite\\] failed to connect to websocket',
        'Unhandled error during execution of mounted hook[\\s\\S]*at <(?:MiddleLayer|App)>',
      ].join('|'),
      'i',
    );
    const productPageErrors = evidence.pageErrors.filter((message) => !harnessNoise.test(message));
    const productConsole = evidence.console.filter(
      (entry) => !harnessNoise.test(entry.text) && !/timeout|extension|webview/i.test(entry.text),
    );
    const productRequests = evidence.failedRequests.filter((entry) => entry.url.startsWith(baseURL || ''));
    expect(productPageErrors).toEqual([]);
    expect(productConsole).toEqual([]);
    expect(productRequests).toEqual([]);
    evidence.scenarios.runtime = {
      harnessPageErrors: evidence.pageErrors.filter((message) => harnessNoise.test(message)),
      productConsole,
      productPageErrors,
      productRequests,
    };
  });

  await attachEvidence(testInfo, evidence);
});
