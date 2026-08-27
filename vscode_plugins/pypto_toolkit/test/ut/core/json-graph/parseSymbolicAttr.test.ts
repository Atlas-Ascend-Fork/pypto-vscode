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
import {
  genMathScalarExpr,
  AttrReader,
  parseSymbolicOrIntList,
  parseExprList,
} from '../../../../src/core/json-graph/parseSymbolicAttr';

describe('parseSymbolicAttr', () => {
  describe('genMathScalarExpr', () => {
    it('should return empty string when lineInfo is undefined', () => {
      const result = genMathScalarExpr(undefined, '2.0');
      expect(result).toBe('');
    });

    it('should parse immediate value (S_IMM)', () => {
      // S_IMM = 0, followed by the value
      const lineInfo = [0, 42];
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('42');
    });

    it('should parse symbol name (S_SYM)', () => {
      // S_SYM = 1, followed by the symbol name
      const lineInfo = [1, 'myVar'];
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('myVar');
    });

    it('should parse simple expression (S_EXPR) with add operation', () => {
      // S_EXPR = 2, followed by operation code (3 = ssop_add for version <= 20)
      // For version <= 20: ssop_add = 3
      const lineInfo = [2, 3, 0, 10, 0, 20]; // add(10, 20)
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('(10 + 20)');
    });

    it('should parse nested expressions', () => {
      // add(mul(2, 3), 4)
      // For version <= 20: ssop_add = 3, ssop_mul = 5
      const lineInfo = [2, 3, 2, 5, 0, 2, 0, 3, 0, 4]; // add(mul(2, 3), 4)
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('((2 * 3) + 4)');
    });

    it('should use new operation codes for version > 20', () => {
      // For version > 20: ssop_add = 20
      const lineInfo = [2, 20, 0, 10, 0, 20]; // add(10, 20)
      const result = genMathScalarExpr(lineInfo, '2.1');
      expect(result).toBe('(10 + 20)');
    });

    it('should parse unary operations (pos, neg, not)', () => {
      // For version <= 20: ssop_neg = 1
      const lineInfo = [2, 1, 0, 42]; // neg(42)
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('-42');
    });

    it('should parse ssop_min operation', () => {
      // For version <= 20: ssop_min = 14
      const lineInfo = [2, 14, 0, 10, 0, 20]; // min(10, 20)
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('min(10, 20)');
    });

    it('should parse ssop_max operation', () => {
      // For version <= 20: ssop_max = 15
      const lineInfo = [2, 15, 0, 10, 0, 20]; // max(10, 20)
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('max(10, 20)');
    });

    it('should handle comparison operations', () => {
      // For version <= 20: ssop_lt = 10
      const lineInfo = [2, 10, 0, 10, 0, 20]; // lt(10, 20)
      const result = genMathScalarExpr(lineInfo, '2.0');
      expect(result).toBe('(10 < 20)');
    });

    it('should handle logical operations for version > 20', () => {
      // For version > 20: ssop_and = 31
      const lineInfo = [2, 31, 0, 1, 0, 0]; // and(1, 0)
      const result = genMathScalarExpr(lineInfo, '2.1');
      expect(result).toBe('(1 & 0)');
    });
  });

  describe('AttrReader', () => {
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        comGraphData: { funcHash: 'test-hash' },
        setRef: vi.fn(),
      };
    });

    it('should initialize with correct index', () => {
      const reader = new AttrReader(mockServer, [1, 2, 3]);
      expect(reader.hasNext()).toBe(true);
      expect(reader.readIndex()).toBe(0);
    });

    it('should read numbers correctly', () => {
      const reader = new AttrReader(mockServer, [10, 20, 30]);
      expect(reader.readNumber()).toBe(10);
      expect(reader.readNumber()).toBe(20);
      expect(reader.readNumber()).toBe(30);
      expect(reader.hasNext()).toBe(false);
    });

    it('should return NaN when reading past end', () => {
      const reader = new AttrReader(mockServer, []);
      const result = reader.readNumber();
      expect(result).toBeNaN();
    });

    it('should read string or number array correctly', () => {
      const reader = new AttrReader(mockServer, [[1, 2, 3], [4, 5]]);
      const result1 = reader.readStringOrNumberArray();
      expect(result1).toEqual([1, 2, 3]);
      const result2 = reader.readStringOrNumberArray();
      expect(result2).toEqual([4, 5]);
    });

    it('should return undefined when reading array past end', () => {
      const reader = new AttrReader(mockServer, []);
      const result = reader.readStringOrNumberArray();
      expect(result).toBeUndefined();
    });

    it('should read optional number correctly', () => {
      const reader = new AttrReader(mockServer, [10, 20]);
      expect(reader.readOptionalNumber()).toBe(10);
      expect(reader.readOptionalNumber()).toBe(20);
      expect(reader.readOptionalNumber()).toBeNull();
    });

    it('should track index correctly', () => {
      const reader = new AttrReader(mockServer, [1, 2, 3]);
      expect(reader.readIndex()).toBe(0);
      reader.readNumber();
      expect(reader.readIndex()).toBe(1);
      reader.readNumber();
      expect(reader.readIndex()).toBe(2);
    });
  });

  describe('parseSymbolicOrIntList', () => {
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        comGraphData: { funcHash: 'test-hash' },
        setRef: vi.fn(),
      };
    });

    it('should parse integer list', () => {
      const reader = new AttrReader(mockServer, [2, 10, 2, 20]); // kind=2 (integer), value=10, kind=2, value=20
      const result = parseSymbolicOrIntList(reader, 2, '2.0');
      expect(result).toEqual(['10', '20']);
    });

    it('should parse symbolic list', () => {
      // kind=1 (symbolic), followed by expression [0, 42] (immediate value 42)
      const reader = new AttrReader(mockServer, [1, [0, 42], 1, [0, 100]]);
      const result = parseSymbolicOrIntList(reader, 2, '2.0');
      expect(result).toEqual(['42', '100']);
    });

    it('should handle mixed symbolic and integer list', () => {
      const reader = new AttrReader(mockServer, [2, 10, 1, [0, 20]]);
      const result = parseSymbolicOrIntList(reader, 2, '2.0');
      expect(result).toEqual(['10', '20']);
    });

    it('should return empty array for invalid kind', () => {
      const reader = new AttrReader(mockServer, [3, 10]); // invalid kind=3
      const result = parseSymbolicOrIntList(reader, 1, '2.0');
      expect(result).toEqual([]);
    });
  });

  describe('parseExprList', () => {
    let mockServer: any;

    beforeEach(() => {
      mockServer = {
        comGraphData: { funcHash: 'test-hash' },
        setRef: vi.fn(),
      };
    });

    it('should parse expression list', () => {
      // Two expressions: [0, 42] and [0, 100]
      const reader = new AttrReader(mockServer, [[0, 42], [0, 100]]);
      const result = parseExprList(reader, 2, '2.0');
      expect(result).toEqual(['42', '100']);
    });

    it('should parse complex expressions', () => {
      // Expression: add(10, 20) = [2, 3, 0, 10, 0, 20] for version <= 20
      const reader = new AttrReader(mockServer, [[2, 3, 0, 10, 0, 20]]);
      const result = parseExprList(reader, 1, '2.0');
      expect(result).toEqual(['(10 + 20)']);
    });

    it('should handle empty expression list', () => {
      const reader = new AttrReader(mockServer, []);
      const result = parseExprList(reader, 0, '2.0');
      expect(result).toEqual([]);
    });
  });
});
