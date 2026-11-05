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
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

import * as vscode from 'vscode';

import { FourcolMsgHandler } from '../../handler/fourcolMsgHandler';
import {
  getCceLocation,
  getOpsByPyInfo,
  getPyFileList,
  getPyLocationByOps,
  isProgramLoaded,
  loadFourColData,
  pyPathToProgramId,
} from '../../services/fourcol';
import { runFourColTest } from '../../services/fourcol/test';

const EXTENSION_ID = 'CANN-PUB.pypto-toolkit';
const SUM_LSTM_PY = path.join('dev', '4_col', 'data', 'sum_lstm', 'kernel_src', 'sum_lstm.py');

function getDevPyPath(extensionPath: string): string {
  const pyPath = path.join(extensionPath, SUM_LSTM_PY);
  assert.ok(fs.existsSync(pyPath), `测试数据不存在: ${pyPath}（需 dev/4_col/data/sum_lstm）`);
  return pyPath;
}

suite('fourcol（四联动索引：服务层 + 消息层，无头）', () => {
  test('test4col 全量断言通过（单 program 21+3 项 + 多 program 隔离用例）', async function () {
    this.timeout(240000);
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, '扩展在 Extension Host 中可用');
    await extension.activate();

    const { pass, fail } = await runFourColTest(getDevPyPath(extension.extensionPath));
    assert.strictEqual(fail, 0, `test4col 有 ${fail} 项失败（${pass} 项通过），断言明细见控制台日志`);
    assert.ok(pass > 20, `test4col 通过项异常偏少: ${pass}`);
  });

  test('FourcolMsgHandler：未加载/无 comPath 返回 null，已加载委托 service 返回结果', async function () {
    this.timeout(60000);
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, '扩展在 Extension Host 中可用');
    await extension.activate();

    const pyPath = getDevPyPath(extension.extensionPath);
    const programId = pyPathToProgramId(pyPath);
    const comPath = path.join(path.dirname(path.dirname(pyPath)), 'program.json');

    // 自包含：确保该 program 已灌库（幂等，指纹命中时秒回）
    const stats = await loadFourColData(programId);
    assert.ok(stats.skippedReload || stats.opCount > 0, 'loadFourColData 应成功灌库或命中指纹');

    // 未加载（无指纹的假目录）与无 comPath：一律 null，不自动触发 load
    assert.strictEqual(await FourcolMsgHandler.getPyFileList({ comPath: path.join('__no_such_program__', 'program.json') }), null);
    assert.strictEqual(await FourcolMsgHandler.getOpsByPyInfo({}, { paramObj: { pyFile: pyPath, pyLine: 164 }}), null);
    assert.strictEqual(await FourcolMsgHandler.getPyLocationByOps({}, { paramObj: []}), null);

    // 已加载：薄委托到 service 层（本机 extensionPath 盘符为小写 m:，顺带验证 toProgramId 归一化）
    const stubServer = { comPath };

    const ops = await FourcolMsgHandler.getOpsByPyInfo(stubServer, { paramObj: { pyFile: pyPath, pyLine: 164 }});
    assert.ok(Array.isArray(ops) && ops.length === 67, `getOpsByPyInfo 应返回 67 对，实际: ${ops?.length}`);

    const locations = await FourcolMsgHandler.getPyLocationByOps(stubServer, {
      paramObj: [
        { hash: '11133360491696497719', opmagic: '10632' },
        { hash: '1234567890123456789', opmagic: '10632' },
      ],
    });
    assert.ok(Array.isArray(locations) && locations.length === 2, 'getPyLocationByOps 出参与入参索引对齐');
    assert.ok(
      locations[0] && locations[0].pyLine === 194 && locations[0].pyFile.endsWith('sum_lstm.py'),
      `第 0 位应为真实落点: ${JSON.stringify(locations[0])}`,
    );
    assert.strictEqual(locations[1], null, '查不到的入参在对应索引位返回 null');

    const files = await FourcolMsgHandler.getPyFileList(stubServer);
    assert.ok(Array.isArray(files) && files.length === 1, `getPyFileList 应返回 1 个 py 文件，实际: ${files?.length}`);
    assert.strictEqual(files?.[0].exists, true, '本机数据 sum_lstm.py 应存在');
  });

  test('三栏联动（仅计算图、无 CCE 数据）下三个 py 反查接口可用', async function () {
    this.timeout(60000);
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, '扩展在 Extension Host 中可用');
    await extension.activate();

    const pyPath = getDevPyPath(extension.extensionPath);
    const sourceGraph = path.join(path.dirname(path.dirname(pyPath)), 'program.json');
    const graphOnlyDir = path.join(tmpdir(), 'opencode', 'fourcol-graph-only-test');
    await rm(graphOnlyDir, { recursive: true, force: true });
    await mkdir(graphOnlyDir, { recursive: true });
    await writeFile(path.join(graphOnlyDir, 'program.json'), await readFile(sourceGraph));
    try {
      const programId = pyPathToProgramId(path.join(graphOnlyDir, 'kernel_src', 'sum_lstm.py'));
      const stats = await loadFourColData(programId);
      assert.strictEqual(stats.skippedReload, false, '首次加载应全量灌库');
      assert.deepStrictEqual(
        [stats.opmagicCount, stats.labelCount, stats.opCount, stats.cceFileCount],
        [0, 0, 845, 0],
        '仅计算图：op 表 845 行，CCE 三表为 0',
      );
      assert.strictEqual(await isProgramLoaded(programId), true, '图文件加载后应视为已加载');

      // 三个 py 反查接口照常解析（py 组件同事契约：联动模式 + 有计算图即可用）
      const ops = await getOpsByPyInfo(programId, pyPath, 164);
      assert.ok(Array.isArray(ops) && ops.length === 67, `getOpsByPyInfo 应返回 67 对，实际: ${ops?.length}`);
      const locations = await getPyLocationByOps(programId, [{ hash: '11133360491696497719', opmagic: '10632' }]);
      assert.ok(locations[0] && locations[0].pyLine === 194, `getPyLocationByOps 应返回真实落点: ${JSON.stringify(locations[0])}`);
      const files = await getPyFileList(programId);
      assert.ok(Array.isArray(files) && files.length === 1 && files[0].exists === true, 'getPyFileList 应返回 1 个存在的 py 文件');

      // CCE 相关接口无数据时自然返回空（四栏专属能力不受降级影响）
      assert.strictEqual(await getCceLocation(programId, '11133360491696497719', '10632'), null, '无 CCE 数据时 getCceLocation 应为 null');
    } finally {
      await rm(graphOnlyDir, { recursive: true, force: true });
    }
  });
});
