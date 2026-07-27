/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
