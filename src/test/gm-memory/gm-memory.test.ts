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
import * as assert from 'node:assert';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';

import * as vscode from 'vscode';

import { GmMemoryVisualReadyEvent, onDidGmMemoryVisualReady } from '../../view/servers/gm-memory-visual-server';

const COMMAND = 'PyPTO.Open.OpenGmMemoryVisualization';
const VIEW_TYPE = 'PyPTO.open.editorView';
const KNOWN_DATASET_SHA256 = 'cdea50e8193d37934c54458e2640c46004f8ce00ec35ba92bd76cd50b3ebf20c';

function getTabs(): readonly vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap((group) => group.tabs);
}

function isGmMemoryTab(tab: vscode.Tab, label: string): boolean {
  return tab.label === label && tab.input instanceof vscode.TabInputWebview && tab.input.viewType.includes(VIEW_TYPE);
}

async function waitForTab(label: string, timeoutMs = 5000): Promise<vscode.Tab | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tab = getTabs().find((item) => isGmMemoryTab(item, label));
    if (tab) {
      return tab;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return undefined;
}

async function waitForTabToClose(tab: vscode.Tab, timeoutMs = 5000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!getTabs().includes(tab)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

function waitForReady(expectedPath: string, timeoutMs = 10000): Promise<GmMemoryVisualReadyEvent> {
  const normalizedExpectedPath = path.resolve(expectedPath).toLowerCase();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.dispose();
      reject(new Error('GM memory webview did not report readiness'));
    }, timeoutMs);
    const subscription = onDidGmMemoryVisualReady((event) => {
      if (path.resolve(event.fsPath).toLowerCase() !== normalizedExpectedPath) {
        return;
      }
      clearTimeout(timeout);
      subscription.dispose();
      resolve(event);
    });
  });
}

suite('GM memory webview', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('PyPTO.Open.CloseAllToolPages');
  });

  test('opens the visualization webview for a valid memory file', async function () {
    if (process.env.GM_MEMORY_BENCHMARK_PATH) {
      this.timeout(30 * 60 * 1000);
    }
    const extension = vscode.extensions.getExtension('CANN-PUB.pypto-toolkit');
    assert.ok(extension, 'PyPTO Toolkit extension is available in the Extension Host');
    await extension.activate();

    const benchmarkPath = process.env.GM_MEMORY_BENCHMARK_PATH;
    const fixturePath = benchmarkPath ? path.resolve(benchmarkPath) : path.join(extension.extensionPath, 'test', 'fixtures', 'memory_usage_visualization.json');
    assert.strictEqual(path.basename(fixturePath), 'memory_usage_visualization.json', 'the GM memory command requires this benchmark filename');
    const benchmarkSha256 = benchmarkPath ? createHash('sha256').update(await readFile(fixturePath)).digest('hex') : undefined;

    assert.ok((await vscode.commands.getCommands(true)).includes(COMMAND), 'the GM memory command is registered');

    const measuredRuns = benchmarkPath ? Math.max(1, Number(process.env.GM_MEMORY_BENCHMARK_RUNS) || 7) : 1;
    const runCount = measuredRuns + (benchmarkPath ? 1 : 0);
    const results: Array<{ commandToTab: number; commandToReady: number; event: GmMemoryVisualReadyEvent }> = [];
    for (let index = 0; index < runCount; index++) {
      const before = new Set(getTabs());
      const ready = waitForReady(fixturePath, benchmarkPath ? 180000 : 10000);
      const startedAt = performance.now();
      const commandPromise = vscode.commands.executeCommand(COMMAND, vscode.Uri.file(fixturePath));

      const tab = await waitForTab('memory_usage_visualization', benchmarkPath ? 180000 : 5000);
      const commandToTab = performance.now() - startedAt;
      assert.ok(tab, 'the GM memory command opens a webview tab');
      assert.ok(!before.has(tab), 'the command creates a new tab');
      assert.ok(tab.input instanceof vscode.TabInputWebview, 'the opened tab is a webview');
      assert.ok(tab.input.viewType.includes(VIEW_TYPE), `unexpected webview type: ${tab.input.viewType}`);
      await commandPromise;
      if (benchmarkPath) {
        assert.ok(commandToTab < 1000, `the GM memory tab appeared too slowly: ${commandToTab.toFixed(1)} ms`);
      }

      const readyEvent = await ready;
      if (!benchmarkPath || index > 0) {
        results.push({ commandToTab, commandToReady: performance.now() - startedAt, event: readyEvent });
      }
      assert.strictEqual(path.resolve(readyEvent.fsPath).toLowerCase(), path.resolve(fixturePath).toLowerCase());
      if (!benchmarkPath) {
        assert.deepStrictEqual(
          { tensorCount: readyEvent.tensorCount, regionCount: readyEvent.regionCount, hasChart: readyEvent.hasChart },
          { tensorCount: 12, regionCount: 3, hasChart: true },
        );
      } else {
        assert.ok(readyEvent.tensorCount > 0, 'the benchmark must produce accepted tensors');
        assert.ok(readyEvent.regionCount > 0, 'the benchmark must produce regions');
        assert.strictEqual(readyEvent.webviewPerformance?.fingerprint.acceptedTensorCount, readyEvent.tensorCount);
        assert.strictEqual(readyEvent.webviewPerformance?.fingerprint.regionCount, readyEvent.regionCount);
        if (benchmarkSha256 === KNOWN_DATASET_SHA256) {
          assert.deepStrictEqual(
            { tensorCount: readyEvent.tensorCount, regionCount: readyEvent.regionCount, conflictCount: readyEvent.webviewPerformance?.fingerprint.conflictCount },
            { tensorCount: 6352, regionCount: 13, conflictCount: 10 },
          );
        }
      }
      assert.ok(getTabs().includes(tab), 'the GM memory tab remains open after the chart reports readiness');

      await vscode.commands.executeCommand(COMMAND, vscode.Uri.file(fixturePath));
      assert.strictEqual(
        getTabs().filter((item) => isGmMemoryTab(item, 'memory_usage_visualization')).length,
        1,
        'reopening the same GM memory file reveals the existing tab',
      );

      await vscode.commands.executeCommand('PyPTO.Open.CloseAllToolPages');
      assert.ok(await waitForTabToClose(tab), 'the close-all command closes the GM memory webview tab');
    }

    if (benchmarkPath) {
      const outputDirectory = path.join(tmpdir(), 'opencode', `gm-extension-performance-${process.env.GM_MEMORY_BENCHMARK_LABEL || 'run'}`);
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(path.join(outputDirectory, 'gm-memory-extension-performance.json'), `${JSON.stringify({ fixturePath, results }, null, 2)}\n`);
    }
  });
});
