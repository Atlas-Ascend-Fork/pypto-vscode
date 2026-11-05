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
import * as fs from 'node:fs';
import { mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

import * as vscode from 'vscode';

import {
  getSemanticFromCache,
  readAndBuildSemanticObj,
  saveSemanticToCache,
} from '../../services/three-column-semantic';

const EXTENSION_ID = 'CANN-PUB.pypto-toolkit';
const SUM_LSTM_GRAPH = path.join('dev', '4_col', 'data', 'sum_lstm', 'program.json');
const EXPECTED_LINES = [140, 157, 164, 172, 176, 186, 194];
const EXPECTED_LABELS: Record<number, string> = {
  140: 'Input_Fusion',
  157: 'Gate_Sigmoid',
  164: 'rms_norm_pure',
  172: 'gelu_activation_core',
  176: 'Cell_Update',
  186: 'Post_Cell_Process',
  194: 'gelu_activation_core 2',
};

suite('three-column semantic cache（语义高亮映射：构建 + 缓存命中/mtime 失效）', () => {
  test('readAndBuildSemanticObj 单遍构建正确（sum_lstm 7 个声明行）', async function () {
    this.timeout(60000);
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, '扩展在 Extension Host 中可用');
    await extension.activate();

    const graphPath = path.join(extension.extensionPath, SUM_LSTM_GRAPH);
    assert.ok(fs.existsSync(graphPath), `测试数据不存在: ${graphPath}`);
    const semanticObj = await readAndBuildSemanticObj(graphPath, extension.extensionPath);

    const files = Object.keys(semanticObj);
    assert.strictEqual(files.length, 1, '应只涉及 1 个 py 文件');
    assert.ok(files[0].endsWith('sum_lstm.py'), `py 文件键应为 sum_lstm.py: ${files[0]}`);

    const lines = semanticObj[files[0]];
    assert.deepStrictEqual(
      Object.keys(lines).map(Number).sort((a, b) => a - b),
      EXPECTED_LINES,
      '应锚在 7 个标签声明行上',
    );
    for (const [line, label] of Object.entries(EXPECTED_LABELS)) {
      assert.strictEqual(lines[Number(line)], label, `行 ${line} 的 label 应为 ${label}`);
    }
  });

  test('缓存命中与 mtime 失效', async function () {
    this.timeout(60000);
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, '扩展在 Extension Host 中可用');
    await extension.activate();

    const cacheDir = path.join(tmpdir(), 'opencode', 'semantic-cache-test');
    const graphPath = path.join(cacheDir, 'graph.json');
    await rm(cacheDir, { recursive: true, force: true });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(graphPath, '{"functions":[]}', 'utf8');
    try {
      assert.strictEqual(await getSemanticFromCache(graphPath), undefined, '未入库时应为 miss');

      await saveSemanticToCache(graphPath, { 'x.py': { 1: 'L1' }});
      assert.deepStrictEqual(await getSemanticFromCache(graphPath), { 'x.py': { 1: 'L1' }}, '入库后 mtime 一致应命中');

      const later = new Date(Date.now() + 5000);
      await utimes(graphPath, later, later);
      assert.strictEqual(await getSemanticFromCache(graphPath), undefined, 'mtime 变化后应失效');

      assert.strictEqual(await getSemanticFromCache(path.join(cacheDir, '__no_such_file__.json')), undefined, '文件不存在应为 miss');
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });
});
