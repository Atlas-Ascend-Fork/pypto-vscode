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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Database } from 'sql.js';
import { queryAll, queryOne, queryCount } from './cache-query-helper';
import type {
  AccuracyToolData,
  AccuracyToolCmpData,
  AccuracyToolCmpDetailData,
  AccuracyToolCompList,
  accuFilePathData,
  PaginatedResult,
} from './cache-types';
import { ACCURACY_TOOL_FIELDS, ACCURACY_TOOL_CMP_FIELDS, extractParams } from './cache-field-maps';

// ============================================================
// SQL SELECT column constants
// ============================================================

const ACCURACY_TOOL_SELECT_COLUMNS = `
  file_path,
  "NO." AS no,
  "B>PHASE_NAME" AS phaseName,
  "PATH_FUNC:func_magicname" AS funcMagicName,
  "B>:rawmagic" AS rawMagic,
  "AB>RESULT" AS result,
  ":datatype" AS dataType,
  ":validshape" AS validShape,
  "LOOP_INFO" AS loopInfo,
  "AB>rtol/atol" AS rtolAtol,
  "AB>fail_cnt/warn_cnt/tol_cnt" AS cntFailWarnTol,
  "AB>total_cnt/zero_cnt/infnan_cnt" AS cntTotalZeroInfnanCnt,
  "AB>mre" AS mre,
  "AB>mre_top1permil" AS mreTop1permil,
  "AB>mre_top8" AS mreTop8,
  "AB>mae" AS mae,
  "AB>mae_top8" AS maeTop8,
  "AB>mae_top1permil" AS maeTop1permil,
  "A>max" AS aMax,
  "A>min" AS aMin,
  "A>avg" AS aAvg,
  "A>aavg" AS aAavg,
  "A>zero" AS aZero,
  "A>infnan" AS aInfnan,
  "B>max" AS bMax,
  "B>min" AS bMin,
  "B>avg" AS bAvg,
  "B>aavg" AS bAavg,
  "B>zero" AS bZero,
  "B>infnan" AS bInfnan,
  "B>TIMESTAMP" AS bTimestamp
`;

const ACCURACY_TOOL_CMP_SELECT_COLUMNS = `
  file_path,
  "NO." AS no,
  "PATH_FUNC:func_magicname" AS pathFuncMagicName,
  "LOOP_INFO" AS loopInfo,
  ":symbol" AS symbol,
  ":validshape" AS validShape,
  ":datatype" AS dataType,
  "OP_ATTR_SYM_OFFSET" AS opAttrSymOffset,
  "A>:opmagic" AS aOpMagic,
  "B>PHASE_NAME" AS bPhaseName,
  "A>PHASE_NAME" AS aPhaseName,
  "A>:opcode" AS aOpcode,
  "A>:rawshape" AS aRawShape,
  "A>:shape" AS aShape,
  "A>:format" AS aFormat,
  "A>FUNC:funcmagic" AS aFuncMagic,
  "A>FUNC:hash" AS aFuncHash,
  "A>ROOT_FUNC:hash" AS aRootFuncHash,
  "A>FILENAME" AS aFileName,
  "A>max" AS aMax,
  "A>min" AS aMin,
  "A>avg" AS aAvg,
  "A>aavg" AS aAavg,
  "A>zero" AS aZero,
  "A>infnan" AS aInfnan,
  "B>:opmagic" AS bOpMagic,
  "B>:opcode" AS bOpcode,
  "B>:rawshape" AS bRawShape,
  "B>:shape" AS bShape,
  "B>:format" AS bFormat,
  "B>FUNC:funcmagic" AS bFuncMagic,
  "B>FUNC:hash" AS bFuncHash,
  "B>ROOT_FUNC:hash" AS bRootFuncHash,
  "B>FILENAME" AS bFileName,
  "B>max" AS bMax,
  "B>min" AS bMin,
  "B>avg" AS bAvg,
  "B>aavg" AS bAavg,
  "B>zero" AS bZero,
  "B>infnan" AS bInfnan,
  "AB>RESULT" AS abResult,
  "AB>rtol/atol" AS abRtolAtol,
  "AB>fail_cnt/warn_cnt/tol_cnt" AS abFailWarnTol,
  "AB>total_cnt/zero_cnt/infnan_cnt" AS abTotalZeroInfnanCnt,
  "AB>mre" AS abMre,
  "AB>mre_top8" AS abMreTop8,
  "AB>mre_top1permil" AS abMreTop1permil,
  "AB>mae" AS abMae,
  "AB>mae_top8" AS abMaeTop8,
  "AB>mae_top1permil" AS abMaeTop1permil,
  "B>TIMESTAMP" AS bTimestamp
`;

// ============================================================
// Row mapper functions
// ============================================================

function mapAccuracyToolRow(row: Record<string, unknown>): AccuracyToolData {
  return {
    filePath: row.file_path as string,
    no: row.no as string,
    phaseName: row.phaseName as string,
    funcMagicName: row.funcMagicName as string,
    rawMagic: row.rawMagic as string,
    result: row.result as string,
    dataType: row.dataType as string,
    validShape: row.validShape as string,
    loopInfo: row.loopInfo as string,
    rtolAtol: row.rtolAtol as string,
    cntFailWarnTol: row.cntFailWarnTol as string,
    cntTotalZeroInfnanCnt: row.cntTotalZeroInfnanCnt as string,
    mre: row.mre as string,
    mreTop1permil: row.mreTop1permil as string,
    mreTop8: row.mreTop8 as string,
    mae: row.mae as string,
    maeTop8: row.maeTop8 as string,
    maeTop1permil: row.maeTop1permil as string,
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
    bTimestamp: row.bTimestamp as string,
  };
}

function mapAccuracyToolCmpRow(row: Record<string, unknown>): AccuracyToolCmpData {
  return {
    filePath: row.file_path as string,
    no: row.no as string,
    pathFuncMagicName: row.pathFuncMagicName as string,
    loopInfo: row.loopInfo as string,
    symbol: row.symbol as string,
    validShape: row.validShape as string,
    dataType: row.dataType as string,
    opAttrSymOffset: row.opAttrSymOffset as string,
    aOpMagic: row.aOpMagic as string,
    bPhaseName: row.bPhaseName as string,
    aPhaseName: row.aPhaseName as string,
    aOpcode: row.aOpcode as string,
    aRawShape: row.aRawShape as string,
    aShape: row.aShape as string,
    aFormat: row.aFormat as string,
    aFuncMagic: row.aFuncMagic as string,
    aFuncHash: row.aFuncHash as string,
    aRootFuncHash: row.aRootFuncHash as string,
    aFileName: row.aFileName as string,
    aMax: row.aMax as string,
    aMin: row.aMin as string,
    aAvg: row.aAvg as string,
    aAavg: row.aAavg as string,
    aZero: row.aZero as string,
    aInfnan: row.aInfnan as string,
    bOpMagic: row.bOpMagic as string,
    bOpcode: row.bOpcode as string,
    bRawShape: row.bRawShape as string,
    bShape: row.bShape as string,
    bFormat: row.bFormat as string,
    bFuncMagic: row.bFuncMagic as string,
    bFuncHash: row.bFuncHash as string,
    bRootFuncHash: row.bRootFuncHash as string,
    bFileName: row.bFileName as string,
    bMax: row.bMax as string,
    bMin: row.bMin as string,
    bAvg: row.bAvg as string,
    bAavg: row.bAavg as string,
    bZero: row.bZero as string,
    bInfnan: row.bInfnan as string,
    abResult: row.abResult as string,
    abRtolAtol: row.abRtolAtol as string,
    abFailWarnTol: row.abFailWarnTol as string,
    abTotalZeroInfnanCnt: row.abTotalZeroInfnanCnt as string,
    abMre: row.abMre as string,
    abMreTop8: row.abMreTop8 as string,
    abMreTop1permil: row.abMreTop1permil as string,
    abMae: row.abMae as string,
    abMaeTop8: row.abMaeTop8 as string,
    abMaeTop1permil: row.abMaeTop1permil as string,
    bTimestamp: row.bTimestamp as string,
  };
}

function mapAccuracyToolCmpDetailRow(row: Record<string, unknown>): AccuracyToolCmpDetailData {
  return {
    filePath: row.file_path as string,
    group: row.group as string,
    index: row.index as string,
    offset: row.offset as string,
    offsetRaw: row.offsetRaw as string,
    aData: row.aData as string,
    bData: row.bData as string,
    abAe: row.abAe as string,
    abRe: row.abRe as string,
    abTol: row.abTol as string,
  };
}

// ============================================================
// AccuracyCache class
// ============================================================

export class AccuracyCache {
  constructor(private readonly db: Database) {}

  // ============================================================
  // accuracy_tool table methods
  // ============================================================

  /**
   * Insert or replace a row in accuracy_tool table.
   */
  async toolSet(data: AccuracyToolData): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO accuracy_tool (
        file_path,
        "NO.",
        "B>PHASE_NAME",
        "PATH_FUNC:func_magicname",
        "B>:rawmagic",
        "AB>RESULT",
        ":datatype",
        ":validshape",
        "LOOP_INFO",
        "AB>rtol/atol",
        "AB>fail_cnt/warn_cnt/tol_cnt",
        "AB>total_cnt/zero_cnt/infnan_cnt",
        "AB>mre",
        "AB>mre_top1permil",
        "AB>mre_top8",
        "AB>mae",
        "AB>mae_top8",
        "AB>mae_top1permil",
        "A>max",
        "A>min",
        "A>avg",
        "A>aavg",
        "A>zero",
        "A>infnan",
        "B>max",
        "B>min",
        "B>avg",
        "B>aavg",
        "B>zero",
        "B>infnan",
        "B>TIMESTAMP"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    this.db.run(sql, extractParams(ACCURACY_TOOL_FIELDS, data));
  }

  /**
   * Query a single row from accuracy_tool by composite key.
   */
  async toolGet(
    filePath: string,
    phaseName: string,
    funcMagicName: string,
    rawMagic: string,
  ): Promise<AccuracyToolData | undefined> {
    const sql = `
      SELECT ${ACCURACY_TOOL_SELECT_COLUMNS}
      FROM accuracy_tool
      WHERE
        file_path = ? AND
        "B>PHASE_NAME" = ? AND
        "PATH_FUNC:func_magicname" = ? AND
        "B>:rawmagic" = ?
    `;
    return queryOne(this.db, sql, [filePath, phaseName, funcMagicName, rawMagic], mapAccuracyToolRow);
  }

  /**
   * Query all rows from accuracy_tool.
   */
  async toolGetAll(): Promise<AccuracyToolData[]> {
    const sql = `SELECT ${ACCURACY_TOOL_SELECT_COLUMNS} FROM accuracy_tool`;
    return queryAll(this.db, sql, [], mapAccuracyToolRow);
  }

  /**
   * Get accuracy stats by file path using CTE query.
   * Returns Record<string, number> keyed by finalResult.
   */
  async getStatsByFile(filePath: string): Promise<Record<string, number>> {
    const sql = `
      WITH PhaseFlags AS (
        SELECT
          "B>PHASE_NAME",
          SUM(CASE WHEN "AB>RESULT" = 'EXCEPTION' THEN 1 ELSE 0 END) > 0 AS has_exception,
          SUM(CASE WHEN "AB>RESULT" = 'FAIL' THEN 1 ELSE 0 END) > 0 AS has_fail,
          SUM(CASE WHEN "AB>RESULT" = 'PASS' THEN 1 ELSE 0 END) > 0 AS has_pass
        FROM accuracy_tool
        WHERE
          file_path = ? AND
          "B>PHASE_NAME" LIKE 'Pass_%'
        GROUP BY "B>PHASE_NAME"
      ),
      PhaseStatus AS (
        SELECT
          "B>PHASE_NAME",
          CASE
            WHEN has_exception AND has_fail THEN 'FAIL_AND_EXCEPTION'
            WHEN has_exception THEN 'EXCEPTION'
            WHEN has_fail THEN 'FAIL'
            WHEN has_pass THEN 'PASS'
            ELSE 'SKIP'
          END AS finalResult
        FROM PhaseFlags
      )
      SELECT finalResult, COUNT(*) as count
      FROM PhaseStatus
      GROUP BY finalResult
    `;

    const stmt = this.db.prepare(sql);
    const stats: Record<string, number> = {};
    try {
      stmt.bind([filePath]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row.finalResult) {
          stats[row.finalResult as string] = row.count as number;
        }
      }
    } finally {
      stmt.free();
    }
    return stats;
  }

  /**
   * Get phase status list by function.
   * Returns array of { phaseName, status[] } grouped and sorted by priority.
   */
  async getPhaseStatusListByFunc(
    filePath: string,
    funcMagicName: string,
  ): Promise<{ phaseName: string; status: string[] }[]> {
    const sql = `
      SELECT DISTINCT
        "B>PHASE_NAME" AS phaseName,
        "AB>RESULT" AS result
      FROM accuracy_tool
      WHERE
        file_path = ? AND
        "PATH_FUNC:func_magicname" = ?
      ORDER BY "B>PHASE_NAME", "AB>RESULT"
    `;

    const stmt = this.db.prepare(sql);
    const resultMap: Map<string, string[]> = new Map();
    try {
      stmt.bind([filePath, funcMagicName]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        const phaseName = row.phaseName as string;
        const result = row.result as string;
        if (!resultMap.has(phaseName)) {
          resultMap.set(phaseName, []);
        }
        resultMap.get(phaseName)!.push(result);
      }
    } finally {
      stmt.free();
    }

    const priorityOrder = ['EXCEPTION', 'FAIL', 'PASS', 'SKIP'];
    const finalResult: { phaseName: string; status: string[] }[] = [];
    for (const [phaseName, results] of resultMap) {
      const uniqueResults = [...new Set(results)];
      uniqueResults.sort((a, b) => {
        const aIdx = priorityOrder.indexOf(a);
        const bIdx = priorityOrder.indexOf(b);
        return aIdx - bIdx;
      });
      finalResult.push({ phaseName, status: uniqueResults });
    }
    return finalResult;
  }

  /**
   * Get distinct phase results for a file.
   */
  async getDistinctPhaseResults(filePath: string): Promise<{ phaseName: string; result: string }[]> {
    const sql = `
      SELECT DISTINCT
        "B>PHASE_NAME" AS phaseName,
        "AB>RESULT" AS result
      FROM accuracy_tool
      WHERE file_path = ?
      ORDER BY "B>PHASE_NAME"
    `;

    const stmt = this.db.prepare(sql);
    const result: { phaseName: string; result: string }[] = [];
    try {
      stmt.bind([filePath]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName as string,
          result: row.result as string,
        });
      }
    } finally {
      stmt.free();
    }
    return result;
  }

  /**
   * Get first result by phase on timestamp.
   * Returns any[] to match original behavior.
   */
  async getFirstResByPhaseOnTimestamp(filePath: string, phaseName: string, resType: string): Promise<any[]> {
    const sql = `
      SELECT DISTINCT
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "AB>RESULT" AS result,
        "B>TIMESTAMP" AS bTimestamp
      FROM accuracy_tool
      WHERE file_path = ?
        AND "B>PHASE_NAME" = ?
        AND "AB>RESULT" = ?
        AND "B>TIMESTAMP" IN (
          SELECT MIN("B>TIMESTAMP")
          FROM accuracy_tool
          WHERE file_path = ?
            AND "B>PHASE_NAME" = ?
            AND "AB>RESULT" = ?
          GROUP BY "PATH_FUNC:func_magicname"
        )
      ORDER BY "B>TIMESTAMP", "PATH_FUNC:func_magicname" ASC
    `;

    const stmt = this.db.prepare(sql);
    const result: any[] = [];
    try {
      stmt.bind([filePath, phaseName, resType, filePath, phaseName, resType]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName,
          funcMagicName: row.funcMagicName,
          rawMagic: row.rawMagic,
          result: row.result,
          timestamp: row.bTimestamp,
        });
      }
    } finally {
      stmt.free();
    }
    return result;
  }

  /**
   * Get first fail by phase.
   * Returns any[] to match original behavior.
   */
  async getFirstFailByPhase(filePath: string): Promise<any[]> {
    const sql = `
      SELECT
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "AB>RESULT" AS result
      FROM accuracy_tool
      WHERE rowid IN (
          SELECT MIN(rowid)
          FROM accuracy_tool
          WHERE file_path = ? AND "AB>RESULT" = 'FAIL'
          GROUP BY "B>PHASE_NAME"
      )
      ORDER BY "B>PHASE_NAME"
    `;

    const stmt = this.db.prepare(sql);
    const result: any[] = [];
    try {
      stmt.bind([filePath]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName,
          funcMagicName: row.funcMagicName,
          rawMagic: row.rawMagic,
          result: row.result,
        });
      }
    } finally {
      stmt.free();
    }
    return result;
  }

  /**
   * Get accuracy stats by function.
   */
  async getStatsByFunc(filePath: string, phaseName: string, funcMagicName: string): Promise<Record<string, number>> {
    const sql = `
      SELECT
        "AB>RESULT" AS resultType,
        COUNT(*) AS count
      FROM accuracy_tool
      WHERE
        file_path = ? AND
        "B>PHASE_NAME" = ? AND
        "PATH_FUNC:func_magicname" = ?
      GROUP BY "AB>RESULT"
    `;

    const stmt = this.db.prepare(sql);
    const stats: Record<string, number> = {};
    try {
      stmt.bind([filePath, phaseName, funcMagicName]);
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row.resultType) {
          stats[row.resultType as string] = row.count as number;
        }
      }
    } finally {
      stmt.free();
    }
    return stats;
  }

  /**
   * Get error details by function with pagination.
   */
  async getErrorDetailsByFunc(
    filePath: string,
    phaseName: string,
    funcMagicName: string,
    rawMagic: string,
    loopInfo: string,
    pageSize: number,
    startOffset: number,
  ): Promise<AccuracyToolData[]> {
    const sql = `
      SELECT
        file_path,
        "NO." AS no,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "B>TIMESTAMP" AS bTimestamp,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo,
        "AB>rtol/atol" AS rtolAtol,
        "AB>fail_cnt/warn_cnt/tol_cnt" AS cntFailWarnTol,
        "AB>total_cnt/zero_cnt/infnan_cnt" AS cntTotalZeroInfnanCnt,
        "AB>mre" AS mre,
        "AB>mre_top1permil" AS mreTop1permil,
        "AB>mre_top8" AS mreTop8,
        "AB>mae" AS mae,
        "AB>mae_top8" AS maeTop8,
        "AB>mae_top1permil" AS maeTop1permil,
        "A>max" AS aMax,
        "A>min" AS aMin,
        "A>avg" AS aAvg,
        "A>aavg" AS aAavg,
        "A>zero" AS aZero,
        "A>infnan" AS aInfnan,
        "B>max" AS bMax,
        "B>min" AS bMin,
        "B>avg" AS bAvg,
        "B>aavg" AS bAavg,
        "B>zero" AS bZero,
        "B>infnan" AS bInfnan
      FROM accuracy_tool
      WHERE
        file_path = ? AND
        "B>PHASE_NAME" = ? AND
        "PATH_FUNC:func_magicname" = ? AND
        "B>:rawmagic" = ? AND
        "LOOP_INFO" = ? AND
        "AB>RESULT" IN ('FAIL', 'EXCEPTION')
      ORDER BY "B>TIMESTAMP" ASC
      LIMIT ? OFFSET ?
    `;

    return queryAll(
      this.db,
      sql,
      [filePath, phaseName, funcMagicName, rawMagic, loopInfo, pageSize, startOffset],
      mapAccuracyToolRow,
    );
  }

  /**
   * Get error details of graph by function with simplified SELECT (10 fields).
   */
  async getErrorDetailsOfGraphByFunc(
    filePath: string,
    phaseName: string,
    funcMagicName: string,
    pageSize: number,
    startOffset: number,
    res: string,
  ): Promise<AccuracyToolData[]> {
    const sql = `
      SELECT
        file_path,
        "NO." AS no,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "B>TIMESTAMP" AS bTimestamp,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo
      FROM accuracy_tool
      WHERE
        file_path = ? AND
        "B>PHASE_NAME" = ? AND
        "PATH_FUNC:func_magicname" = ? AND
        "AB>RESULT" = ?
      ORDER BY "B>TIMESTAMP" ASC, CAST("NO." AS INTEGER) ASC
      LIMIT ? OFFSET ?
    `;

    return queryAll(
      this.db,
      sql,
      [filePath, phaseName, funcMagicName, res, pageSize, startOffset],
      mapAccuracyToolRow,
    );
  }

  /**
   * Get error list by page with LIKE search and pagination.
   * Returns { total, list }.
   */
  async getErrorListByPage(
    filePath: string,
    phaseName: string,
    funcMagicName: string,
    keyWord: string,
    pageSize: number,
    startOffset: number,
  ): Promise<PaginatedResult<AccuracyToolData>> {
    const countSql = `
      SELECT COUNT(*) AS total
      FROM accuracy_tool
      WHERE
        file_path = ? AND
        "B>PHASE_NAME" = ? AND
        "PATH_FUNC:func_magicname" = ? AND
        ("LOOP_INFO" LIKE ? OR ":datatype" LIKE ?) AND
        "AB>RESULT" IN ('FAIL', 'EXCEPTION')
    `;
    const dataSql = `
      SELECT
        file_path,
        "NO." AS no,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "B>TIMESTAMP" AS bTimestamp,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo
      FROM accuracy_tool
      WHERE
        file_path = ? AND
        "B>PHASE_NAME" = ? AND
        "PATH_FUNC:func_magicname" = ? AND
        ("LOOP_INFO" LIKE ? OR ":datatype" LIKE ?) AND
        "AB>RESULT" IN ('FAIL', 'EXCEPTION')
      ORDER BY "B>TIMESTAMP" ASC, CAST("NO." AS INTEGER) ASC
      LIMIT ? OFFSET ?
    `;

    const countParams = [filePath, phaseName, funcMagicName, `%${keyWord}%`, `%${keyWord}%`];
    const total = queryCount(this.db, countSql, countParams);

    const list = queryAll(
      this.db,
      dataSql,
      [...countParams, pageSize, startOffset],
      mapAccuracyToolRow,
    );

    return { total, list };
  }

  // ============================================================
  // accuracy_tool_cmp table methods
  // ============================================================

  /**
   * Insert or replace a row in accuracy_tool_cmp table.
   */
  async cmpSet(data: AccuracyToolCmpData): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO accuracy_tool_cmp (
        file_path,
        "NO.",
        "PATH_FUNC:func_magicname",
        "LOOP_INFO",
        ":symbol",
        ":validshape",
        ":datatype",
        "OP_ATTR_SYM_OFFSET",
        "A>:opmagic",
        "B>PHASE_NAME",
        "A>PHASE_NAME",
        "A>:opcode",
        "A>:rawshape",
        "A>:shape",
        "A>:format",
        "A>FUNC:funcmagic",
        "A>FUNC:hash",
        "A>ROOT_FUNC:hash",
        "A>FILENAME",
        "A>max",
        "A>min",
        "A>avg",
        "A>aavg",
        "A>zero",
        "A>infnan",
        "B>:opmagic",
        "B>:opcode",
        "B>:rawshape",
        "B>:shape",
        "B>:format",
        "B>FUNC:funcmagic",
        "B>FUNC:hash",
        "B>ROOT_FUNC:hash",
        "B>FILENAME",
        "B>max",
        "B>min",
        "B>avg",
        "B>aavg",
        "B>zero",
        "B>infnan",
        "AB>RESULT",
        "AB>rtol/atol",
        "AB>fail_cnt/warn_cnt/tol_cnt",
        "AB>total_cnt/zero_cnt/infnan_cnt",
        "AB>mre",
        "AB>mre_top8",
        "AB>mre_top1permil",
        "AB>mae",
        "AB>mae_top8",
        "AB>mae_top1permil",
        "B>TIMESTAMP"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    this.db.run(sql, extractParams(ACCURACY_TOOL_CMP_FIELDS, data));
  }

  /**
   * Get cmp error list by file path with dynamic WHERE clause and pagination.
   * Returns { total, list }.
   */
  async getCmpErrorListByFilePath(
    filePath: string,
    pageSize: number,
    startOffset: number,
    keyword?: string,
    funcMagicName?: string,
    funcHash?: string,
    phaseName?: string,
    rootFuncHash?: string,
    oriLoopInfo?: string,
  ): Promise<PaginatedResult<AccuracyToolCmpData>> {
    const conditions: string[] = ['file_path = ?'];
    const params: any[] = [filePath];
    conditions.push('"AB>RESULT" = \'FAIL\'');
    if (keyword) {
      conditions.push('("LOOP_INFO" LIKE ? OR ":datatype" LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const sideFields: string[] = [];
    const sideValues: any[] = [];
    if (phaseName) { sideFields.push('PHASE_NAME'); sideValues.push(phaseName); }
    if (funcHash) { sideFields.push('FUNC:hash'); sideValues.push(funcHash); }
    if (rootFuncHash) { sideFields.push('ROOT_FUNC:hash'); sideValues.push(rootFuncHash); }
    if (sideFields.length > 0) {
      const aConds = sideFields.map(f => `"A>${f}" = ?`).join(' AND ');
      const bConds = sideFields.map(f => `"B>${f}" = ?`).join(' AND ');
      conditions.push(`((${aConds}) OR (${bConds}))`);
      params.push(...sideValues, ...sideValues);
    }
    if (funcMagicName) {
      conditions.push('"PATH_FUNC:func_magicname" = ?');
      params.push(funcMagicName);
    }
    if (oriLoopInfo) {
      conditions.push('"LOOP_INFO" = ?');
      params.push(oriLoopInfo);
    }
    const whereClause = conditions.join(' AND ');

    const countSql = `SELECT COUNT(*) AS total FROM accuracy_tool_cmp WHERE ${whereClause}`;
    const total = queryCount(this.db, countSql, params.slice());

    const sql = `
      SELECT
        file_path,
        "NO." AS no,
        "PATH_FUNC:func_magicname" AS pathFuncMagicName,
        "LOOP_INFO" AS loopInfo,
        ":symbol" AS symbol,
        ":validshape" AS validShape,
        ":datatype" AS dataType,
        "OP_ATTR_SYM_OFFSET" AS opAttrSymOffset,
        "A>:opmagic" AS aOpMagic,
        "B>PHASE_NAME" AS bPhaseName,
        "A>PHASE_NAME" AS aPhaseName,
        "A>:opcode" AS aOpcode,
        "A>:rawshape" AS aRawShape,
        "A>:shape" AS aShape,
        "A>:format" AS aFormat,
        "A>FUNC:funcmagic" AS aFuncMagic,
        "A>FUNC:hash" AS aFuncHash,
        "A>ROOT_FUNC:hash" AS aRootFuncHash,
        "A>FILENAME" AS aFileName,
        "A>max" AS aMax,
        "A>min" AS aMin,
        "A>avg" AS aAvg,
        "A>aavg" AS aAavg,
        "A>zero" AS aZero,
        "A>infnan" AS aInfnan,
        "B>:opmagic" AS bOpMagic,
        "B>:opcode" AS bOpcode,
        "B>:rawshape" AS bRawShape,
        "B>:shape" AS bShape,
        "B>:format" AS bFormat,
        "B>FUNC:funcmagic" AS bFuncMagic,
        "B>FUNC:hash" AS bFuncHash,
        "B>ROOT_FUNC:hash" AS bRootFuncHash,
        "B>FILENAME" AS bFileName,
        "B>max" AS bMax,
        "B>min" AS bMin,
        "B>avg" AS bAvg,
        "B>aavg" AS bAavg,
        "B>zero" AS bZero,
        "B>infnan" AS bInfnan,
        "AB>RESULT" AS abResult,
        "AB>rtol/atol" AS abRtolAtol,
        "AB>fail_cnt/warn_cnt/tol_cnt" AS abFailWarnTol,
        "AB>total_cnt/zero_cnt/infnan_cnt" AS abTotalZeroInfnanCnt,
        "AB>mre" AS abMre,
        "AB>mre_top8" AS abMreTop8,
        "AB>mre_top1permil" AS abMreTop1permil,
        "AB>mae" AS abMae,
        "AB>mae_top8" AS abMaeTop8,
        "AB>mae_top1permil" AS abMaeTop1permil,
        "B>TIMESTAMP" AS bTimestamp
      FROM accuracy_tool_cmp WHERE ${whereClause} ORDER BY bTimestamp
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, startOffset);
    const list = queryAll(this.db, sql, params, mapAccuracyToolCmpRow);

    return { total, list };
  }

  /**
   * Get cmp data by file path with dynamic WHERE clause.
   */
  async cmpGetByFilePath(
    filePath: string,
    pageSize: number,
    startOffset: number,
    res?: string,
    keyword?: string,
  ): Promise<AccuracyToolCmpData[]> {
    const conditions: string[] = ['file_path = ?'];
    const params: any[] = [filePath];
    if (res) {
      conditions.push('"AB>RESULT" = ?');
      params.push(res);
    }
    if (keyword) {
      conditions.push('("A>:opcode" LIKE ? OR "B>:opcode" LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT ${ACCURACY_TOOL_CMP_SELECT_COLUMNS}
      FROM accuracy_tool_cmp WHERE ${whereClause} ORDER BY bTimestamp
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, startOffset);
    return queryAll(this.db, sql, params, mapAccuracyToolCmpRow);
  }

  /**
   * Get cmp count by file path with dynamic WHERE clause.
   */
  async cmpGetCountByFilePath(
    filePath: string,
    res?: string,
    keyword?: string,
    funcMagicName?: string,
    funcHash?: string,
    phaseName?: string,
    rootFuncHash?: string,
    oriLoopInfo?: string,
  ): Promise<number> {
    const conditions: string[] = ['file_path = ?'];
    const params: any[] = [filePath];
    if (res) {
      conditions.push('"AB>RESULT" = ?');
      params.push(res);
    }
    if (keyword) {
      conditions.push('("A>:opcode" LIKE ? OR "B>:opcode" LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const sideFields: string[] = [];
    const sideValues: any[] = [];
    if (phaseName) { sideFields.push('PHASE_NAME'); sideValues.push(phaseName); }
    if (funcHash) { sideFields.push('FUNC:hash'); sideValues.push(funcHash); }
    if (rootFuncHash) { sideFields.push('ROOT_FUNC:hash'); sideValues.push(rootFuncHash); }
    if (sideFields.length > 0) {
      const aConds = sideFields.map(f => `"A>${f}" = ?`).join(' AND ');
      const bConds = sideFields.map(f => `"B>${f}" = ?`).join(' AND ');
      conditions.push(`((${aConds}) OR (${bConds}))`);
      params.push(...sideValues, ...sideValues);
    }
    if (funcMagicName) {
      conditions.push('"PATH_FUNC:func_magicname" = ?');
      params.push(funcMagicName);
    }
    if (oriLoopInfo) {
      conditions.push('"LOOP_INFO" = ?');
      params.push(oriLoopInfo);
    }
    const whereClause = conditions.join(' AND ');

    const sql = `SELECT COUNT(*) as total FROM accuracy_tool_cmp WHERE ${whereClause}`;
    return queryCount(this.db, sql, params);
  }

  // ============================================================
  // accuracy_tool_cmp_detail table methods
  // ============================================================

  /**
   * Insert or replace a row in accuracy_tool_cmp_detail table.
   */
  async cmpDetailSet(data: AccuracyToolCmpDetailData): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO accuracy_tool_cmp_detail (
        file_path,
        "GROUP",
        "INDEX",
        "OFFSET",
        "OFFSET_RAW",
        "A>data",
        "B>data",
        "AB>ae",
        "AB>re",
        "AB>tol"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.filePath ?? '',
      data.group ?? '',
      data.index ?? '',
      data.offset ?? '',
      data.offsetRaw ?? '',
      data.aData ?? '',
      data.bData ?? '',
      data.abAe ?? '',
      data.abRe ?? '',
      data.abTol ?? '',
    ];
    this.db.run(sql, params);
  }

  /**
   * Get cmp detail data by file path.
   */
  async cmpDetailGetByFilePath(filePath: string): Promise<AccuracyToolCmpDetailData[]> {
    const sql = `
      SELECT
        file_path,
        "GROUP" AS "group",
        "INDEX" AS "index",
        "OFFSET" AS "offset",
        "OFFSET_RAW" AS "offsetRaw",
        "A>data" AS "aData",
        "B>data" AS "bData",
        "AB>ae" AS "abAe",
        "AB>re" AS "abRe",
        "AB>tol" AS "abTol"
      FROM accuracy_tool_cmp_detail
      WHERE file_path = ?
    `;
    return queryAll(this.db, sql, [filePath], mapAccuracyToolCmpDetailRow);
  }

  // ============================================================
  // comparelist table methods
  // ============================================================

  /**
   * Delete existing entries for computePath and insert new ones.
   */
  async compListSet(computePath: string, dataList: AccuracyToolCompList[]): Promise<void> {
    this.db.run('DELETE FROM comparelist WHERE compute_path = ?', [computePath]);
    for (const data of dataList) {
      this.db.run('INSERT INTO comparelist(compute_path, file_path, first_req) VALUES(?, ?, ?)', [
        computePath,
        data.file_path,
        data.first_req,
      ]);
    }
  }

  /**
   * Get comparelist entries by compute path.
   */
  async compListGetByComputePath(computePath: string): Promise<AccuracyToolCompList[]> {
    const sql = 'SELECT compute_path, file_path, first_req FROM comparelist WHERE compute_path = ?';
    return queryAll(this.db, sql, [computePath], (row) => row as unknown as AccuracyToolCompList);
  }

  /**
   * Get a single comparelist entry by file path.
   */
  async compListGetByFilePath(filePath: string): Promise<AccuracyToolCompList | undefined> {
    const sql = 'SELECT compute_path, file_path, first_req FROM comparelist WHERE file_path = ?';
    return queryOne(this.db, sql, [filePath], (row) => row as unknown as AccuracyToolCompList);
  }

  /**
   * Update first_req for a file path.
   */
  async compListUpdateFirstReq(filePath: string, firstReq: string): Promise<void> {
    this.db.run('UPDATE comparelist SET first_req = ? WHERE file_path = ?', [firstReq, filePath]);
  }

  // ============================================================
  // accu_file_path table methods
  // ============================================================

  /**
   * Set accu_file_path (single-row table, id=1).
   * DELETE then INSERT.
   */
  async filePathSet(data: accuFilePathData): Promise<void> {
    this.db.run('DELETE FROM accu_file_path');
    this.db.run('INSERT INTO accu_file_path(id, file_type, file_path) VALUES(1, ?, ?)', [
      data.fileType,
      data.filePath ?? '',
    ]);
  }

  /**
   * Get accu_file_path (single-row table, id=1).
   */
  async filePathGet(): Promise<accuFilePathData | undefined> {
    const sql = 'SELECT file_type AS fileType, file_path AS filePath FROM accu_file_path WHERE id = 1';
    return queryOne(this.db, sql, [], (row) => row as unknown as accuFilePathData);
  }
}
