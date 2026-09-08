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
import * as path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { existsSync, promises as fs } from 'fs';
import { createAllTables } from './cache-schema';
import { ComGraphCache } from './com-graph-cache';
import { AccuracyCache } from './accuracy-cache';
import { TASK_CMP_FIELDS, extractParams } from './cache-field-maps';

// Re-export all types for backward compatibility (no SwimGraph types)
export type {
  ComGraphLayoutRow,
  ComGraphFinalResultRow,
  ComGraphFuncDataRow,
  AccuracyToolCompList,
  AccuracyToolData,
  AccuracyToolCmpData,
  AccuracyToolCmpDetailData,
  accuFilePathData,
  PaginatedResult,
} from './cache-types';

// Re-export getMTime for backward compatibility
export { getMTime } from './cache-query-helper';

/**
 * 定义数据接口，对应 accuracy_tool_task_cmp 表的字段
 */
export interface TaskCmpFilterWord {
  rawMagic?: string;
  opMagic?: string;
  tensorAddr?: string;
  symbol?: string;
  funchash?: string;
}

export interface AccuracyToolTaskCmpData {
  sourceFileName?: string;
  no: string; // NO.
  phaseName: string; // A>PHASE_NAME
  ioFlag: string; // IO_FLAG
  loopInfo: string; // LOOP_INFO
  rootCallOpmagic: string; // ROOT_CALL:opmagic
  rootCallRawmagic: string; // ROOT_CALL:rawmagic
  fileName: string; // B>FILENAME

  aPhaseName: string; // A>PHASE_NAME
  aDatatype: string; // A>:datatype
  aFormat: string; // A>:format
  aMagic: string; // A>:magic
  aOpcode: string; // A>:opcode
  aOpMagic: string; // A>:opmagic
  aRawMagic: string; // A>:rawmagic
  aSymbol: string; // A>:symbol
  aValidshape: string; // A>:validshape
  aDynvalidshape: string; // A>EVAL:dynvalidshape
  aOpAttrAtomic: string; // A>OP_ATTR_ATOMIC
  aOpAttrSymOfst: string; // A>OP_ATTR_SYM_OFFSET
  aFuncHash: string; // FUNC:hash
  aPathHash: string; // PATH_FUNC:hash
  aRootFuncHash: string; // ROOT_FUNC:hash

  bDataType: string; // B>:datatype
  bRawShape: string; // B>:rawShape
  bValidShape: string; // B>:validshape
  bBlockIdx: string; // B>blockIdx
  bOpAttrSymOfst: string; // B>OP_ATTR_SYM_OFFSET
  bSeqNo: string; // B>seqNo
  bTaskId: string; // B>taskId
  bTensorAddr: string; // B>tensorAddr
  bTimestamp: string; // B>TIMESTAMP
  bExecTimestamp: string; // B>EXEC_TIMESTAMP

  result: string; // AB>RESULT
  rtolAtol: string; // AB>rtol/atol
  cntFailWarnTol: string; // AB>fail_cnt/warn_cnt/tol_cnt
  cntTotalZeroInfnanCnt: string; // AB>total_cnt/zero_cnt/infnan_cnt
  mae: string; // AB>mae
  maeTop8: string; // AB>mae_top8
  maeTop1permil: string; // AB>mae_top1permil
  mre: string; // AB>mre
  mreTop8: string; // AB>mre_top8
  mreTop1permil: string; // AB>mre_top1permil

  aMax: string; // A>max
  aMin: string; // A>min
  aAvg: string; // A>avg
  aAavg: string; // A>aavg
  aZero: string; // A>zero
  aInfnan: string; // A>infnan

  bMax: string; // B>max
  bMin: string; // B>min
  bAvg: string; // B>avg
  bAavg: string; // B>aavg
  bZero: string; // B>zero
  bInfnan: string; // B>infnan
}

export interface AccuracyToolTaskDetailData {
  sourceFileName?: string;
  group: string; // GROUP
  index: string; // INDEX
  offset: string; // OFFSET
  offsetRaw: string; // OFFSET_RAW
  aData: string; // A>data
  bData: string; // B>data
  ae: string; // AB>ae
  re: string; // AB>re
  tol: string; // AB>tol
}

export class SQLiteCache {
  private static _instance: SQLiteCache;
  private db: Database | undefined;
  private readonly dbFile: string;

  // 子模块实例（在 open() 中初始化）
  public comGraph!: ComGraphCache;
  public accuracy!: AccuracyCache;

  private constructor(context: vscode.ExtensionContext) {
    this.dbFile = path.join(context.globalStorageUri.fsPath, 'cache.db');
  }

  // === 单例管理 ===
  public static getInstance(): SQLiteCache {
    if (!SQLiteCache._instance) {
      throw new Error('SQLiteCache has not been initialized yet!');
    }
    return SQLiteCache._instance;
  }

  public static async init(context: vscode.ExtensionContext): Promise<SQLiteCache> {
    if (SQLiteCache._instance) {
      return SQLiteCache._instance;
    }
    console.log('初始化缓存数据库');
    SQLiteCache._instance = new SQLiteCache(context);
    await SQLiteCache._instance.open();
    return SQLiteCache._instance;
  }

  // === 初始化 ===
  private async open() {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(this.dbFile)));

    // 不传 locateFile：emscripten 在 node 环境默认从 sql.js 模块所在目录（node_modules/sql.js/dist/）解析 wasm，
    // 源码模式与 VSIX 打包（node_modules 随包分发）下均真实存在。
    // 旧实现指向 dist/node_modules/sql.js/sql-wasm.wasm，该位置仅由 build/copy-wasm.js 隐式落位，属脆弱的跨文件约定。
    const SQL = await initSqlJs();

    let buf: Uint8Array | undefined;
    try {
      buf = await vscode.workspace.fs.readFile(vscode.Uri.file(this.dbFile));
    } catch {
      // 文件不存在，首次创建
    }

    this.db = new SQL.Database(buf);

    // 建表（委托到 cache-schema.ts）
    createAllTables(this.db);

    // 额外表：accuracy_tool_task_cmp 和 accuracy_tool_task_result_detail（remote 新增）
    this.db.run(`
      CREATE TABLE IF NOT EXISTS accuracy_tool_task_cmp (
        "sourceFileName" TEXT,
        "NO." TEXT,
        "A>PHASE_NAME" TEXT,
        "IO_FLAG" TEXT,
        "LOOP_INFO" TEXT,
        "ROOT_CALL:opmagic" TEXT,
        "ROOT_CALL:rawmagic" TEXT,
        "B>FILENAME" TEXT,
        "A>:datatype" TEXT,
        "A>:format" TEXT,
        "A>:magic" TEXT,
        "A>:opcode" TEXT,
        "A>:opmagic" TEXT,
        "A>:rawmagic" TEXT,
        "A>:symbol" TEXT,
        "A>:validshape" TEXT,
        "A>EVAL:dynvalidshape" TEXT,
        "A>OP_ATTR_ATOMIC" TEXT,
        "A>OP_ATTR_SYM_OFFSET" TEXT,
        "FUNC:hash" TEXT,
        "PATH_FUNC:hash" TEXT,
        "ROOT_FUNC:hash" TEXT,
        "B>:datatype" TEXT,
        "B>:rawShape" TEXT,
        "B>:validshape" TEXT,
        "B>blockIdx" TEXT,
        "B>OP_ATTR_SYM_OFFSET" TEXT,
        "B>seqNo" TEXT,
        "B>taskId" TEXT,
        "B>tensorAddr" TEXT,
        "B>TIMESTAMP" TEXT,
        "B>EXEC_TIMESTAMP" TEXT,
        "AB>RESULT" TEXT,
        "AB>rtol/atol" TEXT,
        "AB>fail_cnt/warn_cnt/tol_cnt" TEXT,
        "AB>total_cnt/zero_cnt/infnan_cnt" TEXT,
        "AB>mae" TEXT,
        "AB>mae_top8" TEXT,
        "AB>mae_top1permil" TEXT,
        "AB>mre" TEXT,
        "AB>mre_top8" TEXT,
        "AB>mre_top1permil" TEXT,
        "A>max" TEXT,
        "A>min" TEXT,
        "A>avg" TEXT,
        "A>aavg" TEXT,
        "A>zero" TEXT,
        "A>infnan" TEXT,
        "B>max" TEXT,
        "B>min" TEXT,
        "B>avg" TEXT,
        "B>aavg" TEXT,
        "B>zero" TEXT,
        "B>infnan" TEXT,
        PRIMARY KEY ("NO.", "sourceFileName")
      );
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS accuracy_tool_task_result_detail (
        "sourceFileName" TEXT,
        "GROUP" TEXT,
        "INDEX" TEXT,
        "OFFSET" TEXT,
        "OFFSET_RAW" TEXT,
        "A>data" TEXT,
        "B>data" TEXT,
        "AB>ae" TEXT,
        "AB>re" TEXT,
        "AB>tol" TEXT,
        PRIMARY KEY (sourceFileName, "INDEX")
      );
    `);

    // 初始化子模块
    this.comGraph = new ComGraphCache(this.db);
    this.accuracy = new AccuracyCache(this.db);
  }

  // === 生命周期 ===
  public async comGraphDataDelete(fsPath: string) {
    this.comGraph.layoutDel(fsPath);
    this.comGraph.finalResultDel(fsPath);
    this.comGraph.funcDataDel(fsPath);
    this.comGraph.fileHashMapDel(fsPath);
  }

  public async save() {
    if (!this.db) {
      return;
    }
    const data = this.db.export();
    await vscode.workspace.fs.writeFile(vscode.Uri.file(this.dbFile), data);
  }

  public async clearCache(): Promise<void> {
    this.dispose();
    const bigDataDir = path.join(path.dirname(this.dbFile), 'bigData');
    await vscode.workspace.fs.delete(vscode.Uri.file(bigDataDir), { recursive: true, useTrash: false });
    if (existsSync(this.dbFile)) {
      await vscode.workspace.fs.delete(vscode.Uri.file(this.dbFile));
    }
    await this.open();
  }

  public async deleteForCommand() {
    await this.clearCache();
  }

  public async createBigDataFile(hash: string, data: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 12).replace(/-/g, '');
    const fileName = `${dateStr}_${hash}.json`;
    const bigDataDir = path.join(path.dirname(this.dbFile), 'bigData');
    const bigDataFilePath = path.join(bigDataDir, fileName);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(bigDataDir));
    await vscode.workspace.fs.writeFile(vscode.Uri.file(bigDataFilePath), Buffer.from(data, 'utf8'));
    return bigDataFilePath;
  }

  public async readJsonFile(path: string): Promise<string> {
    return await fs.readFile(path, 'utf8');
  }

  public dispose() {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }

  // === ComGraph 委托方法（15 个） ===
  public async comGraphLayoutSet(...args: Parameters<ComGraphCache['layoutSet']>) {
    return this.comGraph.layoutSet(...args);
  }
  public async comGraphLayoutGet(...args: Parameters<ComGraphCache['layoutGet']>) {
    return this.comGraph.layoutGet(...args);
  }
  public async comGraphLayoutDel(...args: Parameters<ComGraphCache['layoutDel']>) {
    return this.comGraph.layoutDel(...args);
  }
  public async comGraphFinalResultSet(...args: Parameters<ComGraphCache['finalResultSet']>) {
    return this.comGraph.finalResultSet(...args);
  }
  public async comGraphFinalResultGet(...args: Parameters<ComGraphCache['finalResultGet']>) {
    return this.comGraph.finalResultGet(...args);
  }
  public async comGraphFinalResultDel(...args: Parameters<ComGraphCache['finalResultDel']>) {
    return this.comGraph.finalResultDel(...args);
  }
  public async comGraphFuncDataSet(...args: Parameters<ComGraphCache['funcDataSet']>) {
    return this.comGraph.funcDataSet(...args);
  }
  public async comGraphFuncDataGetCount(...args: Parameters<ComGraphCache['funcDataGetCount']>) {
    return this.comGraph.funcDataGetCount(...args);
  }
  public async comGraphFuncDataGet(...args: Parameters<ComGraphCache['funcDataGet']>) {
    return this.comGraph.funcDataGet(...args);
  }
  public async comGraphFuncDataDel(...args: Parameters<ComGraphCache['funcDataDel']>) {
    return this.comGraph.funcDataDel(...args);
  }
  public async comGraphFileHashMapSet(...args: Parameters<ComGraphCache['fileHashMapSet']>) {
    return this.comGraph.fileHashMapSet(...args);
  }
  public async comGraphFileHashMapGet(...args: Parameters<ComGraphCache['fileHashMapGet']>) {
    return this.comGraph.fileHashMapGet(...args);
  }
  public async comGraphFileHashMapDel(...args: Parameters<ComGraphCache['fileHashMapDel']>) {
    return this.comGraph.fileHashMapDel(...args);
  }
  public async comGraphFileCalleeOpAttrSet(...args: Parameters<ComGraphCache['fileCalleeOpAttrSet']>) {
    return this.comGraph.fileCalleeOpAttrSet(...args);
  }
  public async comGraphFileCalleeOpAttrGet(...args: Parameters<ComGraphCache['fileCalleeOpAttrGet']>) {
    return this.comGraph.fileCalleeOpAttrGet(...args);
  }

  // === Accuracy 委托方法（24 个） ===
  public async accuracyToolSet(...args: Parameters<AccuracyCache['toolSet']>) {
    return this.accuracy.toolSet(...args);
  }
  public async accuracyToolGet(...args: Parameters<AccuracyCache['toolGet']>) {
    return this.accuracy.toolGet(...args);
  }
  public async accuracyToolGetAll(...args: Parameters<AccuracyCache['toolGetAll']>) {
    return this.accuracy.toolGetAll(...args);
  }
  public async getAccuracyStatsByFile(...args: Parameters<AccuracyCache['getStatsByFile']>) {
    return this.accuracy.getStatsByFile(...args);
  }
  public async getPhaseStatusListByFunc(...args: Parameters<AccuracyCache['getPhaseStatusListByFunc']>) {
    return this.accuracy.getPhaseStatusListByFunc(...args);
  }
  public async getDistinctPhaseResults(...args: Parameters<AccuracyCache['getDistinctPhaseResults']>) {
    return this.accuracy.getDistinctPhaseResults(...args);
  }
  public async getFirstResByPhaseOnTimestamp(...args: Parameters<AccuracyCache['getFirstResByPhaseOnTimestamp']>) {
    return this.accuracy.getFirstResByPhaseOnTimestamp(...args);
  }
  public async getFirstFailByPhase(...args: Parameters<AccuracyCache['getFirstFailByPhase']>) {
    return this.accuracy.getFirstFailByPhase(...args);
  }
  public async getAccuracyStatsByFunc(...args: Parameters<AccuracyCache['getStatsByFunc']>) {
    return this.accuracy.getStatsByFunc(...args);
  }
  public async getErrorDetailsByFunc(...args: Parameters<AccuracyCache['getErrorDetailsByFunc']>) {
    return this.accuracy.getErrorDetailsByFunc(...args);
  }
  public async getErrorDetailsOfGraphByFunc(...args: Parameters<AccuracyCache['getErrorDetailsOfGraphByFunc']>) {
    return this.accuracy.getErrorDetailsOfGraphByFunc(...args);
  }
  public async getErrorListByPage(...args: Parameters<AccuracyCache['getErrorListByPage']>) {
    return this.accuracy.getErrorListByPage(...args);
  }
  public async accuracyToolCmpSet(...args: Parameters<AccuracyCache['cmpSet']>) {
    return this.accuracy.cmpSet(...args);
  }
  public async getCmpErrorListByFilePath(...args: Parameters<AccuracyCache['getCmpErrorListByFilePath']>) {
    return this.accuracy.getCmpErrorListByFilePath(...args);
  }
  public async accuracyToolCmpGetByFilePath(...args: Parameters<AccuracyCache['cmpGetByFilePath']>) {
    return this.accuracy.cmpGetByFilePath(...args);
  }
  public async accuracyToolCmpGetCountByFilePath(...args: Parameters<AccuracyCache['cmpGetCountByFilePath']>) {
    return this.accuracy.cmpGetCountByFilePath(...args);
  }
  public async accuracyToolCmpDetailSet(...args: Parameters<AccuracyCache['cmpDetailSet']>) {
    return this.accuracy.cmpDetailSet(...args);
  }
  public async accuracyToolCmpDetailGetByFilePath(...args: Parameters<AccuracyCache['cmpDetailGetByFilePath']>) {
    return this.accuracy.cmpDetailGetByFilePath(...args);
  }
  public async accuracyToolCompListSet(...args: Parameters<AccuracyCache['compListSet']>) {
    return this.accuracy.compListSet(...args);
  }
  public async accuracyToolCompListGetByComputePath(...args: Parameters<AccuracyCache['compListGetByComputePath']>) {
    return this.accuracy.compListGetByComputePath(...args);
  }
  public async accuracyToolCompListGetByFilePath(...args: Parameters<AccuracyCache['compListGetByFilePath']>) {
    return this.accuracy.compListGetByFilePath(...args);
  }
  public async accuracyToolCompListUpdateFirstReq(...args: Parameters<AccuracyCache['compListUpdateFirstReq']>) {
    return this.accuracy.compListUpdateFirstReq(...args);
  }
  public async accuFilePathSet(...args: Parameters<AccuracyCache['filePathSet']>) {
    return this.accuracy.filePathSet(...args);
  }
  public async accuFilePathGet(...args: Parameters<AccuracyCache['filePathGet']>) {
    return this.accuracy.filePathGet(...args);
  }

  // === Task-level Accuracy 方法（remote 新增，AccuracyCache 无对应委托，保留直接实现） ===
  public async accuracyToolTaskCmpSet(data: AccuracyToolTaskCmpData): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO accuracy_tool_task_cmp (
        "sourceFileName", "NO.", "A>PHASE_NAME", "IO_FLAG", "LOOP_INFO",
        "ROOT_CALL:opmagic", "ROOT_CALL:rawmagic", "B>FILENAME",
        "A>:datatype", "A>:format", "A>:magic", "A>:opcode", "A>:opmagic", "A>:rawmagic", "A>:symbol",
        "A>:validshape", "A>EVAL:dynvalidshape", "A>OP_ATTR_ATOMIC", "A>OP_ATTR_SYM_OFFSET",
        "FUNC:hash", "PATH_FUNC:hash", "ROOT_FUNC:hash",
        "B>:datatype", "B>:rawShape", "B>:validshape", "B>blockIdx", "B>OP_ATTR_SYM_OFFSET",
        "B>seqNo", "B>taskId", "B>tensorAddr", "B>TIMESTAMP", "B>EXEC_TIMESTAMP",
        "AB>RESULT", "AB>rtol/atol",
        "AB>fail_cnt/warn_cnt/tol_cnt", "AB>total_cnt/zero_cnt/infnan_cnt",
        "AB>mae", "AB>mae_top8", "AB>mae_top1permil", "AB>mre", "AB>mre_top8",
        "AB>mre_top1permil", "A>max", "A>min", "A>avg", "A>aavg", "A>zero",
        "A>infnan", "B>max", "B>min", "B>avg", "B>aavg", "B>zero", "B>infnan"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    this.db!.run(sql, extractParams(TASK_CMP_FIELDS, data));
  }

  public async accuracyToolTaskCmpGetByFileName(
    sourceFileName: string,
    pageSize: number,
    startOffset: number,
    res?: string,
    keyword?: string,
    funcHash?: string,
    filterWord?: TaskCmpFilterWord,
    rootFuncHash?: string,
    oriLoopInfo?: string,
    pathFunchash?: string,
  ): Promise<AccuracyToolTaskCmpData[]> {
    const conditions: string[] = ['"sourceFileName" = ?'];
    const params: any[] = [sourceFileName];
    if (res) {
      conditions.push('"AB>RESULT" = ?');
      params.push(res);
    }
    if (keyword) {
      conditions.push('("LOOP_INFO" LIKE ? OR "B>:datatype" LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (funcHash) {
      conditions.push('"FUNC:hash" = ?');
      params.push(funcHash);
    }
    if (rootFuncHash) {
      conditions.push('"ROOT_FUNC:hash" = ?');
      params.push(rootFuncHash);
    }
    if (pathFunchash) {
      conditions.push('"PATH_FUNC:hash" LIKE ?');
      params.push(`%${pathFunchash}%`);
    }
    if (filterWord) {
      if (filterWord.rawMagic) {
        conditions.push('"ROOT_CALL:rawmagic" LIKE ?');
        params.push(`%${filterWord.rawMagic}%`);
      }
      if (filterWord.opMagic) {
        conditions.push('"ROOT_CALL:opmagic" LIKE ?');
        params.push(`%${filterWord.opMagic}%`);
      }
      if (filterWord.tensorAddr) {
        conditions.push('"B>tensorAddr" LIKE ?');
        params.push(`%${filterWord.tensorAddr}%`);
      }
      if (filterWord.symbol) {
        conditions.push('"A>:symbol" LIKE ?');
        params.push(`%${filterWord.symbol}%`);
      }
      if (filterWord.funchash) {
        conditions.push('"FUNC:hash" LIKE ?');
        params.push(`%${filterWord.funchash}%`);
      }
    }
    if (oriLoopInfo) {
      conditions.push('"LOOP_INFO" = ?');
      params.push(oriLoopInfo);
    }
    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        "NO." AS no, "A>PHASE_NAME" AS phaseName, "IO_FLAG" AS ioFlag, "LOOP_INFO" AS loopInfo,
        "ROOT_CALL:opmagic" AS rootCallOpmagic, "ROOT_CALL:rawmagic" AS rootCallRawmagic,
        "B>FILENAME" AS fileName,
        "A>PHASE_NAME" AS aPhaseName, "A>:datatype" AS aDatatype, "A>:format" AS aFormat,
        "A>:magic" AS aMagic, "A>:opcode" AS aOpcode, "A>:opmagic" AS aOpMagic, "A>:rawmagic" AS aRawMagic,
        "A>:symbol" AS aSymbol, "A>:validshape" AS aValidshape,
        "A>EVAL:dynvalidshape" AS aDynvalidshape,
        "A>OP_ATTR_ATOMIC" AS aOpAttrAtomic, "A>OP_ATTR_SYM_OFFSET" AS aOpAttrSymOfst,
        "FUNC:hash" AS aFuncHash, "PATH_FUNC:hash" AS aPathHash, "ROOT_FUNC:hash" AS aRootFuncHash,
        "B>:datatype" AS bDataType, "B>:rawShape" AS bRawShape, "B>:validshape" AS bValidShape,
        "B>blockIdx" AS bBlockIdx, "B>OP_ATTR_SYM_OFFSET" AS bOpAttrSymOfst,
        "B>seqNo" AS bSeqNo, "B>taskId" AS bTaskId, "B>tensorAddr" AS bTensorAddr,
        "B>TIMESTAMP" AS bTimestamp, "B>EXEC_TIMESTAMP" AS bExecTimestamp,
        "AB>RESULT" AS result,
        "AB>rtol/atol" AS rtolAtol, "AB>fail_cnt/warn_cnt/tol_cnt" AS cntFailWarnTol,
        "AB>total_cnt/zero_cnt/infnan_cnt" AS cntTotalZeroInfnanCnt, "AB>mae" AS mae,
        "AB>mae_top8" AS maeTop8, "AB>mae_top1permil" AS maeTop1permil, "AB>mre" AS mre,
        "AB>mre_top8" AS mreTop8, "AB>mre_top1permil" AS mreTop1permil, "A>max" AS aMax,
        "A>min" AS aMin, "A>avg" AS aAvg, "A>aavg" AS aAavg, "A>zero" AS aZero, "A>infnan" AS aInfnan,
        "B>max" AS bMax, "B>min" AS bMin, "B>avg" AS bAvg, "B>aavg" AS bAavg, "B>zero" AS bZero,
        "B>infnan" AS bInfnan
      FROM accuracy_tool_task_cmp
      WHERE ${whereClause}
      ORDER BY "B>EXEC_TIMESTAMP" ASC, "B>TIMESTAMP" ASC, "A>:rawmagic" ASC, "B>OP_ATTR_SYM_OFFSET" ASC
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, startOffset);
    const stmt = this.db!.prepare(sql);
    const result: AccuracyToolTaskCmpData[] = [];
    try {
      stmt.bind(params);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          no: row.no as string,
          phaseName: row.phaseName as string,
          ioFlag: row.ioFlag as string,
          loopInfo: row.loopInfo as string,
          rootCallOpmagic: row.rootCallOpmagic as string,
          rootCallRawmagic: row.rootCallRawmagic as string,
          fileName: row.fileName as string,
          aPhaseName: row.aPhaseName as string,
          aDatatype: row.aDatatype as string,
          aFormat: row.aFormat as string,
          aMagic: row.aMagic as string,
          aOpcode: row.aOpcode as string,
          aRawMagic: row.aRawMagic as string,
          aOpMagic: row.aOpMagic as string,
          aSymbol: row.aSymbol as string,
          aValidshape: row.aValidshape as string,
          aDynvalidshape: row.aDynvalidshape as string,
          aOpAttrAtomic: row.aOpAttrAtomic as string,
          aOpAttrSymOfst: row.aOpAttrSymOfst as string,
          aFuncHash: row.aFuncHash as string,
          aPathHash: row.aPathHash as string,
          aRootFuncHash: row.aRootFuncHash as string,
          bDataType: row.bDataType as string,
          bRawShape: row.bRawShape as string,
          bValidShape: row.bValidShape as string,
          bBlockIdx: row.bBlockIdx as string,
          bOpAttrSymOfst: row.bOpAttrSymOfst as string,
          bSeqNo: row.bSeqNo as string,
          bTaskId: row.bTaskId as string,
          bTensorAddr: row.bTensorAddr as string,
          bTimestamp: row.bTimestamp as string,
          bExecTimestamp: row.bExecTimestamp as string,
          result: row.result as string,
          rtolAtol: row.rtolAtol as string,
          cntFailWarnTol: row.cntFailWarnTol as string,
          cntTotalZeroInfnanCnt: row.cntTotalZeroInfnanCnt as string,
          mae: row.mae as string,
          maeTop8: row.maeTop8 as string,
          maeTop1permil: row.maeTop1permil as string,
          mre: row.mre as string,
          mreTop8: row.mreTop8 as string,
          mreTop1permil: row.mreTop1permil as string,
          aMax: row.aMax as string,
          aMin: row.aMin as string,
          aAvg: row.aAvg as string,
          aAavg: row.aAavg as string,
          aZero: row.aZero as string,
          aInfnan: row.aInfnan as string,
          bMax: row.bMax as string,
          bMin: row.bMin as string,
          bAvg: row.bAvg as string,
          bAavg: row.bAavg as string,
          bZero: row.bZero as string,
          bInfnan: row.bInfnan as string,
        });
      }
    } finally {
      stmt.free();
    }
    return result;
  }

  public async accuracyToolTaskCmpGetCountByFileName(
    sourceFileName: string,
    res?: string,
    keyword?: string,
    phaseName?: string,
    funcHash?: string,
    filterWord?: TaskCmpFilterWord,
    rootFuncHash?: string,
    oriLoopInfo?: string,
    pathFunchash?: string,
  ): Promise<number> {
    const conditions: string[] = ['"sourceFileName" = ?'];
    const params: any[] = [sourceFileName];
    if (res) {
      conditions.push('"AB>RESULT" = ?');
      params.push(res);
    }
    if (keyword) {
      conditions.push('("LOOP_INFO" LIKE ? OR "B>:datatype" LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (phaseName && funcHash) {
      conditions.push('("A>PHASE_NAME" = ? AND "FUNC:hash" = ?)');
      params.push(phaseName, funcHash);
    } else if (phaseName) {
      conditions.push('"A>PHASE_NAME" = ?');
      params.push(phaseName);
    } else if (funcHash) {
      conditions.push('"FUNC:hash" = ?');
      params.push(funcHash);
    }
    if (rootFuncHash) {
      conditions.push('"ROOT_FUNC:hash" = ?');
      params.push(rootFuncHash);
    }
    if (pathFunchash) {
      conditions.push('"PATH_FUNC:hash" LIKE ?');
      params.push(`%${pathFunchash}%`);
    }
    if (filterWord) {
      if (filterWord.rawMagic) {
        conditions.push('"ROOT_CALL:rawmagic" LIKE ?');
        params.push(`%${filterWord.rawMagic}%`);
      }
      if (filterWord.opMagic) {
        conditions.push('"ROOT_CALL:opmagic" LIKE ?');
        params.push(`%${filterWord.opMagic}%`);
      }
      if (filterWord.tensorAddr) {
        conditions.push('"B>tensorAddr" LIKE ?');
        params.push(`%${filterWord.tensorAddr}%`);
      }
      if (filterWord.symbol) {
        conditions.push('"A>:symbol" LIKE ?');
        params.push(`%${filterWord.symbol}%`);
      }
      if (filterWord.funchash) {
        conditions.push('"FUNC:hash" LIKE ?');
        params.push(`%${filterWord.funchash}%`);
      }
    }
    if (oriLoopInfo) {
      conditions.push('"LOOP_INFO" = ?');
      params.push(oriLoopInfo);
    }
    const whereClause = conditions.join(' AND ');

    const sql = `SELECT COUNT(*) as total FROM accuracy_tool_task_cmp WHERE ${whereClause}`;
    const stmt = this.db!.prepare(sql);
    stmt.bind(params);

    try {
      if (stmt.step()) {
        const row = stmt.getAsObject();
        return row.total as number;
      }
      return 0;
    } finally {
      stmt.free();
    }
  }

  public async accuracyToolTaskDetailSet(data: AccuracyToolTaskDetailData): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO accuracy_tool_task_result_detail (
        "sourceFileName", "GROUP", "INDEX", "OFFSET", "OFFSET_RAW",
        "A>data", "B>data", "AB>ae", "AB>re", "AB>tol"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.sourceFileName ?? '',
      data.group ?? '',
      data.index ?? '',
      data.offset ?? '',
      data.offsetRaw ?? '',
      data.aData ?? '',
      data.bData ?? '',
      data.ae ?? '',
      data.re ?? '',
      data.tol ?? '',
    ];
    this.db!.run(sql, params);
  }

  public async accuracyToolTaskDetailGet(sourceFileName: string): Promise<AccuracyToolTaskDetailData[]> {
    const sql = `
      SELECT
        "GROUP" AS "group", "INDEX" AS "index", "OFFSET" AS "offset", "OFFSET_RAW" AS "offsetRaw",
        "A>data" AS "aData", "B>data" AS "bData", "AB>ae" AS "ae", "AB>re" AS "re", "AB>tol" AS "tol"
      FROM accuracy_tool_task_result_detail
      WHERE "sourceFileName" = ?
    `;

    const stmt = this.db!.prepare(sql);
    const result: AccuracyToolTaskDetailData[] = [];

    try {
      stmt.bind([sourceFileName]);
      while (stmt.step()) {
        const row = stmt.getAsObject() as any;
        result.push({
          group: row.group,
          index: row.index,
          offset: row.offset,
          offsetRaw: row.offsetRaw,
          aData: row.aData,
          bData: row.bData,
          ae: row.ae,
          re: row.re,
          tol: row.tol,
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }
}
