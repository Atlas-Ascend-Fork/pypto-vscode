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
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { defineConfig } from '@playwright/test';

const port = 41731;
const testDirectory = __dirname;
const webviewDirectory = resolve(__dirname, '../../media/vue-project');
const benchmarkLabel = process.env.GM_MEMORY_BENCHMARK_LABEL ? `-${process.env.GM_MEMORY_BENCHMARK_LABEL}` : '';
const isPerformanceRun = !!process.env.GM_MEMORY_BENCHMARK_PATH || process.env.npm_lifecycle_event === 'test:gm-perf';

export default defineConfig({
  testDir: testDirectory,
  testMatch: isPerformanceRun ? 'gm-memory-performance.spec.ts' : 'gm-memory.spec.ts',
  timeout: 180000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  outputDir: join(tmpdir(), 'opencode', `gm-e2e-results${benchmarkLabel}`),
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
    trace: 'retain-on-failure',
    viewport: { width: 1900, height: 950 },
  },
  webServer: {
    command: `npm run dev -- --mode test --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: webviewDirectory,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    stderr: 'ignore',
    stdout: 'ignore',
    timeout: 60000,
  },
});
