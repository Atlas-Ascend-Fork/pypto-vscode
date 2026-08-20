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
  '': 1,
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

async function findDistinctTensorPoint(page: Page, first: CanvasCandidate): Promise<CanvasCandidate> {
  const container = page.locator('.echarts-container');
  const candidates = await canvasCandidates(container, 'colored');
  for (const candidate of candidates) {
    if (candidate.canvasIndex !== first.canvasIndex || !candidate.color.some((value, index) => Math.abs(value - first.color[index]) > 24)) {
      continue;
    }

    const canvas = container.locator('canvas').nth(candidate.canvasIndex);
    const box = await canvas.boundingBox();
    if (!box) {
      continue;
    }

    await page.mouse.click(box.x + candidate.x, box.y + candidate.y);
    if (await page.locator('.right-sidebar').isVisible().catch(() => false)) {
      await closeSidebar(page);
      return candidate;
    }
  }

  throw new Error(`Could not discover a second visible tensor area distinct from ${JSON.stringify(first)}`);
}

async function clickWithAlt(page: Page, canvas: Locator, point: CanvasCandidate): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Memory chart canvas is not visible');
  }

  await page.keyboard.down('Alt');
  try {
    await page.mouse.click(box.x + point.x, box.y + point.y);
  } finally {
    await page.keyboard.up('Alt');
  }
}

async function rightClickTensor(page: Page, canvas: Locator, point: CanvasCandidate): Promise<void> {
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error('Memory chart canvas is not visible');
  }

  await page.mouse.click(box.x + point.x, box.y + point.y, { button: 'right' });
}

async function rulerLabels(page: Page, dimension = 0): Promise<string[]> {
  return page.evaluate((requestedDimension) => {
    const trace = window.__canvasTextTrace;
    const labels = trace
      .filter((entry) => String(entry.parentClass).includes('echarts-dom'))
      .filter((entry) => entry.rotated && /#666666|rgb\(102,\s*102,\s*102\)/i.test(entry.fillStyle))
      .filter((entry) => /^-?[0-9.,]+\s*(?:B|KB|MB|GB)?$/i.test(entry.text))
      .map((entry) => entry.text);
    const dimensionCount = Math.max(
      1,
      new Set(trace.filter((entry) => /^Dim_\d+$/.test(entry.text)).map((entry) => entry.text)).size,
    );
    const latestLabels = labels.slice(-(dimensionCount * 16));
    return latestLabels.slice(requestedDimension * 16, (requestedDimension + 1) * 16);
  }, dimension);
}

function rulerRange(labels: string[]): RulerRange | null {
  const values = labels.map((label) => {
    const match = label.trim().match(/^(-?(?:\d+(?:[.,]\d+)?))\s*(GB|MB|KB|B)?$/i);
    if (!match) {
      return NaN;
    }
    return Number(match[1].replace(',', '.')) * RULER_DIVISORS[(match[2] || '').toUpperCase()];
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
  await page.getByRole('button', { name: 'Chart view' }).click();
  await expect(page.locator('.memory-lane-chart')).toBeVisible();
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

async function loadGmMemoryFixture(
  page: Page,
  baseURL: string | undefined,
  theme = 'dark',
  lang = 'en-us',
  fixtureTextOverride?: string,
): Promise<GmMemoryEvidence> {
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
    browserWindow.__canvasPathTrace = [];
    const canvasPaths = new WeakMap<CanvasRenderingContext2D, Array<{ x: number; y: number }>>();
    const originalBeginPath = CanvasRenderingContext2D.prototype.beginPath;
    const originalMoveTo = CanvasRenderingContext2D.prototype.moveTo;
    const originalLineTo = CanvasRenderingContext2D.prototype.lineTo;
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.beginPath = function beginPath() {
      canvasPaths.set(this, []);
      return originalBeginPath.call(this);
    };
    CanvasRenderingContext2D.prototype.moveTo = function moveTo(x, y) {
      canvasPaths.get(this)?.push({ x, y });
      return originalMoveTo.call(this, x, y);
    };
    CanvasRenderingContext2D.prototype.lineTo = function lineTo(x, y) {
      canvasPaths.get(this)?.push({ x, y });
      return originalLineTo.call(this, x, y);
    };
    CanvasRenderingContext2D.prototype.stroke = function stroke() {
      const color = String(this.strokeStyle).toLowerCase();
      const compactColor = color.replace(/\s/g, '');
      if (color === '#6ea8ff' || color === '#0a59f7' || compactColor.includes('rgb(110,168,255)') || compactColor.includes('rgb(10,89,247)')) {
        const transform = this.getTransform();
        const points = (canvasPaths.get(this) || []).map(({ x, y }) => {
          const transformedX = x * transform.a + y * transform.c + transform.e;
          const transformedY = x * transform.b + y * transform.d + transform.f;
          return {
            x: transformedX * this.canvas.clientWidth / this.canvas.width,
            y: transformedY * this.canvas.clientHeight / this.canvas.height,
          };
        });
        if (points.length) {
          browserWindow.__canvasPathTrace.push({
            canvasWidth: this.canvas.clientWidth,
            canvasHeight: this.canvas.clientHeight,
            color,
            points,
          });
        }
      }
      return (originalStroke as unknown as () => void).call(this);
    };
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
    body = body.replaceAll('{{staticPath}}', `${baseURL}/src`).replaceAll('{{ascTheme}}', theme).replaceAll('{{ascLang}}', lang);
    body = body.replace(
      "window.extensionQuery = '{{query}}';",
      "window.extensionQuery = { _viewType: 'gmMemoryVisual', _uri: '', " +
        "_server: { refs: ['GmMemoryVisualData'], apis: ['reportGmMemoryVisualReady'] } };",
    );
    await route.fulfill({ body, headers: { ...response.headers(), 'content-type': 'text/html; charset=utf-8' }, response });
  });

  await page.goto('/');
  await expect(page.locator('#boot-middleLayer')).toBeAttached();
  const fixtureText = fixtureTextOverride ?? await readFile(fixturePath, 'utf8');
  const fixture = JSON.parse(fixtureText) as { rawTensors?: unknown[] };
  evidence.tensorCount = fixture.rawTensors ? fixture.rawTensors.length : 0;
  await page.evaluate((value) => {
    window.postMessage({ channel: 'viewServerRef', data: { key: 'GmMemoryVisualData', value }}, '*');
  }, fixtureText);

  return evidence;
}

async function assertInitialRender(page: Page, testInfo: TestInfo, evidence: GmMemoryEvidence, expectedTensorCount?: number): Promise<void> {
  await expect(page.locator('.search-input')).toBeVisible({ timeout: 60000 });
  const canvas = page.locator('.echarts-container canvas').last();
  await expect(canvas).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => {
    const box = await canvas.boundingBox();
    return box ? box.width : 0;
  }).toBeGreaterThan(100);
  const stats = await waitForPaintedCanvas(page.locator('.echarts-container'));
  if (expectedTensorCount !== undefined) {
    expect(evidence.tensorCount).toBe(expectedTensorCount);
  } else if (process.env.GM_MEMORY_VISUAL_PATH) {
    expect(evidence.tensorCount).toBeGreaterThan(0);
  } else {
    expect(evidence.tensorCount).toBe(12);
  }
  expect(stats.painted).toBeGreaterThan(100);
  evidence.scenarios.initial = { canvas: stats, viewport: page.viewportSize() };
  await capture(page, testInfo, evidence, '01-initial');
}

async function getRegionLabelPoint(page: Page, regionId: number): Promise<{ x: number; y: number }> {
  await expect.poll(async () => {
    return page.evaluate((requestedRegionId) => {
      return window.__canvasTextTrace.some((entry) => entry.text.includes(`ID:${requestedRegionId}`));
    }, regionId);
  }).toBe(true);

  return page.evaluate((requestedRegionId) => {
    const entry = [...window.__canvasTextTrace].reverse().find((item) => item.text.includes(`ID:${requestedRegionId}`));
    if (!entry) {
      throw new Error(`Region ${requestedRegionId} label was not painted`);
    }
    return { x: entry.x, y: entry.y };
  }, regionId);
}

test('GM memory representative fixture renders', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);
  await attachEvidence(testInfo, evidence);
});

test('GM memory region drill-down works through the real canvas', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);

  const chart = page.locator('.echarts-container');
  const chartBox = await chart.boundingBox();
  if (!chartBox) {
    throw new Error('Memory chart is not visible');
  }
  const overviewCanvas = await canvasStats(chart);
  const regionPoint = await getRegionLabelPoint(page, 0);
  await clearRulerTrace(page);
  await page.mouse.dblclick(chartBox.x + regionPoint.x, chartBox.y + regionPoint.y);

  await expect(page.getByRole('button', { name: 'Back to all regions' })).toBeVisible();
  await expect(page.locator('.region-detail-name')).toHaveText('Region ID: 0');
  await page.waitForTimeout(250);
  expect(evidence.pageErrors.some((message) => message.includes('__ec_inner_'))).toBe(false);
  const detailCanvas = await waitForCanvasHashChange(chart, overviewCanvas.hash);
  expect(detailCanvas.painted).toBeGreaterThan(100);
  const detailLabels = await page.evaluate(() => window.__canvasTextTrace.map((entry) => entry.text));
  expect(detailLabels).toEqual(expect.arrayContaining(['1000', '2000']));
  expect(detailLabels.some((label) => label === 'Region\nID:1' || label === 'Region\nID:2')).toBe(false);
  await capture(page, testInfo, evidence, '02-region-detail');

  evidence.scenarios.regionDrillDown = { regionId: 0 };
  await capture(page, testInfo, evidence, '03-region-detail');

  await page.getByRole('button', { name: 'Back to all regions' }).click();
  await expect(page.locator('.region-detail-title')).toBeHidden();
  await waitForCanvasHashChange(chart, detailCanvas.hash);
  await capture(page, testInfo, evidence, '04-region-overview');
  await attachEvidence(testInfo, evidence);
});

test('GM memory Alt-click measures two tensors through the real chart event', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);
  await closeSidebar(page);

  const regionPoint = await getRegionLabelPoint(page, 0);
  const chartBox = await page.locator('.echarts-container').boundingBox();
  if (!chartBox) {
    throw new Error('GM memory chart is not visible');
  }
  await page.mouse.dblclick(chartBox.x + regionPoint.x, chartBox.y + regionPoint.y);
  await expect(page.locator('.region-detail-name')).toHaveText('Region ID: 0');

  const container = page.locator('.echarts-container');
  await waitForPaintedCanvas(container);
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as {
    rawTensors?: Array<{ base?: number; end?: number; regionId?: number }>;
    meta?: { regions?: Array<{ addr0?: number; regionId?: number; span?: number }>; t0?: number; timeUnit?: number };
  };
  const regionTensors = (fixture.rawTensors || []).filter((tensor) => Number(tensor.regionId) === 0) as Array<{
    base?: number;
    end?: number;
    lifeEnd?: number;
    lifeStart?: number;
    regionId?: number;
  }>;
  const firstTensor = regionTensors[0];
  const secondTensor = regionTensors.find((tensor) => tensor !== firstTensor && Number(tensor.base) > Number(firstTensor?.end));
  const selectedRegion = fixture.meta?.regions?.find((region) => Number(region.regionId) === 0);
  const timeUnit = Number(fixture.meta?.timeUnit);
  const t0 = Number(fixture.meta?.t0);
  const normalizedStarts = (fixture.rawTensors || []).map((tensor: any) => (Number(tensor.lifeStart) - t0) / timeUnit);
  const normalizedEnds = (fixture.rawTensors || []).map((tensor: any) => (Number(tensor.lifeEnd) - t0) / timeUnit);
  if (!firstTensor || !secondTensor || !selectedRegion || !Number.isFinite(timeUnit) || !Number.isFinite(t0)) {
    throw new Error('Expected two non-overlapping tensors in Region 0');
  }
  const chartBoxAfterDrillDown = await container.boundingBox();
  if (!chartBoxAfterDrillDown) {
    throw new Error('Memory chart is not visible after region drill-down');
  }
  const minimumTime = Math.max(0, Math.min(...normalizedStarts));
  const maximumTensorTime = Math.max(...normalizedEnds);
  const maximumTime = maximumTensorTime + Math.max((maximumTensorTime - minimumTime) * 0.05, 0.5);
  const tensorPoint = (tensor: { base?: number; end?: number; lifeStart?: number; lifeEnd?: number }): CanvasCandidate => ({
    canvasIndex: 0,
    color: [0, 0, 0, 0],
    x: 180 + ((((Number(tensor.lifeStart) + Number(tensor.lifeEnd)) / 2 - t0) / timeUnit - minimumTime) / (maximumTime - minimumTime)) *
      (chartBoxAfterDrillDown.width - 200),
    y: 20 + (((Number(tensor.base) + (Number(tensor.end) - Number(tensor.base)) * 0.1 - Number(selectedRegion.addr0)) /
      Number(selectedRegion.span)) *
      (chartBoxAfterDrillDown.height - 60)),
  });
  const first = tensorPoint(firstTensor);
  const second = tensorPoint(secondTensor);

  await clickWithAlt(page, container.locator('canvas').nth(first.canvasIndex), first);
  await expect(page.locator('.right-sidebar')).toBeHidden();
  await clickWithAlt(page, container.locator('canvas').nth(second.canvasIndex), second);
  await expect(page.locator('.memory-measurement-status')).toContainText('Distance:');
  await expect(page.locator('.right-sidebar')).toBeHidden();

  evidence.scenarios.altMeasurement = {
    first,
    second,
    label: await page.locator('.memory-measurement-status').innerText(),
  };
  await capture(page, testInfo, evidence, '02-alt-measurement');
  await attachEvidence(testInfo, evidence);
});

test('GM memory Alt-click displays a negative distance for overlapping tensors', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);
  await closeSidebar(page);

  const regionPoint = await getRegionLabelPoint(page, 0);
  const overview = page.locator('.echarts-container');
  const overviewBox = await overview.boundingBox();
  if (!overviewBox) {
    throw new Error('GM memory chart is not visible');
  }
  await page.mouse.dblclick(overviewBox.x + regionPoint.x, overviewBox.y + regionPoint.y);
  await expect(page.locator('.region-detail-name')).toHaveText('Region ID: 0');

  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as {
    rawTensors?: Array<{ base?: number; end?: number; lifeEnd?: number; lifeStart?: number; rawId?: string }>;
    meta?: { regions?: Array<{ addr0?: number; regionId?: number; span?: number }>; t0?: number; timeUnit?: number };
  };
  const tensorA = fixture.rawTensors?.find((tensor) => tensor.rawId === 'tensor-a');
  const tensorB = fixture.rawTensors?.find((tensor) => tensor.rawId === 'tensor-b');
  const selectedRegion = fixture.meta?.regions?.find((region) => Number(region.regionId) === 0);
  const timeUnit = Number(fixture.meta?.timeUnit);
  const t0 = Number(fixture.meta?.t0);
  if (!tensorA || !tensorB || !selectedRegion || !Number.isFinite(timeUnit) || !Number.isFinite(t0)) {
    throw new Error('Expected overlapping tensors in Region 0');
  }

  const container = page.locator('.echarts-container');
  const chartBox = await container.boundingBox();
  if (!chartBox) {
    throw new Error('Memory chart is not visible after region drill-down');
  }
  const normalizedStarts = (fixture.rawTensors || []).map((tensor) => (Number(tensor.lifeStart) - t0) / timeUnit);
  const normalizedEnds = (fixture.rawTensors || []).map((tensor) => (Number(tensor.lifeEnd) - t0) / timeUnit);
  const minimumTime = Math.max(0, Math.min(...normalizedStarts));
  const maximumTensorTime = Math.max(...normalizedEnds);
  const maximumTime = maximumTensorTime + Math.max((maximumTensorTime - minimumTime) * 0.05, 0.5);
  const tensorPoint = (tensor: typeof tensorA, timeRatio: number, addressRatio: number): CanvasCandidate => {
    const start = (Number(tensor.lifeStart) - t0) / timeUnit;
    const end = (Number(tensor.lifeEnd) - t0) / timeUnit;
    const time = start + (end - start) * timeRatio;
    const address = Number(tensor.base) + (Number(tensor.end) - Number(tensor.base)) * addressRatio;
    return {
      canvasIndex: 0,
      color: [0, 0, 0, 0],
      x: 180 + ((time - minimumTime) / (maximumTime - minimumTime)) * (chartBox.width - 200),
      y: 20 + ((address - Number(selectedRegion.addr0)) / Number(selectedRegion.span)) * (chartBox.height - 60),
    };
  };

  const first = tensorPoint(tensorA, 0.25, 0.25);
  const second = tensorPoint(tensorB, 0.75, 0.75);
  const canvas = container.locator('canvas').first();
  await clickWithAlt(page, canvas, first);
  await expect(page.locator('.right-sidebar')).toBeHidden();
  await clickWithAlt(page, canvas, second);
  await expect(page.locator('.memory-measurement-status')).toHaveText('Distance: -200');

  evidence.scenarios.overlappingAltMeasurement = {
    first,
    second,
    label: await page.locator('.memory-measurement-status').innerText(),
  };
  await capture(page, testInfo, evidence, '02-negative-alt-measurement');
  await attachEvidence(testInfo, evidence);
});

test('GM memory clips left measurement line after timeline zoom', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);
  await closeSidebar(page);

  const regionPoint = await getRegionLabelPoint(page, 0);
  const overview = page.locator('.echarts-container');
  const overviewBox = await overview.boundingBox();
  if (!overviewBox) {
    throw new Error('GM memory chart is not visible');
  }
  await page.mouse.dblclick(overviewBox.x + regionPoint.x, overviewBox.y + regionPoint.y);
  await expect(page.locator('.region-detail-name')).toHaveText('Region ID: 0');

  const fixture = JSON.parse(await readFile(fixturePath, 'utf8')) as {
    rawTensors?: Array<{ base?: number; end?: number; lifeEnd?: number; lifeStart?: number; regionId?: number }>;
    meta?: { regions?: Array<{ addr0?: number; regionId?: number; span?: number }>; t0?: number; timeUnit?: number };
  };
  const regionTensors = (fixture.rawTensors || []).filter((tensor) => Number(tensor.regionId) === 0);
  const firstTensor = regionTensors[0];
  const secondTensor = regionTensors.find((tensor) => Number(tensor.base) > Number(firstTensor?.end));
  const selectedRegion = fixture.meta?.regions?.find((region) => Number(region.regionId) === 0);
  const timeUnit = Number(fixture.meta?.timeUnit);
  const t0 = Number(fixture.meta?.t0);
  if (!firstTensor || !secondTensor || !selectedRegion || !Number.isFinite(timeUnit) || !Number.isFinite(t0)) {
    throw new Error('Expected non-overlapping tensors in Region 0');
  }

  const chartBox = await overview.boundingBox();
  if (!chartBox) {
    throw new Error('Memory chart is not visible after region drill-down');
  }
  const normalizedStarts = (fixture.rawTensors || []).map((tensor) => (Number(tensor.lifeStart) - t0) / timeUnit);
  const normalizedEnds = (fixture.rawTensors || []).map((tensor) => (Number(tensor.lifeEnd) - t0) / timeUnit);
  const minimumTime = Math.max(0, Math.min(...normalizedStarts));
  const maximumTensorTime = Math.max(...normalizedEnds);
  const maximumTime = maximumTensorTime + Math.max((maximumTensorTime - minimumTime) * 0.05, 0.5);
  const tensorPoint = (tensor: typeof firstTensor, timeRatio: number, addressRatio: number): CanvasCandidate => {
    const start = (Number(tensor.lifeStart) - t0) / timeUnit;
    const end = (Number(tensor.lifeEnd) - t0) / timeUnit;
    const time = start + (end - start) * timeRatio;
    const address = Number(tensor.base) + (Number(tensor.end) - Number(tensor.base)) * addressRatio;
    return {
      canvasIndex: 0,
      color: [0, 0, 0, 0],
      x: 180 + ((time - minimumTime) / (maximumTime - minimumTime)) * (chartBox.width - 200),
      y: 20 + ((address - Number(selectedRegion.addr0)) / Number(selectedRegion.span)) * (chartBox.height - 60),
    };
  };

  const first = tensorPoint(firstTensor, 0.25, 0.25);
  const second = tensorPoint(secondTensor, 0.75, 0.75);
  const canvas = overview.locator('canvas').first();
  await clickWithAlt(page, canvas, first);
  await clickWithAlt(page, canvas, second);
  await expect(page.locator('.memory-measurement-status')).toHaveText('Distance: 200');
  await capture(page, testInfo, evidence, 'before-zoom-measurement');

  await page.evaluate(() => {
    window.__canvasPathTrace = [];
  });
  const zoomPoint = { x: chartBox.x + chartBox.width - 280, y: chartBox.y + chartBox.height / 2 };
  await page.keyboard.down('Control');
  try {
    await page.mouse.move(zoomPoint.x, zoomPoint.y);
    for (let index = 0; index < 3; index++) {
      await page.mouse.wheel(0, -100);
    }
  } finally {
    await page.keyboard.up('Control');
  }
  await page.waitForTimeout(250);
  await capture(page, testInfo, evidence, 'after-zoom-measurement');

  const overflowEvidence = await page.evaluate(() => {
    const container = document.querySelector('.echarts-container');
    const width = container?.clientWidth || 0;
    const height = container?.clientHeight || 0;
    const plot = { left: 160, right: width - 20, top: 20, bottom: height - 40 };
    const paths = window.__canvasPathTrace.flatMap((entry) => entry.points);
    const outsidePlot = paths.filter((point) => point.x < plot.left || point.x > plot.right || point.y < plot.top || point.y > plot.bottom);
    const canvas = container?.querySelector('canvas') || null;
    const context = canvas?.getContext('2d') || null;
    const scaleX = canvas && canvas.width ? canvas.clientWidth / canvas.width : 1;
    const scaleY = canvas && canvas.height ? canvas.clientHeight / canvas.height : 1;
    const marginEndX = Math.max(0, Math.floor((plot.left - 4) / scaleX));
    let bluePixelsOutsidePlot = 0;
    if (canvas && context) {
      const pixels = context.getImageData(0, 0, marginEndX, canvas.height).data;
      for (let index = 0; index < pixels.length; index += 4) {
        const [red, green, blue, alpha] = [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]];
        if (alpha > 100 && blue > 150 && blue > red + 45 && blue > green + 25) {
          bluePixelsOutsidePlot++;
        }
      }
    }
    return { bluePixelsOutsidePlot, canvasScale: { x: scaleX, y: scaleY }, pathCount: window.__canvasPathTrace.length, plot, outsidePlot };
  });
  evidence.scenarios.leftMeasurementOverflow = {
    beforeScreenshot: 'before-zoom-measurement.png',
    afterScreenshot: 'after-zoom-measurement.png',
    ...overflowEvidence,
  };
  await attachEvidence(testInfo, evidence);
  expect(overflowEvidence.bluePixelsOutsidePlot).toBe(0);
});

type ZoomBurstMetrics = {
  dispatchMs: number;
  frameCount: number;
  longTaskCount: number;
  longTaskMaxMs: number;
  longTaskTotalMs: number;
  maxFrameGapMs: number;
  heapBytes: number | null;
};

async function measureZoomBurst(page: Page, deltaY: number, wheelCount = 8): Promise<ZoomBurstMetrics> {
  return page.evaluate(async ({ deltaY: requestedDeltaY, wheelCount: requestedWheelCount }) => {
    const chart = document.querySelector('.echarts-container');
    if (!chart) {
      throw new Error('GM memory chart is not visible for zoom measurement');
    }

    const rect = chart.getBoundingClientRect();
    const frameTimes: number[] = [];
    const longTasks: number[] = [];
    const observer = new PerformanceObserver((list) => {
      longTasks.push(...list.getEntries().map((entry) => entry.duration));
    });
    observer.observe({ entryTypes: ['longtask'] });

    let frameHandle = 0;
    const collectFrame = (timestamp: number) => {
      frameTimes.push(timestamp);
      frameHandle = requestAnimationFrame(collectFrame);
    };
    frameHandle = requestAnimationFrame(collectFrame);

    const dispatchStartedAt = performance.now();
    for (let index = 0; index < requestedWheelCount; index++) {
      chart.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width * 0.72,
        clientY: rect.top + rect.height * 0.5,
        ctrlKey: true,
        deltaY: requestedDeltaY,
      }));
    }
    const dispatchMs = performance.now() - dispatchStartedAt;

    await new Promise((resolve) => setTimeout(resolve, 750));
    cancelAnimationFrame(frameHandle);
    observer.disconnect();

    const frameGaps = frameTimes.slice(1).map((timestamp, index) => timestamp - frameTimes[index]);
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return {
      dispatchMs,
      frameCount: frameTimes.length,
      longTaskCount: longTasks.length,
      longTaskMaxMs: Math.max(0, ...longTasks),
      longTaskTotalMs: longTasks.reduce((total, duration) => total + duration, 0),
      maxFrameGapMs: Math.max(0, ...frameGaps),
      heapBytes: memory.memory?.usedJSHeapSize ?? null,
    };
  }, { deltaY, wheelCount });
}

async function prepareZoomPerformancePage(
  targetPage: Page,
  baseURL: string | undefined,
  fixtureText: string,
  tensorCount: number,
  testInfo: TestInfo,
  activateMeasurement: boolean,
): Promise<void> {
  const evidence = await loadGmMemoryFixture(targetPage, baseURL, 'dark', 'en-us', fixtureText);
  await assertInitialRender(targetPage, testInfo, evidence, tensorCount);
  await closeSidebar(targetPage);

  const regionPoint = await getRegionLabelPoint(targetPage, 0);
  const chart = targetPage.locator('.echarts-container');
  const chartBox = await chart.boundingBox();
  if (!chartBox) {
    throw new Error('GM memory chart is not visible for zoom performance measurement');
  }
  await targetPage.mouse.dblclick(chartBox.x + regionPoint.x, chartBox.y + regionPoint.y);
  await expect(targetPage.locator('.region-detail-name')).toHaveText('Region ID: 0');

  if (!activateMeasurement) {
    return;
  }

  const selection = await findSelection(targetPage, 'colored', 1);
  await closeSidebar(targetPage);
  const canvas = chart.locator('canvas').nth(selection.point.canvasIndex);
  await rightClickTensor(targetPage, canvas, selection.point);
  const menu = targetPage.locator('.tensor-context-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Show adjacent tensors' }).click();
  await expect(menu).toBeHidden();
  await expect(targetPage.locator('.memory-measurement-status')).toContainText('Addr:');
  await targetPage.waitForTimeout(250);
}

test('GM memory measurement mode zoom performance', async ({ page, baseURL }, testInfo) => {
  test.skip(!process.env.GM_MEMORY_ZOOM_PERF, 'Set GM_MEMORY_ZOOM_PERF=1 to run the opt-in zoom performance benchmark');
  test.setTimeout(300000);

  const sourceFixture = JSON.parse(await readFile(fixturePath, 'utf8')) as {
    meta?: Record<string, unknown>;
    rawTensors?: Array<Record<string, any>>;
  };
  const multiplier = 500;
  const rawTensors = Array.from({ length: multiplier }, (_, groupIndex) => {
    const timeOffset = groupIndex * 1000;
    return (sourceFixture.rawTensors || []).map((tensor, tensorIndex) => ({
      ...tensor,
      instanceId: `${tensor.instanceId || tensorIndex}-zoom-${groupIndex}`,
      lifeEnd: Number(tensor.lifeEnd) + timeOffset,
      lifeStart: Number(tensor.lifeStart) + timeOffset,
      rawId: `${tensor.rawId || tensorIndex}-zoom-${groupIndex}`,
    }));
  }).flat();
  const fixtureText = JSON.stringify({ ...sourceFixture, rawTensors });

  const normalPage = await page.context().newPage();
  const measurementPage = await page.context().newPage();
  try {
    await prepareZoomPerformancePage(normalPage, baseURL, fixtureText, rawTensors.length, testInfo, false);
    await prepareZoomPerformancePage(measurementPage, baseURL, fixtureText, rawTensors.length, testInfo, true);

    const normalCdp = await normalPage.context().newCDPSession(normalPage);
    const measurementCdp = await measurementPage.context().newCDPSession(measurementPage);
    await normalCdp.send('Performance.enable');
    await measurementCdp.send('Performance.enable');
    const normalBefore = await normalCdp.send('Performance.getMetrics');
    const measurementBefore = await measurementCdp.send('Performance.getMetrics');

    const normalZoomIn = await measureZoomBurst(normalPage, -100);
    const normalZoomOut = await measureZoomBurst(normalPage, 100);
    const measurementZoomIn = await measureZoomBurst(measurementPage, -100);
    const measurementZoomOut = await measureZoomBurst(measurementPage, 100);

    const normalAfter = await normalCdp.send('Performance.getMetrics');
    const measurementAfter = await measurementCdp.send('Performance.getMetrics');
    const metricDelta = (before: any, after: any, name: string): number => {
      const beforeValue = Number(before.metrics.find((entry: any) => entry.name === name)?.value || 0);
      const afterValue = Number(after.metrics.find((entry: any) => entry.name === name)?.value || 0);
      return (afterValue - beforeValue) * (name === 'TaskDuration' || name === 'ScriptDuration' ? 1000 : 1);
    };
    const report = {
      fixtureTensorCount: rawTensors.length,
      normal: {
        zoomIn: normalZoomIn,
        zoomOut: normalZoomOut,
        taskMs: metricDelta(normalBefore, normalAfter, 'TaskDuration'),
        scriptMs: metricDelta(normalBefore, normalAfter, 'ScriptDuration'),
        layoutCount: metricDelta(normalBefore, normalAfter, 'LayoutCount'),
        recalcStyleCount: metricDelta(normalBefore, normalAfter, 'RecalcStyleCount'),
      },
      measurementMode: {
        zoomIn: measurementZoomIn,
        zoomOut: measurementZoomOut,
        taskMs: metricDelta(measurementBefore, measurementAfter, 'TaskDuration'),
        scriptMs: metricDelta(measurementBefore, measurementAfter, 'ScriptDuration'),
        layoutCount: metricDelta(measurementBefore, measurementAfter, 'LayoutCount'),
        recalcStyleCount: metricDelta(measurementBefore, measurementAfter, 'RecalcStyleCount'),
      },
    };
    const reportPath = testInfo.outputPath('gm-memory-zoom-performance.json');
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await testInfo.attach('GM memory zoom performance', { contentType: 'application/json', path: reportPath });
    console.log(JSON.stringify(report));
  } finally {
    await normalPage.close();
    await measurementPage.close();
  }
});

test('GM memory light theme context menu remains readable', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL, 'light', 'zh');
  await assertInitialRender(page, testInfo, evidence);
  await closeSidebar(page);

  const regionPoint = await getRegionLabelPoint(page, 0);
  const chart = page.locator('.echarts-container');
  const chartBox = await chart.boundingBox();
  if (!chartBox) {
    throw new Error('GM memory chart is not visible');
  }
  await page.mouse.dblclick(chartBox.x + regionPoint.x, chartBox.y + regionPoint.y);
  await expect(page.locator('.region-detail-name')).toHaveText('Region ID: 0');

  const selection = await findSelection(page, 'colored', 1);
  await closeSidebar(page);
  const canvas = chart.locator('canvas').nth(selection.point.canvasIndex);
  await rightClickTensor(page, canvas, selection.point);
  const menu = page.locator('.tensor-context-menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveClass(/theme-light/);
  await expect(menu.getByRole('menuitem')).toHaveText('显示相邻tensor');
  const colors = await menu.evaluate((element) => {
    const item = element.querySelector('.tensor-context-menu-item');
    if (!item) {
      throw new Error('Context menu item is missing');
    }
    const menuStyle = getComputedStyle(element);
    const itemStyle = getComputedStyle(item);
    return { background: menuStyle.backgroundColor, color: itemStyle.color, itemBackground: itemStyle.backgroundColor };
  });
  expect(colors).toEqual({ background: 'rgb(255, 255, 255)', color: 'rgb(25, 25, 25)', itemBackground: 'rgba(0, 0, 0, 0)' });

  evidence.scenarios.lightContextMenu = { colors, point: selection.point };
  await capture(page, testInfo, evidence, '02-light-context-menu');
  await attachEvidence(testInfo, evidence);
});

test('GM memory context menu highlights adjacent tensors', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);
  await closeSidebar(page);

  const regionPoint = await getRegionLabelPoint(page, 0);
  const chartBox = await page.locator('.echarts-container').boundingBox();
  if (!chartBox) {
    throw new Error('GM memory chart is not visible');
  }
  await page.mouse.dblclick(chartBox.x + regionPoint.x, chartBox.y + regionPoint.y);
  await expect(page.locator('.region-detail-name')).toHaveText('Region ID: 0');

  const container = page.locator('.echarts-container');
  const selection = await findSelection(page, 'colored', 1);
  await closeSidebar(page);
  const canvas = container.locator('canvas').nth(selection.point.canvasIndex);
  const beforeMeasurement = await canvasStats(container);

  await rightClickTensor(page, canvas, selection.point);
  const menu = page.locator('.tensor-context-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Show adjacent tensors' }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('.memory-measurement-status')).toContainText('Addr:');
  const afterMeasurement = await waitForCanvasHashChange(container, beforeMeasurement.hash);

  evidence.scenarios.adjacentMeasurement = {
    label: await page.locator('.memory-measurement-status').innerText(),
    point: selection.point,
    visualChanged: afterMeasurement.hash !== beforeMeasurement.hash,
  };
  await capture(page, testInfo, evidence, '02-adjacent-measurement');
  await attachEvidence(testInfo, evidence);
});

test('GM memory context menu highlights every equal-distance tensor on the same level', async ({ page, baseURL }, testInfo) => {
  const sourceFixture = JSON.parse(await readFile(fixturePath, 'utf8')) as {
    meta?: { regions?: Array<{ addr0?: number; regionId?: number; span?: number }>; t0?: number; timeUnit?: number };
    rawTensors?: Array<Record<string, any>>;
  };
  const anchor = sourceFixture.rawTensors?.find((tensor) => tensor.rawId === 'tensor-b');
  const selectedRegion = sourceFixture.meta?.regions?.find((region) => Number(region.regionId) === 0);
  const timeUnit = Number(sourceFixture.meta?.timeUnit);
  const t0 = Number(sourceFixture.meta?.t0);
  if (!anchor || !selectedRegion || !Number.isFinite(timeUnit) || !Number.isFinite(t0)) {
    throw new Error('Expected tensor-b and Region 0 in the representative fixture');
  }

  const tiedTensors = [
    { ...anchor, rawId: 'tensor-tie-a', instanceId: 'instance-tie-a', base: 1700, end: 1800, size: 100, rawmagic: 'magic-tie-a', isWorkspace: false, hasOverlap: false, lifeStart: 160, lifeEnd: 190 },
    { ...anchor, rawId: 'tensor-tie-b', instanceId: 'instance-tie-b', base: 1700, end: 1800, size: 100, rawShape: [512, 512], logicalShape: [512, 512], rawmagic: 'magic-tie-b', isWorkspace: false, hasOverlap: false, lifeStart: 270, lifeEnd: 300 },
  ];
  const existingNearestTensor = sourceFixture.rawTensors?.find((tensor) => tensor.rawId === 'tensor-c');
  if (!existingNearestTensor) {
    throw new Error('Expected tensor-c in Region 0');
  }
  const rawTensors = [
    ...(sourceFixture.rawTensors || []).filter((tensor) => tensor.rawId !== existingNearestTensor.rawId),
    ...tiedTensors,
    existingNearestTensor,
  ];
  const fixtureText = JSON.stringify({ ...sourceFixture, rawTensors });
  const evidence = await loadGmMemoryFixture(page, baseURL, 'light', 'en-us', fixtureText);
  await assertInitialRender(page, testInfo, evidence, rawTensors.length);
  await closeSidebar(page);

  const regionPoint = await getRegionLabelPoint(page, 0);
  const container = page.locator('.echarts-container');
  const overviewBox = await container.boundingBox();
  if (!overviewBox) {
    throw new Error('Memory chart is not visible');
  }
  await page.mouse.dblclick(overviewBox.x + regionPoint.x, overviewBox.y + regionPoint.y);
  await expect(page.locator('.region-detail-name')).toHaveText('Region ID: 0');

  const normalizedStarts = rawTensors.map((tensor) => (Number(tensor.lifeStart) - t0) / timeUnit);
  const normalizedEnds = rawTensors.map((tensor) => (Number(tensor.lifeEnd) - t0) / timeUnit);
  const minimumTime = Math.max(0, Math.min(...normalizedStarts));
  const maximumTensorTime = Math.max(...normalizedEnds);
  const maximumTime = maximumTensorTime + Math.max((maximumTensorTime - minimumTime) * 0.05, 0.5);
  const tensorPoint = (tensor: Record<string, any>, timeRatio: number, addressRatio: number): CanvasCandidate => {
    const start = (Number(tensor.lifeStart) - t0) / timeUnit;
    const end = (Number(tensor.lifeEnd) - t0) / timeUnit;
    const time = start + (end - start) * timeRatio;
    const address = Number(tensor.base) + (Number(tensor.end) - Number(tensor.base)) * addressRatio;
    return {
      canvasIndex: 0,
      color: [0, 0, 0, 0],
      x: 180 + ((time - minimumTime) / (maximumTime - minimumTime)) * (overviewBox.width - 200),
      y: 20 + ((address - Number(selectedRegion.addr0)) / Number(selectedRegion.span)) * (overviewBox.height - 60),
    };
  };

  const canvas = container.locator('canvas').first();
  const beforeMeasurement = await canvasStats(container);
  await rightClickTensor(page, canvas, tensorPoint(anchor, 0.25, 0.85));
  const menu = page.locator('.tensor-context-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Show adjacent tensors' }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('.memory-measurement-status')).toHaveText('Addr: 100');
  await waitForCanvasHashChange(container, beforeMeasurement.hash);

  const tiePoints = tiedTensors.map((tensor) => tensorPoint(tensor, 0.2, 0.2));
  const differentLevelPoint = tensorPoint(existingNearestTensor, 0.2, 0.2);
  const samplePixel = (point: CanvasCandidate) => page.evaluate((requestedPoint) => {
    const canvasElement = document.querySelectorAll('.echarts-container canvas')[requestedPoint.canvasIndex] as HTMLCanvasElement | undefined;
    const context = canvasElement?.getContext('2d');
    if (!canvasElement || !context || !canvasElement.clientWidth || !canvasElement.clientHeight) {
      throw new Error('Memory chart canvas is not available for color sampling');
    }
    const x = Math.max(0, Math.min(canvasElement.width - 1, Math.floor(requestedPoint.x * canvasElement.width / canvasElement.clientWidth)));
    const y = Math.max(0, Math.min(canvasElement.height - 1, Math.floor(requestedPoint.y * canvasElement.height / canvasElement.clientHeight)));
    return Array.from(context.getImageData(x, y, 1, 1).data);
  }, point);
  const tieColors = await Promise.all(tiePoints.map(samplePixel));
  const differentLevelColor = await samplePixel(differentLevelPoint);
  const sameColor = tieColors.every((color) => color.every((value, index) => Math.abs(value - tieColors[0][index]) <= 4));
  const differentFromUnhighlighted = tieColors.every((color) => color.some((value, index) => Math.abs(value - differentLevelColor[index]) > 4));
  expect(sameColor).toBe(true);
  expect(differentFromUnhighlighted).toBe(true);

  evidence.scenarios.equalDistanceMeasurement = {
    highlightedTensorCount: tiedTensors.length + 1,
    differentLevelColor,
    label: await page.locator('.memory-measurement-status').innerText(),
    tieColors,
  };
  await capture(page, testInfo, evidence, '02-equal-distance-measurement');
  await attachEvidence(testInfo, evidence);
});

test('GM memory representative fixture interactions', async ({ page, baseURL }, testInfo) => {
  const evidence = await loadGmMemoryFixture(page, baseURL);
  await assertInitialRender(page, testInfo, evidence);

  await test.step('single tensor selection', async () => {
    const selection = await findSelection(page, 'colored', 1);
    await expect(page.locator('.tensor-tab[aria-selected="true"]')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.access-table')).toBeVisible();
    await expect(page.locator('.memory-lane-chart canvas')).toHaveCount(0);
    await expect(page.getByLabel('Show writes only')).toHaveCount(1);
    evidence.scenarios.singleSelection = selection;
    await capture(page, testInfo, evidence, '02-sidebar');
  });

  await test.step('access table view', async () => {
    const tableViewButton = page.getByRole('button', { name: 'Table view' });
    await tableViewButton.hover();
    const tooltip = page.getByText('List view', { exact: true }).last();
    await expect(tooltip).toBeVisible();
    await tableViewButton.click();
    const table = page.locator('.access-table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead th')).toHaveText([
      'R/W', 'FUNC', 'OP', 'OFFSET', 'SHAPE', 'RAWSHAPE', 'HASOVERLAP', 'EXECSTART', 'EXECEND',
    ]);
    const rows = table.locator('tbody tr:not(.empty-row)');
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    const initialRowCount = await rows.count();
    const firstRow = await rows.first().locator('td').allTextContents();
    expect(firstRow).toHaveLength(9);
    expect(['W', 'R']).toContain(firstRow[0]);
    expect(['true', 'false']).toContain(firstRow[6]);
    const searchBox = await page.locator('.access-search').boundingBox();
    expect(searchBox?.width || 0).toBeLessThanOrEqual(280);
    expect(searchBox?.height || 0).toBeLessThanOrEqual(32);
    await page.locator('.access-table-scroll').evaluate((element) => {
      const body = element.querySelector('tbody');
      if (!body) return;
      for (let index = 0; index < 40; index++) {
        const clone = body.children[index % body.children.length].cloneNode(true) as HTMLElement;
        clone.dataset.scrollTestRow = 'true';
        body.append(clone);
      }
      element.scrollTop = element.scrollHeight;
    });
    await expect.poll(() => page.locator('.access-table-scroll').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const stickyHeader = await table.locator('thead th').first().evaluate((element) => {
      const style = getComputedStyle(element);
      return { backgroundColor: style.backgroundColor, position: style.position, zIndex: style.zIndex };
    });
    expect(stickyHeader).toMatchObject({ backgroundColor: 'rgb(41, 41, 41)', position: 'sticky', zIndex: '2' });
    await page.locator('[data-scroll-test-row="true"]').evaluateAll((elements) => elements.forEach((element) => element.remove()));

    const search = page.getByRole('searchbox', { name: 'Search accesses' });
    await search.fill(firstRow[1]);
    await expect.poll(() => rows.count()).toBeGreaterThan(0);
    const filteredRowCount = await rows.count();
    expect(filteredRowCount).toBeLessThanOrEqual(initialRowCount);
    await rows.first().click();
    await expect(rows.first()).toHaveClass(/selected/);
    const paginationBackground = await page.locator('.access-pagination').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(paginationBackground).toBe('rgb(26, 26, 26)');
    evidence.scenarios.accessTable = {
      filteredRowCount, firstRow, initialRowCount, paginationBackground, searchBox, stickyHeader, tooltip: await tooltip.innerText(),
    };
    await capture(page, testInfo, evidence, '03-access-table');

    await page.getByRole('button', { name: 'Chart view' }).click();
    await expect(page.locator('.memory-lane-chart')).toBeVisible();
  });

  await test.step('conflict tabs and navigation', async () => {
    const selection = await findSelection(page, 'red', 2);
    await page.getByRole('button', { name: 'Chart view' }).click();
    await expect(page.locator('.memory-lane-chart')).toBeVisible();
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
  await test.step('independent dimension slider, filtering, resizing, and reset', async () => {
    const filterEvidence = await selectFilterableTensor(page, writeSwitch);
    const fullLabels = await rulerLabels(page);
    fullRange = requireRulerRange(rulerRange(fullLabels));
    const secondDimensionRange = rulerRange(await rulerLabels(page, 1));
    const lane = page.locator('.memory-lane-chart');
    const laneBox = await lane.boundingBox();
    if (!laneBox) {
      throw new Error('Memory lane chart is not visible');
    }
    const plotLeft = laneBox.x + 110;
    const plotWidth = laneBox.width - 140;
    const sliderY = laneBox.y + 20;
    await clearRulerTrace(page);
    await page.mouse.move(plotLeft, sliderY);
    await page.mouse.down();
    await page.mouse.move(plotLeft + plotWidth * 0.2, sliderY, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => rulerRange(await rulerLabels(page))?.span || 0).toBeLessThan(fullRange.span);
    const zoomLabels = await rulerLabels(page);
    zoomRange = requireRulerRange(rulerRange(zoomLabels));
    expect(zoomRange.min).toBeGreaterThan(fullRange.min);
    expect(zoomLabels.every((label) => !label.includes(','))).toBe(true);
    if (secondDimensionRange) {
      const currentSecondDimensionRange = requireRulerRange(rulerRange(await rulerLabels(page, 1)));
      expect(currentSecondDimensionRange).toEqual(secondDimensionRange);
    }

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
    const beforeResize = await lane.boundingBox();
    const beforeResizeLabels = await rulerLabels(page);
    await clearRulerTrace(page);
    await page.mouse.move(box.x + box.width / 2, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x - 100, box.y + 100, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => {
      const currentBox = await lane.boundingBox();
      return currentBox ? currentBox.width : 0;
    }).not.toBe(beforeResize?.width || 0);
    const resizedRange = requireRulerRange(rulerRange(await rulerLabels(page)));
    expect(Math.abs(resizedRange.span - zoomRange.span)).toBeLessThan(Math.max(0.01, zoomRange.span * 0.08));
    expect(await rulerLabels(page)).toEqual(beforeResizeLabels);

    await clearRulerTrace(page);
    const tabs = page.locator('.tensor-tab');
    const originalTabTitle = await page.locator('.tensor-tab[aria-selected="true"]').getAttribute('title');
    const firstTabIsActive = (await tabs.first().getAttribute('aria-selected')) === 'true';
    const beforeSwitch = await canvasStats(lane);
    await tabs.nth(firstTabIsActive ? 1 : 0).click();
    await waitForCanvasHashChange(lane, beforeSwitch.hash);
    const switchedTensorRange = requireRulerRange(rulerRange(await rulerLabels(page)));
    const originalTabIndex = await tabs.evaluateAll(
      (elements, title) => elements.findIndex((element) => element.getAttribute('title') === title),
      originalTabTitle,
    );
    expect(originalTabIndex).toBeGreaterThanOrEqual(0);
    await clearRulerTrace(page);
    const beforeRestore = await canvasStats(lane);
    await tabs.nth(originalTabIndex).click();
    await waitForCanvasHashChange(lane, beforeRestore.hash);
    const restoredTensorRange = requireRulerRange(rulerRange(await rulerLabels(page)));
    expect(Math.abs(restoredTensorRange.span - fullRange.span)).toBeLessThan(Math.max(0.01, fullRange.span * 0.05));
    expect(restoredTensorRange.span).toBeGreaterThan(zoomRange.span);
    evidence.scenarios.dimensionSlider = {
      ...filterEvidence,
      filteredRange,
      fullLabels,
      fullRange,
      resizedRange,
      restoredTensorRange,
      secondDimensionRange,
      switchedTensorRange,
      zoomLabels,
      zoomRange,
    };
    await capture(page, testInfo, evidence, '03-dimension-slider');
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
