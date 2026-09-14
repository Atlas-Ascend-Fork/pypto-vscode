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
import { describe, it, expect, beforeEach } from 'vitest';
import { SqlAttributesResolver } from '../../../../../src/core/store/sql-store/sql-attributes-resolver';
import type { StoreAttributes } from '../../../../../src/core/store/types';

describe('SqlAttributesResolver', () => {
  describe('toColumnNames', () => {
    it('should return only query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        data: { type: Object },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const columns = resolver.toColumnNames();
      expect(columns).toEqual(['id', 'name', '__data_file']);
    });

    it('should always include __data_file column', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isPrimary: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const columns = resolver.toColumnNames();
      expect(columns).toEqual(['__data_file']);
    });

    it('should handle empty attributes', () => {
      const attributes: StoreAttributes<any> = {};
      const resolver = new SqlAttributesResolver(attributes);
      const columns = resolver.toColumnNames();
      expect(columns).toEqual(['__data_file']);
    });
  });

  describe('toTableColumnInfo', () => {
    it('should return table column info for query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        data: { type: Object },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const tableInfo = resolver.toTableColumnInfo();
      expect(tableInfo).toEqual([
        ['id', 'DECIMAL(18,17)', 1, null, 1],
        ['name', 'TEXT', 0, null, 0],
        ['__data_file', 'CHAR(50)', 1, null, 0],
      ]);
    });

    it('should handle default values', () => {
      const attributes: StoreAttributes<any> = {
        status: { type: String, isQuery: true, defaultValue: 'active' },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const tableInfo = resolver.toTableColumnInfo();
      expect(tableInfo).toEqual([
        ['status', 'TEXT', 1, "'active'", 0],
        ['__data_file', 'CHAR(50)', 1, null, 0],
      ]);
    });

    it('should handle different types', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        active: { type: Boolean, isQuery: true },
        createdAt: { type: Date, isQuery: true },
        data: { type: Object, isQuery: true },
        tags: { type: Array, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const tableInfo = resolver.toTableColumnInfo();
      expect(tableInfo[0][1]).toBe('DECIMAL(18,17)');
      expect(tableInfo[1][1]).toBe('TEXT');
      expect(tableInfo[2][1]).toBe('BINARY(1)');
      expect(tableInfo[3][1]).toBe('DATETIME');
      expect(tableInfo[4][1]).toBe('JSON');
      expect(tableInfo[5][1]).toBe('JSON');
    });

    it('should set not_null for primary keys and default values', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        status: { type: String, isQuery: true, defaultValue: 'active' },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const tableInfo = resolver.toTableColumnInfo();
      expect(tableInfo[0][2]).toBe(1); // id is primary
      expect(tableInfo[1][2]).toBe(0); // name has no default and not primary
      expect(tableInfo[2][2]).toBe(1); // status has default
    });
  });

  describe('toIndexColumnNames', () => {
    it('should return only non-primary query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
        status: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const indexes = resolver.toIndexColumnNames();
      expect(indexes).toEqual(['name', 'status']);
    });

    it('should exclude primary keys', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const indexes = resolver.toIndexColumnNames();
      expect(indexes).toEqual([]);
    });

    it('should exclude non-query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isPrimary: true },
        data: { type: Object },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const indexes = resolver.toIndexColumnNames();
      expect(indexes).toEqual([]);
    });
  });

  describe('itemToQueryConditions', () => {
    it('should convert item to query conditions', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const conditions = resolver.itemToQueryConditions({ id: 1, name: 'test' });
      expect(conditions).toEqual(["id=1", "name='test'"]);
    });

    it('should only include query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
        data: { type: Object },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const conditions = resolver.itemToQueryConditions({ id: 1, data: { foo: 'bar' } });
      expect(conditions).toEqual(["id=1"]);
    });

    it('should handle null values', () => {
      const attributes: StoreAttributes<any> = {
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const conditions = resolver.itemToQueryConditions({ name: null });
      expect(conditions).toEqual(["name=NULL"]);
    });

    it('should handle different types', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
        name: { type: String, isQuery: true },
        active: { type: Boolean, isQuery: true },
        createdAt: { type: Date, isQuery: true },
        data: { type: Object, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const date = new Date('2024-01-01T00:00:00Z');
      const conditions = resolver.itemToQueryConditions({
        id: 1,
        name: 'test',
        active: true,
        createdAt: date,
        data: { foo: 'bar' },
      });
      expect(conditions[0]).toBe("id=1");
      expect(conditions[1]).toBe("name='test'");
      expect(conditions[2]).toBe("active=1");
      expect(conditions[3]).toContain("createdAt=");
      expect(conditions[4]).toContain("data=");
    });
  });

  describe('itemToPrimaryConditions', () => {
    it('should convert item to primary key conditions', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const conditions = resolver.itemToPrimaryConditions({ id: 1 });
      expect(conditions).toEqual(["id=1"]);
    });

    it('should throw error if primary key is missing', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      expect(() => resolver.itemToPrimaryConditions({})).toThrow('缺少主键条件id');
    });

    it('should handle multiple primary keys', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true, isPrimary: true },
        version: { type: Number, isQuery: true, isPrimary: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const conditions = resolver.itemToPrimaryConditions({ id: 1, version: 2 });
      expect(conditions).toEqual(["id=1", "version=2"]);
    });
  });

  describe('itemToSqlValues', () => {
    it('should convert item to SQL values for query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const values = resolver.itemToSqlValues({ id: 1, name: 'test' });
      expect(values).toEqual(["1", "'test'"]);
    });

    it('should only include query columns', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
        data: { type: Object },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const values = resolver.itemToSqlValues({ id: 1, data: { foo: 'bar' } });
      expect(values).toEqual(["1"]);
    });

    it('should handle null values', () => {
      const attributes: StoreAttributes<any> = {
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const values = resolver.itemToSqlValues({ name: null });
      expect(values).toEqual(["NULL"]);
    });

    it('should handle undefined values', () => {
      const attributes: StoreAttributes<any> = {
        name: { type: String, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const values = resolver.itemToSqlValues({});
      expect(values).toEqual(["NULL"]);
    });

    it('should handle different types', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
        name: { type: String, isQuery: true },
        active: { type: Boolean, isQuery: true },
        createdAt: { type: Date, isQuery: true },
        data: { type: Object, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const date = new Date('2024-01-01T00:00:00Z');
      const values = resolver.itemToSqlValues({
        id: 1,
        name: 'test',
        active: true,
        createdAt: date,
        data: { foo: 'bar' },
      });
      expect(values[0]).toBe("1");
      expect(values[1]).toBe("'test'");
      expect(values[2]).toBe("1");
      expect(values[3]).toContain("2024");
      expect(values[4]).toContain("'");
    });
  });

  describe('getFileNamesFromQueryResult', () => {
    it('should extract file names from query result', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const queryResult = {
        columns: ['id', '__data_file'],
        values: [[1, 'file1.json'], [2, 'file2.json']],
      };
      const fileNames = resolver.getFileNamesFromQueryResult(queryResult as any);
      expect(fileNames).toEqual(['file1.json', 'file2.json']);
    });

    it('should return empty array for undefined result', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const fileNames = resolver.getFileNamesFromQueryResult(undefined);
      expect(fileNames).toEqual([]);
    });

    it('should handle empty result', () => {
      const attributes: StoreAttributes<any> = {
        id: { type: Number, isQuery: true },
      };
      const resolver = new SqlAttributesResolver(attributes);
      const queryResult = {
        columns: ['id', '__data_file'],
        values: [],
      };
      const fileNames = resolver.getFileNamesFromQueryResult(queryResult as any);
      expect(fileNames).toEqual([]);
    });
  });
});
