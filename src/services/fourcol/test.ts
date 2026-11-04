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
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  FourcolLoadStats,
  getCceFile,
  getCceFileList,
  getCceLocation,
  getLabel,
  getLabelByCceLine,
  getLabelsByCceFile,
  getOpByCceLine,
  getOpByCceTree,
  getOpsByPyInfo,
  getOpsByPyLine,
  getPyFileList,
  getPyLocationByOps,
  isProgramLoaded,
  loadFourColData,
  locateFourColFiles,
  normalizeProgramPath,
  pyPathToProgramId,
  removeLoadFingerprint,
} from './index';

// A（所选 program = sum_lstm）定死的查询条件（来自 dev/4_col/data/sum_lstm 真实数据）
const TEST_LEAF_HASH = '11133360491696497719';
const TEST_OP_MAGIC = '10632';
const TEST_CCE_FILE = 'sum_lstm_kernel_loop_idx_bs_offset_Unroll4_PATH0_hiddenfunc_6_17003207903596263872_0_aiv.cpp';
const TEST_CCE_FILE_2 = 'sum_lstm_kernel_loop_idx_bs_offset_Unroll4_PATH0_hiddenfunc_6_17003207903596263872_2_aiv_main.cpp';
const TEST_NO_LABEL_CCE_FILE = 'aicore_530342627983503388.cpp';
const TEST_CCE_LINE = 26;
const TEST_NON_OP_CCE_LINE = 20;
const TEST_PY_LINE = 164;
const TEST_PY_LINE_OP_COUNT = 67;

// B（自动发现的兄弟 program = flash_attention_mha_grad）定死的查询条件（真实数据）
const SIBLING_FLASH_DIR = 'flash_attention_mha_grad';
const FLASH_LEAF_HASH = '1339892185811445565';
const FLASH_OP_MAGIC = '10097';
const FLASH_CCE_FILE =
  'flash_attention_mha_grad_kernel_impl_loop_idx_s2_idx_Unroll1_PATH0_hiddenfunc_6_10485594216240246142_2_mix0_aiv1.cpp';
const FLASH_CCE_LINE = 869;
// [cce_opmagic, cce_label, op, cce_file]：label 空、py 落点走 op.file（不参与定位）故 op 为 0
const FLASH_EXPECTED_COUNTS = [3478, 0, 0, 11];

function log(message: string): void {
  console.log(`[test4col] [${new Date().toISOString()}] ${message}`);
}

function countsOf(stats: FourcolLoadStats): number[] {
  return [stats.opmagicCount, stats.labelCount, stats.opCount, stats.cceFileCount];
}

/** 扫 dataDir 的兄弟目录，返回三件套齐全的候选 program（当前数据 → flash_attention_mha_grad） */
function findSiblingPrograms(dataDir: string): string[] {
  const parent = path.dirname(dataDir);
  let entries: string[];
  try {
    entries = fs.readdirSync(parent);
  } catch {
    return [];
  }
  const selfName = path.basename(dataDir);
  const siblings: string[] = [];
  for (const name of entries.sort()) {
    if (name === selfName) {
      continue;
    }
    const candidate = path.join(parent, name);
    try {
      if (fs.statSync(candidate).isDirectory() && locateFourColFiles(candidate).missing.length === 0) {
        siblings.push(normalizeProgramPath(candidate));
      }
    } catch {
      // 无法访问的目录直接跳过
    }
  }
  return siblings;
}

export async function runFourColTest(pyPath: string): Promise<{ pass: number; fail: number }> {
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
        const programIdA = pyPathToProgramId(pyPath);
        const { dataDir } = locateFourColFiles(programIdA);
        const ccePath = path.join(dataDir, 'kernel_aicore', TEST_CCE_FILE);
        const pyFile = path.join(dataDir, 'kernel_src', 'sum_lstm.py');

        progress.report({ message: '读取三份 JSON 并入库' });
        const startTime = Date.now();
        const statsA1 = await loadFourColData(programIdA);
        log(`[LOAD] ${statsA1.skippedReload ? '指纹一致，跳过重灌' : '清空重灌完成'}`);
        log(`[LOAD] 耗时 ${Date.now() - startTime}ms`);
        log(`[LOAD] cce_opmagic ${statsA1.opmagicCount} 行, cce_label ${statsA1.labelCount} 行`);
        log(`[LOAD] op ${statsA1.opCount} 行, cce_file ${statsA1.cceFileCount} 行`);
        check('入库行数', countsOf(statsA1), [450, 48, 845, 21]);

        progress.report({ message: '执行查询测试' });
        check(
          'getCceLocation 正向',
          await getCceLocation(programIdA, TEST_LEAF_HASH, TEST_OP_MAGIC),
          { fileName: TEST_CCE_FILE, lines: [TEST_CCE_LINE]},
        );
        check('getCceLocation 假 opmagic', await getCceLocation(programIdA, TEST_LEAF_HASH, '99999'), null);
        check(
          'getCceLocation 假 hash',
          await getCceLocation(programIdA, '1234567890123456789', TEST_OP_MAGIC),
          null,
        );

        const cceTreeResult = await getOpByCceTree(programIdA, ccePath, TEST_CCE_LINE);
        check(
          'getOpByCceTree 正向（全路径入参）',
          cceTreeResult ? { ...cceTreeResult, pyFile: normalizeProgramPath(cceTreeResult.pyFile ?? '') } : null,
          {
            leafHash: TEST_LEAF_HASH,
            opmagic: TEST_OP_MAGIC,
            pyFile: normalizeProgramPath(pyFile),
            pyLine: 194,
            label: 'gelu_activation_core 2',
          },
        );
        check('getOpByCceTree 非 op 行', await getOpByCceTree(programIdA, ccePath, TEST_NON_OP_CCE_LINE), null);

        const ops = await getOpsByPyLine(programIdA, pyFile, TEST_PY_LINE);
        check('getOpsByPyLine 正向数量', ops.length, TEST_PY_LINE_OP_COUNT);
        check(
          'getOpsByPyLine 错 basename',
          await getOpsByPyLine(programIdA, path.join(dataDir, 'kernel_src', '__init__.py'), TEST_PY_LINE),
          [],
        );

        check('getCceFile 正向', await getCceFile(programIdA, TEST_LEAF_HASH), TEST_CCE_FILE);
        check('getCceFile 假 hash', await getCceFile(programIdA, '1234567890123456789'), null);

        check('getLabel 正向', await getLabel(programIdA, TEST_LEAF_HASH, TEST_OP_MAGIC), 'gelu_activation_core 2');
        check('getLabel 无 label 覆盖', await getLabel(programIdA, TEST_LEAF_HASH, '11163'), null);

        check(
          'getOpByCceLine 正向',
          await getOpByCceLine(programIdA, ccePath, TEST_CCE_LINE),
          { leafHash: TEST_LEAF_HASH, opmagic: TEST_OP_MAGIC },
        );
        check('getOpByCceLine 非 op 行', await getOpByCceLine(programIdA, ccePath, TEST_NON_OP_CCE_LINE), null);
        check('getLabelByCceLine op 行', await getLabelByCceLine(programIdA, ccePath, TEST_CCE_LINE), 'gelu_activation_core 2');
        check('getLabelByCceLine 多行条目', await getLabelByCceLine(programIdA, ccePath, 21), 'Cell_Update');
        check('getLabelByCceLine 无覆盖行', await getLabelByCceLine(programIdA, ccePath, TEST_NON_OP_CCE_LINE), null);

        check('getLabelsByCceFile 双 label 文件', await getLabelsByCceFile(programIdA, ccePath), [
          { label: 'Cell_Update', lines: [21, 30]},
          { label: 'gelu_activation_core 2', lines: [26]},
        ]);
        check('getLabelsByCceFile 区间展开', await getLabelsByCceFile(programIdA, path.join(dataDir, 'kernel_aicore', TEST_CCE_FILE_2)), [
          { label: 'Cell_Update', lines: [38, 42, 74, 77, 80]},
          { label: 'Gate_Sigmoid', lines: [34, 66, 67, 68, 69]},
          { label: 'Input_Fusion', lines: [48, 49, 51]},
          { label: 'rms_norm_pure', lines: [55, 56, 59, 61, 62]},
        ]);
        check(
          'getLabelsByCceFile 无 label 文件',
          await getLabelsByCceFile(programIdA, path.join(dataDir, 'kernel_aicore', TEST_NO_LABEL_CCE_FILE)),
          [],
        );

        const fileList = await getCceFileList(programIdA, TEST_LEAF_HASH, TEST_OP_MAGIC);
        check('getCceFileList 总数', fileList.length, 21);
        check(
          'getCceFileList 关联在前（非main→main）',
          fileList.filter((file) => file.related).map((file) => file.fileName),
          [TEST_CCE_FILE, TEST_CCE_FILE.replace('.cpp', '_main.cpp')],
        );
        check('getCceFileList 第三项起全部非关联', fileList.slice(2).every((file) => !file.related), true);
        check(
          'getCceFileList 不产码 op 全部非关联',
          (await getCceFileList(programIdA, TEST_LEAF_HASH, '99999')).every((file) => !file.related),
          true,
        );

        const opsByPyInfo = await getOpsByPyInfo(programIdA, pyFile, TEST_PY_LINE);
        check('getOpsByPyInfo 正向数量', opsByPyInfo?.length ?? 0, TEST_PY_LINE_OP_COUNT);
        check('getOpsByPyInfo 无命中', await getOpsByPyInfo(programIdA, path.join(dataDir, 'kernel_src', '__init__.py'), TEST_PY_LINE), null);

        const pyLocation = await getPyLocationByOps(programIdA, [
          { hash: TEST_LEAF_HASH, opmagic: TEST_OP_MAGIC },
          { hash: '1234567890123456789', opmagic: TEST_OP_MAGIC },
        ]);
        check(
          'getPyLocationByOps 索引对齐',
          pyLocation.map((item) => (item ? { pyFile: normalizeProgramPath(item.pyFile), pyLine: item.pyLine } : null)),
          [{ pyFile: normalizeProgramPath(pyFile), pyLine: 194 }, null],
        );

        const pyList = await getPyFileList(programIdA);
        check(
          'getPyFileList 正向',
          pyList === null ? null : pyList.map((item) => ({ path: normalizeProgramPath(item.path), exists: item.exists })),
          [{ path: normalizeProgramPath(pyFile), exists: true }],
        );

        progress.report({ message: '执行多 program 用例' });
        const siblings = findSiblingPrograms(dataDir);
        if (siblings.length === 0) {
          log('[SKIP] 未发现兄弟 program（三件套齐全的同级目录），跳过多 program 用例');
        }
        for (const programIdB of siblings) {
          const nameB = path.basename(programIdB);
          log(`==== 多 program 用例，B: ${nameB} ====`);
          const statsB1 = await loadFourColData(programIdB);
          log(
            `[LOAD] B ${statsB1.skippedReload ? '指纹一致，跳过重灌' : '清空重灌完成'}: cce_opmagic ${statsB1.opmagicCount} 行, ` +
              `cce_label ${statsB1.labelCount} 行, op ${statsB1.opCount} 行, cce_file ${statsB1.cceFileCount} 行`,
          );
          const isFlash = nameB === SIBLING_FLASH_DIR;
          if (isFlash) {
            check('B 入库行数（flash 固定值）', countsOf(statsB1), FLASH_EXPECTED_COUNTS);
          }

          check('隔离：A 的 op 在 B 下查询', await getCceLocation(programIdB, TEST_LEAF_HASH, TEST_OP_MAGIC), null);
          check('隔离：A 的 py 行在 B 下查询', await getOpsByPyLine(programIdB, pyFile, TEST_PY_LINE), []);
          if (isFlash) {
            check('隔离：B 的 op 在 A 下查询', await getCceLocation(programIdA, FLASH_LEAF_HASH, FLASH_OP_MAGIC), null);
            check(
              '隔离：B 正向',
              await getCceLocation(programIdB, FLASH_LEAF_HASH, FLASH_OP_MAGIC),
              { fileName: FLASH_CCE_FILE, lines: [FLASH_CCE_LINE]},
            );
          }

          check('B 已加载（isProgramLoaded）', await isProgramLoaded(programIdB), true);
          check('未加载的 program（isProgramLoaded）', await isProgramLoaded(path.join(path.dirname(dataDir), '__no_such_program__')), false);
          if (isFlash) {
            check('B 无 py 数据时 getPyFileList 返回 null', await getPyFileList(programIdB), null);
          }

          await removeLoadFingerprint(programIdA);
          const statsA2 = await loadFourColData(programIdA);
          check('A 删指纹后全量重灌', statsA2.skippedReload, false);
          check('A 重灌后行数一致', countsOf(statsA2), countsOf(statsA1));
          const statsB2 = await loadFourColData(programIdB);
          check('B 指纹跳过不受 A 重灌影响', statsB2.skippedReload, true);
          check('A 重灌未动 B 行数', countsOf(statsB2), countsOf(statsB1));
          const statsA3 = await loadFourColData(programIdA);
          check('A 二次加载指纹跳过', statsA3.skippedReload, true);
        }
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
  return { pass, fail };
}
