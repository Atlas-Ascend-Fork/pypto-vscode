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
import * as path from 'path';
import * as vscode from 'vscode';
import {
  getCceFile,
  getCceLocation,
  getLabel,
  getLabelByCceLine,
  getLabelsByCceFile,
  getOpByCceLine,
  getOpByCceTree,
  getOpsByPyLine,
  loadFourColData,
  locateFourColFiles,
} from './index';

// 定死的查询条件（来自 dev/4_col/data/sum_lstm 真实数据）
const TEST_LEAF_HASH = '11133360491696497719';
const TEST_OP_MAGIC = '10632';
const TEST_CCE_FILE = 'sum_lstm_kernel_loop_idx_bs_offset_Unroll4_PATH0_hiddenfunc_6_17003207903596263872_0_aiv.cpp';
const TEST_CCE_FILE_2 = 'sum_lstm_kernel_loop_idx_bs_offset_Unroll4_PATH0_hiddenfunc_6_17003207903596263872_2_aiv_main.cpp';
const TEST_NO_LABEL_CCE_FILE = 'aicore_530342627983503388.cpp';
const TEST_CCE_LINE = 26;
const TEST_NON_OP_CCE_LINE = 20;
const TEST_PY_LINE = 164;
const TEST_PY_LINE_OP_COUNT = 67;

function log(message: string): void {
  console.log(`[test4col] [${new Date().toISOString()}] ${message}`);
}

function normalizeDriveLetter(filePath: string): string {
  return filePath.replace(/^([a-z]):/i, (_match, drive: string) => `${drive.toUpperCase()}:`);
}

export async function runFourColTest(pyPath: string): Promise<void> {
  let pass = 0;
  let fail = 0;
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'test4col', cancellable: false },
    async (progress) => {
      log(`==== 四联动查询测试开始，py 文件: ${pyPath} ====`);
      const check = (name: string, actual: unknown, expected: unknown): void => {
        const ok = JSON.stringify(actual) === JSON.stringify(expected);
        if (ok) {
          pass++;
        } else {
          fail++;
        }
        log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`);
        log(`         期望: ${JSON.stringify(expected)}`);
        log(`         实际: ${JSON.stringify(actual)}`);
      };
      try {
        const { dataDir } = locateFourColFiles(pyPath);
        const ccePath = path.join(dataDir, 'kernel_aicore', TEST_CCE_FILE);
        const pyFile = path.join(dataDir, 'kernel_src', 'sum_lstm.py');

        progress.report({ message: '读取三份 JSON 并入库' });
        const startTime = Date.now();
        const stats = await loadFourColData(pyPath);
        log(`[LOAD] 入库完成: cce_opmagic ${stats.opmagicCount} 行, cce_label ${stats.labelCount} 行, op ${stats.opCount} 行`);
        log(`[LOAD] 耗时 ${Date.now() - startTime}ms`);
        check('入库行数（opmagic/label/op）', [stats.opmagicCount, stats.labelCount, stats.opCount], [450, 48, 845]);

        progress.report({ message: '执行查询测试' });
        check('getCceLocation 正向', await getCceLocation(TEST_LEAF_HASH, TEST_OP_MAGIC), { fileName: TEST_CCE_FILE, lines: [TEST_CCE_LINE]});
        check('getCceLocation 假 opmagic', await getCceLocation(TEST_LEAF_HASH, '99999'), null);
        check('getCceLocation 假 hash', await getCceLocation('1234567890123456789', TEST_OP_MAGIC), null);

        const cceTreeResult = await getOpByCceTree(ccePath, TEST_CCE_LINE);
        check(
          'getOpByCceTree 正向（全路径入参）',
          cceTreeResult ? { ...cceTreeResult, pyFile: normalizeDriveLetter(cceTreeResult.pyFile ?? '') } : null,
          {
            leafHash: TEST_LEAF_HASH,
            opmagic: TEST_OP_MAGIC,
            pyFile: normalizeDriveLetter(pyFile),
            pyLine: 194,
            label: 'gelu_activation_core 2',
          },
        );
        check('getOpByCceTree 非 op 行', await getOpByCceTree(ccePath, TEST_NON_OP_CCE_LINE), null);

        const ops = await getOpsByPyLine(pyFile, TEST_PY_LINE);
        check('getOpsByPyLine 正向数量', ops.length, TEST_PY_LINE_OP_COUNT);
        check('getOpsByPyLine 错 basename', await getOpsByPyLine(path.join(dataDir, 'kernel_src', '__init__.py'), TEST_PY_LINE), []);

        check('getCceFile 正向', await getCceFile(TEST_LEAF_HASH), TEST_CCE_FILE);
        check('getCceFile 假 hash', await getCceFile('1234567890123456789'), null);

        check('getLabel 正向', await getLabel(TEST_LEAF_HASH, TEST_OP_MAGIC), 'gelu_activation_core 2');
        check('getLabel 无 label 覆盖', await getLabel(TEST_LEAF_HASH, '11163'), null);

        check('getOpByCceLine 正向', await getOpByCceLine(ccePath, TEST_CCE_LINE), { leafHash: TEST_LEAF_HASH, opmagic: TEST_OP_MAGIC });
        check('getOpByCceLine 非 op 行', await getOpByCceLine(ccePath, TEST_NON_OP_CCE_LINE), null);
        check('getLabelByCceLine op 行', await getLabelByCceLine(ccePath, TEST_CCE_LINE), 'gelu_activation_core 2');
        check('getLabelByCceLine 多行条目', await getLabelByCceLine(ccePath, 21), 'Cell_Update');
        check('getLabelByCceLine 无覆盖行', await getLabelByCceLine(ccePath, TEST_NON_OP_CCE_LINE), null);

        check('getLabelsByCceFile 双 label 文件', await getLabelsByCceFile(ccePath), [
          { label: 'Cell_Update', lines: [21, 30]},
          { label: 'gelu_activation_core 2', lines: [26]},
        ]);
        check('getLabelsByCceFile 区间展开', await getLabelsByCceFile(path.join(dataDir, 'kernel_aicore', TEST_CCE_FILE_2)), [
          { label: 'Cell_Update', lines: [38, 42, 74, 77, 80]},
          { label: 'Gate_Sigmoid', lines: [34, 66, 67, 68, 69]},
          { label: 'Input_Fusion', lines: [48, 49, 51]},
          { label: 'rms_norm_pure', lines: [55, 56, 59, 61, 62]},
        ]);
        check('getLabelsByCceFile 无 label 文件', await getLabelsByCceFile(path.join(dataDir, 'kernel_aicore', TEST_NO_LABEL_CCE_FILE)), []);
      } catch (error) {
        fail++;
        const message = error instanceof Error ? error.message : String(error);
        log(`[ERROR] ${message}`);
        vscode.window.showErrorMessage(`test4col 执行失败: ${message}`);
      }
      log(`==== 测试结束: ${pass} 通过, ${fail} 失败 ====`);
    },
  );
  const summary = `test4col 完成: ${pass} 通过, ${fail} 失败（详细日志在调试控制台）`;
  if (fail > 0) {
    vscode.window.showWarningMessage(summary);
  } else {
    vscode.window.showInformationMessage(summary);
  }
}
