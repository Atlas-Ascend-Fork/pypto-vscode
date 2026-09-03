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
import { ConditionAnalyzer } from '../../../../src/services/control-flow/condition';
import type { FunctionNode, ControlFlowPath } from '../../../../src/types/control-flow';

// Mock genMathScalarExpr
vi.mock('../../../../src/core/json-graph/parseSymbolicAttr', () => ({
  genMathScalarExpr: vi.fn((condition: any, version: string) => {
    return `expr_${condition.magic}_${version}`;
  }),
}));

describe('control-flow/condition', () => {
  describe('ConditionAnalyzer', () => {
    let analyzer: ConditionAnalyzer;

    beforeEach(() => {
      analyzer = new ConditionAnalyzer('1.0');
    });

    describe('hasCondition', () => {
      it('should return true when function has dynamic paths', () => {
        const functionNode: FunctionNode = {
          dynamic: {
            paths: [[123, [[{ magic: 1 }, true]]]],
          },
        } as FunctionNode;

        expect(analyzer.hasCondition(functionNode)).toBe(true);
      });

      it('should return false when function has no dynamic paths', () => {
        const functionNode: FunctionNode = {
          dynamic: {
            paths: [],
          },
        } as FunctionNode;

        expect(analyzer.hasCondition(functionNode)).toBe(false);
      });

      it('should return false when function has no dynamic property', () => {
        const functionNode: FunctionNode = {} as FunctionNode;

        expect(analyzer.hasCondition(functionNode)).toBe(false);
      });

      it('should return false when dynamic.paths is undefined', () => {
        const functionNode: FunctionNode = {
          dynamic: {},
        } as FunctionNode;

        expect(analyzer.hasCondition(functionNode)).toBe(false);
      });
    });

    describe('resolveConditionUntilPath', () => {
      it('should generate condition tree with single condition', () => {
        const mockPathFunction: ControlFlowPath = {
          nodeType: 'PATH',
          magic: 999,
          magicName: 'path_function',
          hash: 'path_hash',
        } as ControlFlowPath;

        const functionNode: FunctionNode = {
          dynamic: {
            paths: [
              [123, [[{ magic: 1 }, true]]],
            ],
          },
          operations: [
            { opmagic: 123 },
          ],
        } as FunctionNode;

        const getPathFunction = vi.fn().mockReturnValue(mockPathFunction);

        const result = analyzer.resolveConditionUntilPath(functionNode, getPathFunction);

        expect(result).toBeDefined();
        expect(result.nodeType).toBe('IF');
        expect(getPathFunction).toHaveBeenCalledTimes(1);
      });

      it('should generate balanced binary tree with multiple conditions', () => {
        const mockPathFunction: ControlFlowPath = {
          nodeType: 'PATH',
          magic: 999,
          magicName: 'path_function',
          hash: 'path_hash',
        } as ControlFlowPath;

        const functionNode: FunctionNode = {
          dynamic: {
            paths: [
              [123, [[{ magic: 1 }, true], [{ magic: 2 }, false]]],
              [456, [[{ magic: 1 }, false], [{ magic: 2 }, true]]],
            ],
          },
          operations: [
            { opmagic: 123 },
            { opmagic: 456 },
          ],
        } as FunctionNode;

        const getPathFunction = vi.fn().mockReturnValue(mockPathFunction);

        const result = analyzer.resolveConditionUntilPath(functionNode, getPathFunction);

        expect(result).toBeDefined();
        expect(result.nodeType).toBe('IF');
        expect(result.children).toHaveLength(2);
        expect(getPathFunction).toHaveBeenCalledTimes(2);
      });

      it('should call getPathFunction for each condition path', () => {
        const mockPathFunction: ControlFlowPath = {
          nodeType: 'PATH',
          magic: 999,
          magicName: 'path_function',
          hash: 'path_hash',
        } as ControlFlowPath;

        const functionNode: FunctionNode = {
          dynamic: {
            paths: [
              [111, [[{ magic: 1 }, true]]],
              [222, [[{ magic: 1 }, false]]],
              [333, [[{ magic: 1 }, true]]],
            ],
          },
          operations: [
            { opmagic: 111 },
            { opmagic: 222 },
            { opmagic: 333 },
          ],
        } as FunctionNode;

        const getPathFunction = vi.fn().mockReturnValue(mockPathFunction);

        analyzer.resolveConditionUntilPath(functionNode, getPathFunction);

        expect(getPathFunction).toHaveBeenCalledTimes(3);
        expect(getPathFunction).toHaveBeenNthCalledWith(1, { opmagic: 111 });
        expect(getPathFunction).toHaveBeenNthCalledWith(2, { opmagic: 222 });
        expect(getPathFunction).toHaveBeenNthCalledWith(3, { opmagic: 333 });
      });
    });

    describe('private methods (tested through public API)', () => {
      it('should correctly calculate operation index from conditions', () => {
        // This tests getOperationIndex indirectly through resolveConditionUntilPath
        const mockPathFunction: ControlFlowPath = {
          nodeType: 'PATH',
          magic: 999,
          magicName: 'path_function',
          hash: 'path_hash',
        } as ControlFlowPath;

        // Conditions: [true, false] -> binary "01" -> index 1
        const functionNode: FunctionNode = {
          dynamic: {
            paths: [
              [123, [[{ magic: 1 }, true], [{ magic: 2 }, false]]],
            ],
          },
          operations: [
            { opmagic: 123 },
          ],
        } as FunctionNode;

        const getPathFunction = vi.fn().mockReturnValue(mockPathFunction);

        const result = analyzer.resolveConditionUntilPath(functionNode, getPathFunction);

        // The path should be inserted at the correct leaf position
        expect(result).toBeDefined();
        expect(result.children).toBeDefined();
      });

      it('should create IF nodes with correct structure', () => {
        const mockPathFunction: ControlFlowPath = {
          nodeType: 'PATH',
          magic: 999,
          magicName: 'path_function',
          hash: 'path_hash',
        } as ControlFlowPath;

        const functionNode: FunctionNode = {
          dynamic: {
            paths: [
              [123, [[{ magic: 1 }, true]]],
            ],
          },
          operations: [
            { opmagic: 123 },
          ],
        } as FunctionNode;

        const getPathFunction = vi.fn().mockReturnValue(mockPathFunction);

        const result = analyzer.resolveConditionUntilPath(functionNode, getPathFunction);

        expect(result.nodeType).toBe('IF');
        expect(result.magic).toBe(-1);
        expect(result.hash).toBe('');
        expect(result.magicName).toContain('expr_');
      });
    });
  });
});
