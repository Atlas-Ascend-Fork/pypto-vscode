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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SqlStoreQuery } from '../../../../../src/core/store/sql-store/sql-store-query';
import { SqlAttributesResolver } from '../../../../../src/core/store/sql-store/sql-attributes-resolver';
import type { StoreAttributes } from '../../../../../src/core/store/types';

describe('SqlStoreQuery', () => {
  let mockExecQuery: any;
  let mockExecDelete: any;
  let mockExecCount: any;
  let resolver: SqlAttributesResolver<any>;

  beforeEach(() => {
    mockExecQuery = vi.fn().mockResolvedValue([]);
    mockExecDelete = vi.fn().mockResolvedValue(0);
    mockExecCount = vi.fn().mockResolvedValue(0);

    const attributes: StoreAttributes<any> = {
      id: { type: Number, isQuery: true, isPrimary: true },
      name: { type: String, isQuery: true },
      status: { type: String, isQuery: true },
    };
    resolver = new SqlAttributesResolver(attributes);
  });

  describe('filter', () => {
    it('should add exact match conditions', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.filter({ id: 1, name: 'test' }).exec();

      expect(mockExecQuery).toHaveBeenCalled();
      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain('id=1');
      expect(condition).toContain("name='test'");
      expect(condition).toContain('WHERE');
    });

    it('should chain multiple filters', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.filter({ id: 1 }).filter({ name: 'test' }).exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain('id=1');
      expect(condition).toContain("name='test'");
      expect(condition).toContain('AND');
    });
  });

  describe('search', () => {
    it('should add LIKE search condition', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.search('name', 'test').exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain("name like '%test%'");
    });

    it('should escape underscores in exact match', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.search('name', 'test_value', true).exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain("name like '%test\\_value%' escape '\\'");
    });

    it('should not escape underscores in non-exact match', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.search('name', 'test_value', false).exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain("name like '%test_value%'");
      expect(condition).not.toContain('escape');
    });
  });

  describe('notNull', () => {
    it('should add IS NOT NULL conditions', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.notNull(['name', 'status']).exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain('name IS NOT NULL');
      expect(condition).toContain('status IS NOT NULL');
    });
  });

  describe('sort', () => {
    it('should add ORDER BY condition', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.sort('name', 'asc').exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain('ORDER BY name asc');
    });

    it('should throw error if sort is used twice', () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      query.sort('name', 'asc');
      expect(() => query.sort('status', 'desc')).toThrow('查询条件中仅能使用一次排序');
    });
  });

  describe('slice', () => {
    it('should add LIMIT and OFFSET conditions', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.slice(10, 20).exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain('LIMIT 10 OFFSET 10');
    });

    it('should throw error if slice is used twice', () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      query.slice(0, 10);
      expect(() => query.slice(10, 20)).toThrow('查询条件中仅能使用一次截取');
    });
  });

  describe('exec', () => {
    it('should execute query with all conditions', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.filter({ id: 1 }).search('name', 'test').sort('name', 'asc').slice(0, 10).exec();

      const condition = mockExecQuery.mock.calls[0][0];
      expect(condition).toContain('WHERE');
      expect(condition).toContain('id=1');
      expect(condition).toContain("name like '%test%'");
      expect(condition).toContain('ORDER BY name asc');
      expect(condition).toContain('LIMIT 10 OFFSET 0');
    });

    it('should return result from execQuery', async () => {
      const expectedResult = [{ id: 1, name: 'test' }];
      mockExecQuery.mockResolvedValue(expectedResult);

      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      const result = await query.exec();

      expect(result).toEqual(expectedResult);
    });
  });

  describe('delete', () => {
    it('should execute delete with all conditions', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.filter({ id: 1 }).delete();

      const condition = mockExecDelete.mock.calls[0][0];
      expect(condition).toContain('WHERE');
      expect(condition).toContain('id=1');
    });

    it('should return result from execDelete', async () => {
      mockExecDelete.mockResolvedValue(5);

      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      const result = await query.delete();

      expect(result).toBe(5);
    });
  });

  describe('count', () => {
    it('should execute count with WHERE and LIMIT conditions', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.filter({ id: 1 }).slice(0, 10).count();

      const condition = mockExecCount.mock.calls[0][0];
      expect(condition).toContain('WHERE');
      expect(condition).toContain('id=1');
      expect(condition).toContain('LIMIT 10 OFFSET 0');
    });

    it('should not include ORDER BY in count', async () => {
      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      await query.sort('name', 'asc').count();

      const condition = mockExecCount.mock.calls[0][0];
      expect(condition).not.toContain('ORDER BY');
    });

    it('should return result from execCount', async () => {
      mockExecCount.mockResolvedValue(42);

      const query = new SqlStoreQuery(resolver, mockExecQuery, mockExecDelete, mockExecCount);
      const result = await query.count();

      expect(result).toBe(42);
    });
  });
});
