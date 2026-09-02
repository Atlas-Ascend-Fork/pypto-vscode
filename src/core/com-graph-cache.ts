/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

import type { Database } from 'sql.js';
import { queryOne, queryAll, queryAllRaw, queryCount, retryOperation } from './cache-query-helper';
import type { ComGraphLayoutRow, ComGraphFinalResultRow, ComGraphFuncDataRow } from './cache-types';

export class ComGraphCache {
  constructor(private readonly db: Database) {}

  /****************** com_graph_layout 表 ******************/

  async layoutSet(filePath: string, funcHash: string, layoutResult: string, lastChangeTime: string): Promise<void> {
    this.db.run(
      'INSERT OR REPLACE INTO com_graph_layout(file_path,func_hash,layout_result,last_change_time) VALUES(?,?,?,?)',
      [filePath, funcHash, layoutResult, lastChangeTime],
    );
  }

  async layoutGet(filePath: string, funcHash: string): Promise<ComGraphLayoutRow | undefined> {
    return await retryOperation(
      async () =>
        queryOne<ComGraphLayoutRow>(
          this.db,
          'SELECT file_path,layout_result,last_change_time FROM com_graph_layout WHERE file_path=? and func_hash=?',
          [filePath, funcHash],
          (row) => row as unknown as ComGraphLayoutRow,
        ),
      1,
      100,
      (result) => !result,
      'comGraphLayoutGet',
    );
  }

  async layoutDel(filePath: string): Promise<void> {
    this.db.run('DELETE FROM com_graph_layout WHERE file_path=?', [filePath]);
  }

  /****************** com_graph_final_result 表 ******************/

  async finalResultSet(filePath: string, funcHash: string, finalResult: string, lastChangeTime: string): Promise<void> {
    this.db.run(
      'INSERT OR REPLACE INTO com_graph_final_result(file_path,func_hash,final_result,last_change_time) VALUES(?,?,?,?)',
      [filePath, funcHash, finalResult, lastChangeTime],
    );
  }

  async finalResultGet(filePath: string, funcHash: string): Promise<ComGraphFinalResultRow | undefined> {
    return await retryOperation(
      async () =>
        queryOne<ComGraphFinalResultRow>(
          this.db,
          'SELECT file_path,final_result,last_change_time FROM com_graph_final_result WHERE file_path=? and func_hash=?',
          [filePath, funcHash],
          (row) => row as unknown as ComGraphFinalResultRow,
        ),
      1,
      100,
      (result) => !result,
      'comGraphFinalResultGet',
    );
  }

  async finalResultDel(filePath: string): Promise<void> {
    this.db.run('DELETE FROM com_graph_final_result WHERE file_path=?', [filePath]);
  }

  /****************** com_graph_func_data 表 ******************/

  async funcDataSet(
    filePath: string,
    funcHash: string,
    callHashArr: string,
    data: string,
    bigDataFilePath: string,
    lastChangeTime: string,
  ): Promise<void> {
    this.db.run(
      'INSERT OR REPLACE INTO com_graph_func_data(file_path,func_hash,call_hash_arr,data,big_datA>file_path,last_change_time) VALUES(?,?,?,?,?,?)',
      [filePath, funcHash, callHashArr, data, bigDataFilePath, lastChangeTime],
    );
  }

  async funcDataGetCount(filePath: string): Promise<number> {
    return await retryOperation(
      async () =>
        queryCount(this.db, 'SELECT COUNT(*) as cnt FROM com_graph_func_data WHERE file_path=? ', [filePath]),
      1,
      100,
      (result) => !result,
      'comGraphFuncDataGetCount',
    );
  }

  async funcDataGet(
    filePath: string,
    funcHash: string,
    maxRetries?: number,
    delayMs?: number,
  ): Promise<ComGraphFuncDataRow | undefined> {
    return await retryOperation(
      async () =>
        queryOne<ComGraphFuncDataRow>(
          this.db,
          'SELECT file_path,func_hash,call_hash_arr,data,big_datA>file_path,last_change_time FROM com_graph_func_data WHERE file_path=? and func_hash=?',
          [filePath, funcHash],
          (row) => row as unknown as ComGraphFuncDataRow,
        ),
      maxRetries,
      delayMs,
      (result) => !result,
      'comGraphFuncDataGet',
    );
  }

  async funcDataDel(filePath: string): Promise<void> {
    this.db.run('DELETE FROM com_graph_func_data WHERE file_path=?', [filePath]);
  }

  /****************** com_graph_file_hash_map 表 ******************/

  async fileHashMapSet(filePath: string, data: string): Promise<void> {
    this.db.run('INSERT OR REPLACE INTO com_graph_file_hash_map(file_path,data) VALUES(?,?)', [filePath, data]);
  }

  async fileHashMapGet(filePath: string): Promise<string> {
    return await retryOperation(
      async () => {
        const row = queryOne<{ data: string }>(
          this.db,
          'SELECT data FROM com_graph_file_hash_map WHERE file_path=?',
          [filePath],
          (r) => r as unknown as { data: string },
        );
        return row?.data ?? '';
      },
      5,
      100,
      (result) => !result,
      'comGraphFileHashMapGet',
    );
  }

  async fileHashMapDel(filePath: string): Promise<void> {
    this.db.run('DELETE FROM com_graph_file_hash_map WHERE file_path=?', [filePath]);
  }

  /****************** com_graph_file_callee_op_attr 表 ******************/

  async fileCalleeOpAttrSet(
    calleehash: string,
    opMagic: string,
    opSubgraphid: string,
    opAttr: string,
    ioperands: string,
  ): Promise<void> {
    this.db.run(
      'INSERT OR REPLACE INTO com_graph_file_callee_op_attr(calleehash,op_magic,op_subgraphid,op_attr,ioperands) VALUES(?,?,?,?,?)',
      [calleehash, opMagic, opSubgraphid, opAttr, ioperands],
    );
  }

  async fileCalleeOpAttrGet(calleehash: string, opMagic: string, opSubgraphid: string): Promise<string[]> {
    return await retryOperation(
      async () =>
        queryOne<Record<string, unknown>>(
          this.db,
          'SELECT op_attr,ioperands FROM com_graph_file_callee_op_attr WHERE calleehash=? AND op_magic=? AND op_subgraphid=?',
          [calleehash, opMagic, opSubgraphid],
          (row) => row,
        ) as unknown as string[],
      5,
      100,
      (result) => !result,
      'comGraphFileCalleeOpAttrGet',
    );
  }
}
