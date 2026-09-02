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

/**
 * Create all 11 core tables called during open().
 */
export function createAllTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS com_graph_layout (
      file_path        TEXT NOT NULL,
      func_hash        TEXT NOT NULL DEFAULT '',
      layout_result    TEXT,
      last_change_time TEXT,
      PRIMARY KEY (file_path, func_hash)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS com_graph_final_result (
      file_path        TEXT NOT NULL,
      func_hash        TEXT NOT NULL DEFAULT '',
      final_result     TEXT,
      last_change_time TEXT,
      PRIMARY KEY (file_path, func_hash)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS com_graph_func_data (
      file_path          TEXT NOT NULL,
      func_hash          TEXT NOT NULL DEFAULT '',
      call_hash_arr      TEXT,
      data               TEXT,
      big_data_file_path TEXT,
      last_change_time   TEXT,
      PRIMARY KEY (file_path, func_hash)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS com_graph_file_hash_map (
      file_path TEXT NOT NULL,
      data      TEXT,
      PRIMARY KEY (file_path)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS com_graph_file_callee_op_attr (
      calleehash    TEXT NOT NULL,
      op_magic      TEXT NOT NULL,
      op_subgraphid TEXT NOT NULL,
      op_attr       TEXT,
      ioperands     TEXT,
      PRIMARY KEY (calleehash, op_magic, op_subgraphid)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accuracy_tool (
      file_path TEXT NOT NULL,
      "NO." TEXT NOT NULL,
      "B>PHASE_NAME" TEXT NOT NULL,
      "PATH_FUNC:func_magicname" TEXT NOT NULL,
      "AB>RESULT" TEXT,
      "B>:rawmagic" TEXT NOT NULL,
      ":datatype" TEXT,
      ":validshape" TEXT,
      "LOOP_INFO" TEXT,
      "AB>rtol/atol" TEXT,
      "AB>fail_cnt/warn_cnt/tol_cnt" TEXT,
      "AB>total_cnt/zero_cnt/infnan_cnt" TEXT,
      "AB>mre" TEXT,
      "AB>mre_top1permil" TEXT,
      "AB>mre_top8" TEXT,
      "AB>mae" TEXT,
      "AB>mae_top8" TEXT,
      "AB>mae_top1permil" TEXT,
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
      "B>TIMESTAMP" TEXT,
      PRIMARY KEY (file_path, "NO.")
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accuracy_tool_cmp (
      file_path TEXT NOT NULL,
      "NO." TEXT NOT NULL,
      "PATH_FUNC:func_magicname" TEXT NOT NULL,
      "LOOP_INFO" TEXT,
      ":symbol" TEXT,
      ":validshape" TEXT,
      ":datatype" TEXT,
      "OP_ATTR_SYM_OFFSET" TEXT,
      "B>PHASE_NAME" TEXT NOT NULL,
      "B>TIMESTAMP" TEXT NOT NULL,
      "B>FUNC:funcmagic" TEXT NOT NULL,
      "B>FUNC:hash" TEXT NOT NULL,
      "B>ROOT_FUNC:hash" TEXT NOT NULL,
      "B>:opmagic" TEXT NOT NULL,
      "B>:opcode" TEXT NOT NULL,
      "B>:rawshape" TEXT NOT NULL,
      "B>:shape" TEXT NOT NULL,
      "B>:format" TEXT NOT NULL,
      "B>FILENAME" TEXT NOT NULL,
      "B>max" TEXT,
      "B>min" TEXT,
      "B>avg" TEXT,
      "B>aavg" TEXT,
      "B>zero" TEXT,
      "B>infnan" TEXT,
      "A>PHASE_NAME" TEXT NOT NULL,
      "A>FUNC:funcmagic" TEXT NOT NULL,
      "A>FUNC:hash" TEXT NOT NULL,
      "A>ROOT_FUNC:hash" TEXT NOT NULL,
      "A>:opmagic" TEXT NOT NULL,
      "A>:opcode" TEXT NOT NULL,
      "A>:rawshape" TEXT NOT NULL,
      "A>:shape" TEXT NOT NULL,
      "A>:format" TEXT NOT NULL,
      "A>FILENAME" TEXT NOT NULL,
      "A>max" TEXT,
      "A>min" TEXT,
      "A>avg" TEXT,
      "A>aavg" TEXT,
      "A>zero" TEXT,
      "A>infnan" TEXT,
      "AB>RESULT" TEXT,
      "AB>rtol/atol" TEXT NOT NULL,
      "AB>fail_cnt/warn_cnt/tol_cnt" TEXT NOT NULL,
      "AB>total_cnt/zero_cnt/infnan_cnt" TEXT NOT NULL,
      "AB>mre" TEXT NOT NULL,
      "AB>mre_top8" TEXT NOT NULL,
      "AB>mre_top1permil" TEXT NOT NULL,
      "AB>mae" TEXT NOT NULL,
      "AB>mae_top8" TEXT NOT NULL,
      "AB>mae_top1permil" TEXT NOT NULL,
      PRIMARY KEY (file_path, "NO.")
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accuracy_tool_cmp_detail (
      file_path TEXT NOT NULL,
      "GROUP" TEXT NOT NULL,
      "INDEX" TEXT NOT NULL,
      "OFFSET" TEXT NOT NULL,
      "OFFSET_RAW" TEXT NOT NULL,
      "A>data" TEXT,
      "B>data" TEXT,
      "AB>ae" TEXT,
      "AB>re" TEXT,
      "AB>tol" TEXT,
      PRIMARY KEY (file_path, "INDEX")
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS accu_file_path (
      file_type TEXT NOT NULL,
      file_path TEXT DEFAULT '',
      id INTEGER PRIMARY KEY CHECK (id = 1)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comparelist (
      compute_path TEXT NOT NULL,
      file_path TEXT NOT NULL,
      first_req TEXT NOT NULL,
      PRIMARY KEY (compute_path, file_path)
    );
  `);
}

