/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';

import { expect, test, type Page, type TestInfo } from '@playwright/test';

interface RunResult {
  browser: {
    fingerprint: Record<string, unknown>;
    heapBytes: number | null;
    longTasks: Array<{ duration: number; startTime: number }>;
    marks: Record<string, number>;
    paintedCanvas: { canvasCount: number; hash: number; painted: number };
    stages: Record<string, number>;
  };
  node: { decode: number; jsonParse: number; read: number };
  total: number;
}

const KNOWN_DATASET_SHA256 = 'cdea50e8193d37934c54458e2640c46004f8ce00ec35ba92bd76cd50b3ebf20c';

function percentile(values: number[], quantile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

function summarize(values: number[]) {
  const median = percentile(values, 0.5);
  const deviations = values.map((value) => Math.abs(value - median));
  return {
    mad: percentile(deviations, 0.5),
    max: Math.max(...values),
    median,
    min: Math.min(...values),
    p90: percentile(values, 0.9),
  };
}

function assertFingerprint(fingerprint: Record<string, unknown>): void {
  const acceptedTensorCount = Number(fingerprint.acceptedTensorCount);
  const conflictCount = Number(fingerprint.conflictCount);
  const rawTensorCount = Number(fingerprint.rawTensorCount);
  const regionCount = Number(fingerprint.regionCount);
  const sourceRegionCount = Number(fingerprint.sourceRegionCount);
  const seriesRows = fingerprint.seriesRows as Array<{ id: string; rows: number }>;
  expect(acceptedTensorCount).toBeGreaterThan(0);
  expect(acceptedTensorCount).toBeLessThanOrEqual(rawTensorCount);
  expect(regionCount).toBe(sourceRegionCount);
  expect(seriesRows.find((series) => series.id === 'tensors')?.rows).toBe(acceptedTensorCount);
  expect(seriesRows.find((series) => series.id === 'overlaps')?.rows).toBe(conflictCount);
  if (fingerprint.sha256 === KNOWN_DATASET_SHA256) {
    expect(fingerprint).toMatchObject({
      acceptedTensorCount: 6352,
      accessCount: 17864,
      conflictCount: 10,
      inputBytes: 14656065,
      rawTensorCount: 7807,
      regionCount: 13,
      sourceRegionCount: 13,
      timelineBounds: { max: 94848019390333.34, min: 94848019364118 },
    });
    expect(seriesRows).toEqual([
      { id: 'tensors', rows: 6352 },
      { id: 'overlaps', rows: 10 },
      { id: 'regions', rows: 1 },
      { id: 'region-axis-labels', rows: 1 },
    ]);
  }
}

async function installHarness(page: Page, baseURL: string): Promise<void> {
  await page.addInitScript(() => {
    window.__vscodeMessages = [];
    window.acquireVsCodeApi = () => ({
      postMessage: (message) => window.__vscodeMessages.push(message),
      getState: () => null,
      setState: () => {},
    });
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
}

async function canvasStats(page: Page) {
  return page.locator('.echarts-container').evaluate((element) => {
    const canvases = Array.from(element.querySelectorAll('canvas'));
    let hash = 2166136261;
    let painted = 0;
    for (const canvas of canvases) {
      const context = canvas.getContext('2d', { willReadFrequently: true });
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

async function runOnce(page: Page, fixturePath: string): Promise<RunResult> {
  const readStartedAt = performance.now();
  const bytes = await readFile(fixturePath);
  const readFinishedAt = performance.now();
  const content = bytes.toString('utf8');
  const decodeFinishedAt = performance.now();
  const fixture = JSON.parse(content) as { meta?: { regions?: unknown[] }; rawTensors?: Array<{ accesses?: unknown[] }> };
  const parseFinishedAt = performance.now();

  await page.goto('/');
  await expect(page.locator('#boot-middleLayer')).toBeAttached();
  const totalStartedAt = performance.now();
  await page.evaluate((value) => {
    window.__gmMemoryPerformance = { fingerprint: {}, longTasks: [], marks: { transferStart: performance.now() }, stages: {} };
    const observer = new PerformanceObserver((list) => {
      const run = window.__gmMemoryPerformance;
      if (run) {
        run.longTasks.push(...list.getEntries().map((entry) => ({ duration: entry.duration, startTime: entry.startTime })));
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
    window.postMessage({ channel: 'viewServerRef', data: { key: 'GmMemoryVisualData', value }}, '*');
  }, content);
  await expect.poll(async () => page.evaluate(() => window.__gmMemoryPerformance?.marks.paintedReady || 0), { timeout: 180000 }).toBeGreaterThan(0);
  const total = performance.now() - totalStartedAt;
  const paintedCanvas = await canvasStats(page);
  const browser = await page.evaluate(() => {
    const run = window.__gmMemoryPerformance;
    if (!run) throw new Error('GM memory performance collector was not initialized');
    const memory = performance as Performance & { memory?: { usedJSHeapSize: number } };
    return { ...run, heapBytes: memory.memory?.usedJSHeapSize ?? null };
  });
  const accessCount = fixture.rawTensors?.reduce((total, tensor) => total + (tensor.accesses?.length || 0), 0) || 0;
  Object.assign(browser.fingerprint, {
    accessCount,
    inputBytes: bytes.byteLength,
    inputFile: basename(fixturePath),
    rawTensorCount: fixture.rawTensors?.length || 0,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sourceRegionCount: fixture.meta?.regions?.length || 0,
  });
  return {
    browser: { ...browser, paintedCanvas },
    node: {
      decode: decodeFinishedAt - readFinishedAt,
      jsonParse: parseFinishedAt - decodeFinishedAt,
      read: readFinishedAt - readStartedAt,
    },
    total,
  };
}

test('benchmarks a production-sized GM memory file', async ({ context, page, baseURL }, testInfo: TestInfo) => {
  const requestedPath = process.env.GM_MEMORY_BENCHMARK_PATH;
  if (!requestedPath || !baseURL) throw new Error('GM_MEMORY_BENCHMARK_PATH and Playwright baseURL are required');
  const fixturePath = resolve(requestedPath);
  await stat(fixturePath);
  await installHarness(page, baseURL);

  const measuredRuns = Math.max(1, Number(process.env.GM_MEMORY_BENCHMARK_RUNS) || 7);
  test.setTimeout((measuredRuns + 2) * 180000 + 60000);
  await runOnce(page, fixturePath);
  const runs: RunResult[] = [];
  for (let index = 0; index < measuredRuns; index++) {
    runs.push(await runOnce(page, fixturePath));
  }

  const stageNames = new Set(runs.flatMap((run) => Object.keys(run.browser.stages)));
  const report = {
    environment: {
      browser: await page.evaluate(() => navigator.userAgent),
      node: process.version,
      platform: process.platform,
      viewport: page.viewportSize(),
    },
    fingerprint: runs[0].browser.fingerprint,
    runs,
    summary: {
      browserStages: Object.fromEntries([...stageNames].map((name) => [name, summarize(runs.map((run) => run.browser.stages[name] || 0))])),
      node: {
        decode: summarize(runs.map((run) => run.node.decode)),
        jsonParse: summarize(runs.map((run) => run.node.jsonParse)),
        read: summarize(runs.map((run) => run.node.read)),
      },
      total: summarize(runs.map((run) => run.total)),
    },
  };
  const reportPath = testInfo.outputPath('gm-memory-performance.json');
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await testInfo.attach('GM memory performance', { contentType: 'application/json', path: reportPath });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await runOnce(page, fixturePath);
  const { profile } = await cdp.send('Profiler.stop');
  const profilePath = testInfo.outputPath('gm-memory-performance.cpuprofile');
  await writeFile(profilePath, JSON.stringify(profile));
  await testInfo.attach('GM memory CPU profile', { contentType: 'application/json', path: profilePath });

  expect(runs.every((run) => run.browser.paintedCanvas.painted > 100)).toBe(true);
  assertFingerprint(runs[0].browser.fingerprint);
  expect(runs.map((run) => run.browser.fingerprint)).toEqual(runs.map(() => runs[0].browser.fingerprint));
});
