/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync'; // 同步解析，简单场景可用
import { AccuracyToolData, AccuracyToolCmpData, AccuracyToolCmpDetailData, SQLiteCache, AccuracyToolTaskCmpData, AccuracyToolTaskDetailData } from '../core/sqliteCache';
import * as readline from 'readline';
import { t } from 'i18next';
import { getSortedVerifyFiles } from './accurancyAnylasis';

export async function readCsv(oriFilePath: string, type: number = 1) {
  if (!oriFilePath || oriFilePath.length === 0 || !fs.existsSync(oriFilePath)) {
    return false;
  }

  try {
    const buffer = fs.readFileSync(oriFilePath);
    let content = buffer.toString('utf-8');
    // === 移除 UTF-8 BOM 头 ===
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count_less: true,
    }) as any[];

    const recordLength = records.length;
    vscode.window.showInformationMessage(t('pypto.accuracyCsvParseSucc', { recordLength }));

    // 使用循环而非 forEach，以便处理异步或错误捕获
    for (const row of records) {
      // 根据 type 参数决定数据映射和存储逻辑
      if (type === 1) {
        // --- Type 1: 原始 AccuracyToolData 逻辑 ---
        const dataToSave: AccuracyToolData = {
          filePath: oriFilePath,
          no: row['NO.'],
          phaseName: row['B>PHASE_NAME'],
          funcMagicName: row['PATH_FUNC:func_magicname'],
          rawMagic: row['B>:rawmagic'],
          result: row['AB>RESULT'],
          dataType: row[':datatype'],
          validShape: row[':validshape'],
          loopInfo: row['LOOP_INFO'],
          rtolAtol: row['AB>rtol/atol'],
          cntFailWarnTol: row['AB>fail_cnt/warn_cnt/tol_cnt'],
          cntTotalZeroInfnanCnt: row['AB>total_cnt/zero_cnt/infnan_cnt'],
          mre: row['AB>mre'],
          mreTop1permil: row['AB>mre_top1permil'],
          mreTop8: row['AB>mre_top8'],
          mae: row['AB>mae'],
          maeTop8: row['AB>mae_top8'],
          maeTop1permil: row['AB>mae_top1permil'],
          aMax: row['A>max'],
          aMin: row['A>min'],
          aAvg: row['A>avg'],
          aAavg: row['A>aavg'],
          aZero: row['A>zero'],
          aInfnan: row['A>infnan'],
          bMax: row['B>max'],
          bMin: row['B>min'],
          bAvg: row['B>avg'],
          bAavg: row['B>aavg'],
          bZero: row['B>zero'],
          bInfnan: row['B>infnan'],
          bTimestamp: row['B>TIMESTAMP'],
        };
        await SQLiteCache.getInstance().accuracyToolSet(dataToSave);
      } else if (type === 2) {
        // --- Type 2: AccuracyToolCmpData 逻辑 ---
        let cmpData: AccuracyToolCmpData = {
          filePath: oriFilePath,
          no: row['NO.'],
          pathFuncMagicName: row['PATH_FUNC:func_magicname '],

          loopInfo: row['LOOP_INFO'],
          symbol: row[':symbol'],
          validShape: row[':validshape'],
          dataType: row[':datatype'],
          opAttrSymOffset: row['OP_ATTR_SYM_OFFSET'],
          // B组信息
          bPhaseName: row['B>PHASE_NAME'],
          bTimestamp: row['B>TIMESTAMP']?.endsWith("'") ? row['B>TIMESTAMP'].slice(0, -1) : row['B>TIMESTAMP'],
          bFuncMagic: row['B>FUNC:funcmagic'],
          bFuncHash: row['B>FUNC:hash']?.endsWith("'") ? row['B>FUNC:hash'].slice(0, -1) : row['B>FUNC:hash'],
          bRootFuncHash: row['B>ROOT_FUNC:hash']?.endsWith("'") ? row['B>ROOT_FUNC:hash'].slice(0, -1) : row['B>ROOT_FUNC:hash'],
          bOpMagic: row['B>:opmagic'],
          bOpcode: row['B>:opcode'],
          bShape: row['B>:shape'],
          bRawShape: row['B>:rawshape'],
          bFormat: row['B>:format'],
          bFileName: row['B>FILENAME'],

          // A组信息
          aPhaseName: row['A>PHASE_NAME'],
          aFuncHash: row['A>FUNC:hash']?.endsWith("'") ? row['A>FUNC:hash'].slice(0, -1) : row['A>FUNC:hash'],
          aRootFuncHash: row['A>ROOT_FUNC:hash']?.endsWith("'") ? row['A>ROOT_FUNC:hash'].slice(0, -1) : row['A>ROOT_FUNC:hash'],
          aFuncMagic: row['A>FUNC:funcmagic'],
          aOpMagic: row['A>:opmagic'],
          aOpcode: row['A>:opcode'],
          aShape: row['A>:shape'],
          aRawShape: row['A>:rawshape'],
          aFormat: row['A>:format'],
          aFileName: row['A>FILENAME'],

          abResult: row['AB>RESULT'],
          abRtolAtol: row['AB>rtol/atol'],
          abFailWarnTol: row['AB>fail_cnt/warn_cnt/tol_cnt'],
          abTotalZeroInfnanCnt: row['AB>total_cnt/zero_cnt/infnan_cnt'],
          abMre: row['AB>mre'],
          abMreTop1permil: row['AB>mre_top1permil'],
          abMreTop8: row['AB>mre_top8'],
          abMae: row['AB>mae'],
          abMaeTop8: row['AB>mae_top8'],
          abMaeTop1permil: row['AB>mae_top1permil'],
          // ---- A端统计字段 ----
          aMax: row['A>max'],
          aMin: row['A>min'],
          aAvg: row['A>avg'],
          aAavg: row['A>aavg'],
          aZero: row['A>zero'],
          aInfnan: row['A>infnan'],
          // ---- B端统计字段 ----
          bMax: row['B>max'],
          bMin: row['B>min'],
          bAvg: row['B>avg'],
          bAavg: row['B>aavg'],
          bZero: row['B>zero'],
          bInfnan: row['B>infnan'],
        };

        await SQLiteCache.getInstance().accuracyToolCmpSet(cmpData);
      } else if (type === 3) {
        // --- Type 3: AccuracyToolCmpDetailData 逻辑 ---
        const detailData: AccuracyToolCmpDetailData = {
          filePath: oriFilePath,
          group: row['GROUP'],
          index: row['INDEX'],
          offset: row['OFFSET'],
          offsetRaw: row['OFFSET_RAW'],
          aData: row['A>data'],
          bData: row['B>data'],
          abAe: row['AB>ae'],
          abRe: row['AB>re'],
          abTol: row['AB>tol'],
        };
        await SQLiteCache.getInstance().accuracyToolCmpDetailSet(detailData);
      } else if (type === 4) {
        const dataToSave: AccuracyToolTaskCmpData = {
          // 暂时使用 any，建议替换为具体接口
          // --- 基础信息 ---
          sourceFileName: oriFilePath,
          no: row['NO.'],
          phaseName: row['B>PHASE_NAME'],
          
          rootCallOpmagic: row['ROOT_CALL:opmagic'],
          rootCallRawmagic: row['ROOT_CALL:rawmagic'],

          rootFuncHash: row['ROOT_FUNC:hash']?.endsWith("'") ? row['ROOT_FUNC:hash'].slice(0, -1) : row['ROOT_FUNC:hash'],
          funcHash: row['FUNC:hash']?.endsWith("'") ? row['FUNC:hash'].slice(0, -1) : row['FUNC:hash'],
          timestamp: row['B>TIMESTAMP']?.endsWith("'") ? row['B>TIMESTAMP'].slice(0, -1) : row['B>TIMESTAMP'],

          // --- 形状与类型 ---
          // offset: row['B>offset'],
          // rawShape: row['B>rawShape'],
          // tensorAddr: row['B>tensorAddr'],
          // loopVarInfos: row['B>loopVarInfos'],
          // execStart: row['B>execStart'],
          // execEnd: row['B>execEnd'],
          // funcId: row['B>funcId'],
          // taskId: row['B>taskId'],
          ioFlag: row['IO_FLAG'],
          // seqNo: row['B>seqNo'],
          fileName: row['B>FILENAME'], // 用于关联详情文件

          // --- A组数据 ---
          aPhaseName: row['A>PHASE_NAME'],
          aValidshape: row['A>validshape'],
          aDatatype: row['A>datatype'],

          // --- B组数据
          bValidShape: row['B>validshape'],
          bDataType: row['B>datatype'],
          bFuncId: row['B>funcId'],
          bTaskId: row['B>taskId'],
          bOffset: row['B>offset'],
          bExecStart: row['B>execStart'],
          bExecEnd: row['B>execEnd'],
          bRawShape: row['B>rawShape'],
          bTensorAddr: row['B>tensorAddr']?.endsWith("'") ? row['B>tensorAddr'].slice(0, -1) : row['B>tensorAddr'],
          bSeqNo: row['B>seqNo'],
          bLoopVarInfos: row['B>loopVarInfos'],

          // --- 结果统计 ---
          result: row['AB>RESULT'],
          rtolAtol: row['AB>rtol/atol'],
          cntFailWarnTol: row['AB>fail_cnt/warn_cnt/tol_cnt'],
          cntTotalZeroInfnanCnt: row['AB>total_cnt/zero_cnt/infnan_cnt'],

          // --- 误差指标 ---
          mae: row['AB>mae'],
          maeTop8: row['AB>mae_top8'],
          maeTop1permil: row['AB>mae_top1permil'],
          mre: row['AB>mre'],
          mreTop8: row['AB>mre_top8'],
          mreTop1permil: row['AB>mre_top1permil'],

          // --- A组统计值 ---
          aMax: row['A>max'],
          aMin: row['A>min'],
          aAvg: row['A>avg'],
          aAavg: row['A>aavg'],
          aZero: row['A>zero'],
          aInfnan: row['A>infnan'],

          // --- B组统计值 ---
          bMax: row['B>max'],
          bMin: row['B>min'],
          bAvg: row['B>avg'],
          bAavg: row['B>aavg'],
          bZero: row['B>zero'],
          bInfnan: row['B>infnan'],
        };

        // 保存到数据库
        await SQLiteCache.getInstance().accuracyToolTaskCmpSet(dataToSave);
      } else if (type === 5) {
        const cleanRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          cleanRow[key.trim()] = value;
        }
        const dataToSave: AccuracyToolTaskDetailData = {
          sourceFileName: oriFilePath,

          group: cleanRow['GROUP'] ?? '',
          index: cleanRow['INDEX'] ?? '',
          offset: cleanRow['OFFSET'] ?? '',
          offsetRaw: cleanRow['OFFSET_RAW'] ?? '',
          aData: cleanRow['A>data'] ?? '',
          bData: cleanRow['B>data'] ?? '',
          ae: cleanRow['AB>ae'] ?? '',
          re: cleanRow['AB>re'] ?? '',
          tol: cleanRow['AB>tol'] ?? '',
        };
        await SQLiteCache.getInstance().accuracyToolTaskDetailSet(dataToSave);
      } else {
        vscode.window.showWarningMessage(t('pypto.unsupportedCsvType', { type }));
        return false;
      }
    }

    // 统一在循环结束后保存一次，大幅提升性能
    await SQLiteCache.getInstance().save();
    vscode.window.showInformationMessage(t('pypto.accuracyCsvParseRes', { recordLength }));

    return true;
  } catch (err) {
    vscode.window.showInformationMessage(t('pypto.accuracyCsvParseFail', { err }));
    return false;
  }
}
export async function getCsvData(oriFilePath: string, type: number = 1) {
  if (type === 1) {
  } else if (type === 2) {
    const result = await SQLiteCache.getInstance().accuracyToolCmpGetByFilePath(oriFilePath, 50, 0);
    console.log('getCsvData:', result);
  } else if (type === 3) {
    const result = await SQLiteCache.getInstance().accuracyToolCmpDetailGetByFilePath(oriFilePath);
    console.log('getCsvData:', result);
  } else if (type === 4) {
    const result = await SQLiteCache.getInstance().accuracyToolTaskCmpGetByFileName(oriFilePath, 50, 0);
    console.log('getCsvData:', result);
  } else if (type === 5) {
    const result = await SQLiteCache.getInstance().accuracyToolTaskDetailGet(oriFilePath);
    console.log('getCsvData:', result);
  } else {
    vscode.window.showWarningMessage(t('pypto.unsupportedCsvType', { type }));
    return false;
  }
}
export async function getCmpFileList(cmpListUrl, from="opcheck") {
  try {
    const resultFiles = getSortedVerifyFiles(cmpListUrl, from);
    return resultFiles;
  } catch (error: any) {
    console.error('处理失败:', error.message);
    return [];
  }
}

export class SmartLogExtractor {
  /**
   * 统一策略：流式读取 + 找到即停
   * 优势：
   * 1. 内存安全：无论文件多大，内存占用极低。
   * 2. 速度极快：一旦找到结束标记，立即停止磁盘 I/O（特别是大文件的尾部匹配）。
   * 3. 代码简洁：单一职责，易于维护。
   */
  public async extract(filePath: string, startKeyword: string, endKeyword: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const result: string[] = [];
      let isRecording = false;
      let isFinished = false;

      if (!fs.existsSync(filePath)) {
        reject(new Error(`文件不存在: ${filePath}`));
        return;
      }

      const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      rl.on('line', (line) => {
        if (isFinished) return;

        if (isRecording && line.startsWith(endKeyword)) {
          isFinished = true;
          stream.destroy();
          rl.close();
          return;
        }

        if (!isRecording && line.includes(startKeyword)) {
          isRecording = true;
          result.push(line);
          return;
        }

        if (isRecording) {
          result.push(line);
        }
      });

      rl.on('close', () => {
        resolve(result);
      });

      stream.on('error', (err) => {
        // 如果是主动 destroy() 导致的 error，可以忽略，或者直接 resolve
        if (isFinished) {
          resolve(result);
        } else {
          reject(err);
        }
      });
    });
  }
}
