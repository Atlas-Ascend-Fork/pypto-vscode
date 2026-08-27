/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect } from 'vitest';
import { formatSchemaToAttributeGroups } from '../../../../src/services/schema-config/schemadata';
import type { SchemaProperty } from '../../../../src/types/config-schema/config-schema';

describe('schema-config/schemadata', () => {
  describe('formatSchemaToAttributeGroups', () => {
    it('should return empty object when schema has no properties', () => {
      const schema: SchemaProperty = {};
      const configGroups = [{ key: 'group1', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result).toEqual({});
    });

    it('should group attributes by configGroups', () => {
      const schema: SchemaProperty = {
        properties: {
          'tile.size': { type: 'integer', label: { zh: '块大小', en: 'Tile Size' } },
          'tile.count': { type: 'integer', label: { zh: '块数量', en: 'Tile Count' } },
          'buffer.size': { type: 'integer', label: { zh: '缓冲区大小', en: 'Buffer Size' } },
        },
      };
      const configGroups = [
        { key: 'tile', glob: ['tile.*'] },
        { key: 'buffer', glob: ['buffer.*'] },
      ];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.tile).toHaveLength(2);
      expect(result.buffer).toHaveLength(1);
      expect(result.tile[0].key).toBe('tile.size');
      expect(result.tile[1].key).toBe('tile.count');
      expect(result.buffer[0].key).toBe('buffer.size');
    });

    it('should flatten nested schema properties', () => {
      const schema: SchemaProperty = {
        properties: {
          'tile': {
            type: 'object',
            properties: {
              'size': { type: 'integer', label: { zh: '大小', en: 'Size' } },
              'count': { type: 'integer', label: { zh: '数量', en: 'Count' } },
            },
          },
        },
      };
      const configGroups = [{ key: 'tile', glob: ['tile.*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.tile).toHaveLength(2);
      expect(result.tile[0].key).toBe('tile.size');
      expect(result.tile[1].key).toBe('tile.count');
    });

    it('should handle empty configGroups', () => {
      const schema: SchemaProperty = {
        properties: {
          'tile.size': { type: 'integer' },
        },
      };
      const configGroups: { key: string; glob: string[] }[] = [];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result).toEqual({});
    });

    it('should handle attributes that do not match any group', () => {
      const schema: SchemaProperty = {
        properties: {
          'tile.size': { type: 'integer' },
          'other.value': { type: 'integer' },
        },
      };
      const configGroups = [{ key: 'tile', glob: ['tile.*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.tile).toHaveLength(1);
      expect(result.tile[0].key).toBe('tile.size');
    });

    it('should correctly identify attribute types', () => {
      const schema: SchemaProperty = {
        properties: {
          'string.attr': { type: 'string' },
          'number.attr': { type: 'number' },
          'integer.attr': { type: 'integer' },
          'boolean.attr': { type: 'boolean' },
          'array.attr': { type: 'array', items: { type: 'string' } },
          'enum.attr': { type: 'string', options: [{ value: 'opt1' }, { value: 'opt2' }] },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all.find(a => a.key === 'string.attr')?.type).toBe('string');
      expect(result.all.find(a => a.key === 'number.attr')?.type).toBe('number');
      expect(result.all.find(a => a.key === 'integer.attr')?.type).toBe('number');
      expect(result.all.find(a => a.key === 'boolean.attr')?.type).toBe('boolean');
      expect(result.all.find(a => a.key === 'array.attr')?.type).toBe('array:string');
      expect(result.all.find(a => a.key === 'enum.attr')?.type).toBe('enum');
    });

    it('should handle array with integer items', () => {
      const schema: SchemaProperty = {
        properties: {
          'array.int': { type: 'array', items: { type: 'integer' } },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all[0].type).toBe('array:number');
    });

    it('should extract attribute options', () => {
      const schema: SchemaProperty = {
        properties: {
          'enum.attr': {
            type: 'string',
            options: [
              { value: 'opt1', label: { zh: '选项1', en: 'Option 1' } },
              { value: 'opt2' },
            ],
          },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all[0].options).toHaveLength(2);
      expect(result.all[0].options?.[0]).toEqual({
        value: 'opt1',
        label: { zh: '选项1', en: 'Option 1' },
      });
      expect(result.all[0].options?.[1]).toEqual({
        value: 'opt2',
        label: { zh: 'opt2', en: 'opt2' },
      });
    });

    it('should extract default values', () => {
      const schema: SchemaProperty = {
        properties: {
          'attr.with.default': { type: 'integer', default: 42 },
          'attr.without.default': { type: 'string' },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all.find(a => a.key === 'attr.with.default')?.defaultValue).toBe(42);
      expect(result.all.find(a => a.key === 'attr.without.default')?.defaultValue).toBeUndefined();
    });

    it('should extract number attribute rules', () => {
      const schema: SchemaProperty = {
        properties: {
          'number.with.rules': {
            type: 'integer',
            minimum: 0,
            maximum: 100,
          },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all[0].rules).toHaveLength(2);
      expect(result.all[0].rules?.[0]).toMatchObject({
        type: 'integer',
        min: 0,
        trigger: 'blur',
      });
      expect(result.all[0].rules?.[1]).toMatchObject({
        type: 'integer',
        max: 100,
        trigger: 'blur',
      });
    });

    it('should extract string attribute rules', () => {
      const schema: SchemaProperty = {
        properties: {
          'string.with.rules': {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-z]+$',
          },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all[0].rules).toHaveLength(3);
      expect(result.all[0].rules?.[0]).toMatchObject({
        type: 'string',
        min: 1,
        trigger: 'blur',
      });
      expect(result.all[0].rules?.[1]).toMatchObject({
        type: 'string',
        max: 50,
        trigger: 'blur',
      });
      expect(result.all[0].rules?.[2]).toMatchObject({
        type: 'string',
        pattern: '^[a-z]+$',
      });
    });

    it('should extract array attribute rules', () => {
      const schema: SchemaProperty = {
        properties: {
          'array.with.rules': {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 10,
            uniqueItems: true,
          },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all[0].rules).toHaveLength(3);
      expect(result.all[0].rules?.[0]).toMatchObject({
        type: 'array',
        min: 1,
        trigger: 'blur',
      });
      expect(result.all[0].rules?.[1]).toMatchObject({
        type: 'array',
        max: 10,
        trigger: 'blur',
      });
      expect(result.all[0].rules?.[2]).toMatchObject({
        type: 'array',
        unique: true,
        trigger: 'blur',
      });
    });

    it('should handle deeply nested properties', () => {
      const schema: SchemaProperty = {
        properties: {
          'level1': {
            type: 'object',
            properties: {
              'level2': {
                type: 'object',
                properties: {
                  'level3': {
                    type: 'object',
                    properties: {
                      'value': { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all).toHaveLength(1);
      expect(result.all[0].key).toBe('level1.level2.level3.value');
    });

    it('should skip object type properties without nested properties', () => {
      const schema: SchemaProperty = {
        properties: {
          'object.attr': { type: 'object' },
          'normal.attr': { type: 'integer' },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all).toHaveLength(1);
      expect(result.all[0].key).toBe('normal.attr');
    });

    it('should use key as label when label is not provided', () => {
      const schema: SchemaProperty = {
        properties: {
          'attr.without.label': { type: 'string' },
        },
      };
      const configGroups = [{ key: 'all', glob: ['*'] }];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      expect(result.all[0].label).toEqual({
        zh: 'attr.without.label',
        en: 'attr.without.label',
      });
    });

    it('should sort globs by specificity', () => {
      const schema: SchemaProperty = {
        properties: {
          'tile.size': { type: 'integer' },
          'tile.buffer.size': { type: 'integer' },
        },
      };
      const configGroups = [
        { key: 'tile', glob: ['tile.*'] },
        { key: 'tile.buffer', glob: ['tile.buffer.*'] },
      ];
      
      const result = formatSchemaToAttributeGroups(schema, configGroups);
      
      // tile.buffer.size should match tile.buffer group (more specific)
      expect(result['tile.buffer']).toHaveLength(1);
      expect(result['tile.buffer'][0].key).toBe('tile.buffer.size');
      // tile.size should match tile group
      expect(result.tile).toHaveLength(1);
      expect(result.tile[0].key).toBe('tile.size');
    });
  });
});
