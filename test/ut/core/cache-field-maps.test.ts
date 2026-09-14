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
import { describe, it, expect } from 'vitest';
import {
  ACCURACY_TOOL_FIELDS,
  ACCURACY_TOOL_CMP_FIELDS,
  TASK_CMP_FIELDS,
  extractParams,
} from '../../../src/core/cache-field-maps';

describe('cache-field-maps', () => {
  describe('ACCURACY_TOOL_FIELDS', () => {
    it('should have correct number of fields', () => {
      expect(ACCURACY_TOOL_FIELDS).toHaveLength(31);
    });

    it('should start with filePath', () => {
      expect(ACCURACY_TOOL_FIELDS[0]).toBe('filePath');
    });

    it('should end with bTimestamp', () => {
      expect(ACCURACY_TOOL_FIELDS[ACCURACY_TOOL_FIELDS.length - 1]).toBe('bTimestamp');
    });

    it('should contain all required fields', () => {
      expect(ACCURACY_TOOL_FIELDS).toContain('no');
      expect(ACCURACY_TOOL_FIELDS).toContain('phaseName');
      expect(ACCURACY_TOOL_FIELDS).toContain('funcMagicName');
      expect(ACCURACY_TOOL_FIELDS).toContain('rawMagic');
      expect(ACCURACY_TOOL_FIELDS).toContain('result');
      expect(ACCURACY_TOOL_FIELDS).toContain('mre');
      expect(ACCURACY_TOOL_FIELDS).toContain('mae');
    });
  });

  describe('ACCURACY_TOOL_CMP_FIELDS', () => {
    it('should have correct number of fields', () => {
      expect(ACCURACY_TOOL_CMP_FIELDS).toHaveLength(51);
    });

    it('should start with filePath', () => {
      expect(ACCURACY_TOOL_CMP_FIELDS[0]).toBe('filePath');
    });

    it('should end with bTimestamp', () => {
      expect(ACCURACY_TOOL_CMP_FIELDS[ACCURACY_TOOL_CMP_FIELDS.length - 1]).toBe('bTimestamp');
    });

    it('should contain comparison-specific fields', () => {
      expect(ACCURACY_TOOL_CMP_FIELDS).toContain('aOpMagic');
      expect(ACCURACY_TOOL_CMP_FIELDS).toContain('bOpMagic');
      expect(ACCURACY_TOOL_CMP_FIELDS).toContain('abResult');
      expect(ACCURACY_TOOL_CMP_FIELDS).toContain('abMre');
    });
  });

  describe('TASK_CMP_FIELDS', () => {
    it('should have correct number of fields', () => {
      expect(TASK_CMP_FIELDS).toHaveLength(54);
    });

    it('should start with sourceFileName', () => {
      expect(TASK_CMP_FIELDS[0]).toBe('sourceFileName');
    });

    it('should end with bInfnan', () => {
      expect(TASK_CMP_FIELDS[TASK_CMP_FIELDS.length - 1]).toBe('bInfnan');
    });

    it('should contain task-specific fields', () => {
      expect(TASK_CMP_FIELDS).toContain('ioFlag');
      expect(TASK_CMP_FIELDS).toContain('rootCallOpmagic');
      expect(TASK_CMP_FIELDS).toContain('bTaskId');
      expect(TASK_CMP_FIELDS).toContain('bExecTimestamp');
    });
  });

  describe('extractParams', () => {
    it('should extract params from object in field order', () => {
      const fields = ['name', 'age', 'city'] as const;
      const data = { name: 'Alice', age: '30', city: 'Beijing' };
      const result = extractParams(fields, data);
      expect(result).toEqual(['Alice', '30', 'Beijing']);
    });

    it('should use empty string for missing fields', () => {
      const fields = ['name', 'age', 'city'] as const;
      const data = { name: 'Alice', city: 'Beijing' };
      const result = extractParams(fields, data);
      expect(result).toEqual(['Alice', '', 'Beijing']);
    });

    it('should use empty string for undefined fields', () => {
      const fields = ['name', 'age', 'city'] as const;
      const data = { name: 'Alice', age: undefined, city: 'Beijing' };
      const result = extractParams(fields, data);
      expect(result).toEqual(['Alice', '', 'Beijing']);
    });

    it('should handle empty fields array', () => {
      const fields = [] as const;
      const data = { name: 'Alice', age: '30' };
      const result = extractParams(fields, data);
      expect(result).toEqual([]);
    });

    it('should handle empty data object', () => {
      const fields = ['name', 'age'] as const;
      const data = {};
      const result = extractParams(fields, data);
      expect(result).toEqual(['', '']);
    });

    it('should ignore extra fields in data', () => {
      const fields = ['name', 'age'] as const;
      const data = { name: 'Alice', age: '30', extra: 'ignored' };
      const result = extractParams(fields, data);
      expect(result).toEqual(['Alice', '30']);
    });

    it('should work with ACCURACY_TOOL_FIELDS', () => {
      const data = {
        filePath: '/test/path',
        no: '1',
        phaseName: 'phase1',
        funcMagicName: 'func1',
        rawMagic: '100',
        result: 'PASS',
      };
      const result = extractParams(ACCURACY_TOOL_FIELDS, data);
      expect(result[0]).toBe('/test/path');
      expect(result[1]).toBe('1');
      expect(result[2]).toBe('phase1');
      expect(result[3]).toBe('func1');
      expect(result[4]).toBe('100');
      expect(result[5]).toBe('PASS');
      // Remaining fields should be empty strings
      expect(result[6]).toBe('');
    });

    it('should work with ACCURACY_TOOL_CMP_FIELDS', () => {
      const data = {
        filePath: '/test/path',
        no: '1',
        aOpMagic: '10',
        bOpMagic: '20',
        abResult: 'FAIL',
      };
      const result = extractParams(ACCURACY_TOOL_CMP_FIELDS, data);
      expect(result[0]).toBe('/test/path');
      expect(result[1]).toBe('1');
      // aOpMagic is at index 8
      expect(result[8]).toBe('10');
      // bOpMagic is at index 25
      expect(result[25]).toBe('20');
    });

    it('should work with TASK_CMP_FIELDS', () => {
      const data = {
        sourceFileName: 'test.py',
        no: '1',
        phaseName: 'phase1',
        bTaskId: '100',
      };
      const result = extractParams(TASK_CMP_FIELDS, data);
      expect(result[0]).toBe('test.py');
      expect(result[1]).toBe('1');
      expect(result[2]).toBe('phase1');
      // bTaskId is at index 28
      expect(result[28]).toBe('100');
    });

    it('should convert non-string values to strings', () => {
      const fields = ['count', 'active'] as const;
      const data = { count: 42, active: true };
      const result = extractParams(fields, data);
      // Note: extractParams casts to string | undefined, so numbers/booleans become strings
      expect(result[0]).toBe(42);
      expect(result[1]).toBe(true);
    });
  });
});
