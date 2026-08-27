/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAllTables } from '../../../src/core/cache-schema';

describe('cache-schema', () => {
  describe('createAllTables', () => {
    let mockDb: any;
    let runCalls: string[];

    beforeEach(() => {
      runCalls = [];
      mockDb = {
        run: vi.fn((sql: string) => {
          runCalls.push(sql);
        }),
      };
    });

    it('should create all 10 tables', () => {
      createAllTables(mockDb);
      expect(mockDb.run).toHaveBeenCalledTimes(10);
    });

    it('should create com_graph_layout table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('com_graph_layout'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS com_graph_layout');
      expect(sql).toContain('file_path');
      expect(sql).toContain('func_hash');
      expect(sql).toContain('layout_result');
      expect(sql).toContain('last_change_time');
      expect(sql).toContain('PRIMARY KEY (file_path, func_hash)');
    });

    it('should create com_graph_final_result table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('com_graph_final_result'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS com_graph_final_result');
      expect(sql).toContain('file_path');
      expect(sql).toContain('func_hash');
      expect(sql).toContain('final_result');
      expect(sql).toContain('last_change_time');
      expect(sql).toContain('PRIMARY KEY (file_path, func_hash)');
    });

    it('should create com_graph_func_data table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('com_graph_func_data'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS com_graph_func_data');
      expect(sql).toContain('file_path');
      expect(sql).toContain('func_hash');
      expect(sql).toContain('call_hash_arr');
      expect(sql).toContain('data');
      expect(sql).toContain('big_data_file_path');
      expect(sql).toContain('last_change_time');
      expect(sql).toContain('PRIMARY KEY (file_path, func_hash)');
    });

    it('should create com_graph_file_hash_map table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('com_graph_file_hash_map'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS com_graph_file_hash_map');
      expect(sql).toContain('file_path');
      expect(sql).toContain('data');
      expect(sql).toContain('PRIMARY KEY (file_path)');
    });

    it('should create com_graph_file_callee_op_attr table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('com_graph_file_callee_op_attr'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS com_graph_file_callee_op_attr');
      expect(sql).toContain('calleehash');
      expect(sql).toContain('op_magic');
      expect(sql).toContain('op_subgraphid');
      expect(sql).toContain('op_attr');
      expect(sql).toContain('ioperands');
      expect(sql).toContain('PRIMARY KEY (calleehash, op_magic, op_subgraphid)');
    });

    it('should create accuracy_tool table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('accuracy_tool') && !s.includes('accuracy_tool_cmp'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS accuracy_tool');
      expect(sql).toContain('file_path');
      expect(sql).toContain('"NO."');
      expect(sql).toContain('"B>PHASE_NAME"');
      expect(sql).toContain('"PATH_FUNC:func_magicname"');
      expect(sql).toContain('"AB>RESULT"');
      expect(sql).toContain('PRIMARY KEY (file_path, "NO.")');
    });

    it('should create accuracy_tool_cmp table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('accuracy_tool_cmp') && !s.includes('accuracy_tool_cmp_detail'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS accuracy_tool_cmp');
      expect(sql).toContain('file_path');
      expect(sql).toContain('"NO."');
      expect(sql).toContain('"PATH_FUNC:func_magicname"');
      expect(sql).toContain('PRIMARY KEY (file_path, "NO.")');
    });

    it('should create accuracy_tool_cmp_detail table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('accuracy_tool_cmp_detail'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS accuracy_tool_cmp_detail');
      expect(sql).toContain('file_path');
      expect(sql).toContain('"GROUP"');
      expect(sql).toContain('"INDEX"');
      expect(sql).toContain('"OFFSET"');
      expect(sql).toContain('PRIMARY KEY (file_path, "INDEX")');
    });

    it('should create accu_file_path table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('accu_file_path'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS accu_file_path');
      expect(sql).toContain('file_type');
      expect(sql).toContain('file_path');
      expect(sql).toContain('id INTEGER PRIMARY KEY CHECK (id = 1)');
    });

    it('should create comparelist table', () => {
      createAllTables(mockDb);
      const sql = runCalls.find(s => s.includes('comparelist'));
      expect(sql).toBeDefined();
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS comparelist');
      expect(sql).toContain('compute_path');
      expect(sql).toContain('file_path');
      expect(sql).toContain('first_req');
      expect(sql).toContain('PRIMARY KEY (compute_path, file_path)');
    });

    it('should use IF NOT EXISTS for all tables', () => {
      createAllTables(mockDb);
      runCalls.forEach(sql => {
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
      });
    });

    it('should be idempotent', () => {
      createAllTables(mockDb);
      const firstCallCount = mockDb.run.mock.calls.length;
      
      createAllTables(mockDb);
      const secondCallCount = mockDb.run.mock.calls.length;
      
      expect(secondCallCount).toBe(firstCallCount * 2);
    });
  });
});
