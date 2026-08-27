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
import { SqlTableController } from '../../../../../src/core/store/sql-store/sql-table-controller';
import { SqlAttributesResolver } from '../../../../../src/core/store/sql-store/sql-attributes-resolver';
import type { StoreAttributes } from '../../../../../src/core/store/types';

describe('SqlTableController', () => {
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

  describe('createTable', () => {
    it('should create table with correct SQL', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.createTable(mockDb);

      expect(mockDb.run).toHaveBeenCalled();
      const createTableSql = runCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS test_table'));
      expect(createTableSql).toBeDefined();
      expect(createTableSql).toContain('`id`');
      expect(createTableSql).toContain('`name`');
      expect(createTableSql).toContain('PRIMARY KEY');
    });

    it('should handle multiple primary keys', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        version: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.createTable(mockDb);

      const createTableSql = runCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS test_table'));
      expect(createTableSql).toContain('PRIMARY KEY (`id`, `version`)');
    });

    it('should handle default values', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        status: { type: String, isQuery: true, defaultValue: 'active' },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.createTable(mockDb);

      const createTableSql = runCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS test_table'));
      expect(createTableSql).toContain("DEFAULT 'active'");
    });

    it('should handle NOT NULL constraint', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.createTable(mockDb);

      const createTableSql = runCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS test_table'));
      expect(createTableSql).toContain('NOT NULL');
    });

    it('should create indexes for non-primary query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        status: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.createTable(mockDb);

      const indexSqls = runCalls.filter(s => s.includes('CREATE INDEX IF NOT EXISTS'));
      expect(indexSqls.length).toBe(2);
      expect(indexSqls.some(s => s.includes('index_name'))).toBe(true);
      expect(indexSqls.some(s => s.includes('index_status'))).toBe(true);
    });

    it('should not create indexes for primary keys', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.createTable(mockDb);

      const indexSqls = runCalls.filter(s => s.includes('CREATE INDEX IF NOT EXISTS'));
      expect(indexSqls.length).toBe(0);
    });

    it('should handle different column types', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        active: { type: Boolean, isQuery: true },
        createdAt: { type: Date, isQuery: true },
        data: { type: Object, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.createTable(mockDb);

      const createTableSql = runCalls.find(s => s.includes('CREATE TABLE IF NOT EXISTS test_table'));
      expect(createTableSql).toContain('DECIMAL(18,17)');
      expect(createTableSql).toContain('TEXT');
      expect(createTableSql).toContain('BINARY(1)');
      expect(createTableSql).toContain('DATETIME');
      expect(createTableSql).toContain('JSON');
    });
  });

  describe('deleteTable', () => {
    it('should drop table with correct SQL', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.deleteTable(mockDb);

      expect(mockDb.run).toHaveBeenCalledWith('DROP TABLE IF EXISTS test_table');
    });

    it('should use IF EXISTS to avoid errors', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const controller = new SqlTableController('test_table', resolver);

      controller.deleteTable(mockDb);

      const dropSql = runCalls[0];
      expect(dropSql).toContain('DROP TABLE IF EXISTS');
    });
  });
});
