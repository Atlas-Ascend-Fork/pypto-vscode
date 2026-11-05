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
import { describe, it, expect, beforeEach } from 'vitest';
import { FlowTreeAnalyzer } from '../../../../src/services/control-flow/flow-tree';
import { FunctionType } from '../../../../src/types/control-flow';
import type { ProgramOutput, FunctionNode, ControlFlowPath } from '../../../../src/types/control-flow';
import type { PassDirectory } from '../../../../src/types/workspace';

describe('control-flow/flow-tree', () => {
  describe('FlowTreeAnalyzer', () => {
    let program: ProgramOutput;
    let passes: PassDirectory[];

    beforeEach(() => {
      passes = [];
    });

    describe('constructor', () => {
      it('should initialize with program and passes', () => {
        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        expect(analyzer).toBeDefined();
      });

      it('should populate function maps from program', () => {
        const functionNode: FunctionNode = {
          hash: 'func_hash',
          funcmagic: 123,
          rawname: 'test_function',
          functype: FunctionType.PATH,
          operations: [],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'func_hash',
          functions: [functionNode],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        expect(analyzer).toBeDefined();
      });
    });

    describe('getControlFlow', () => {
      it('should generate control flow from entry function with PATH callee', () => {
        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 200,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 1 }],
          programs: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, pathFunction],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(1);
        expect(result[0].nodeType).toBe('PATH');
      });

      it('should generate control flow from entry function with DYNAMIC callee', () => {
        const dynamicFunction: FunctionNode = {
          hash: 'dynamic_hash',
          funcmagic: 200,
          rawname: 'dynamic_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
        } as FunctionNode;

        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 300,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 2 }],
          programs: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'dynamic_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, dynamicFunction, pathFunction],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(1);
        expect(result[0].nodeType).toBe('LOOP');
      });

      it('should handle DYNAMIC function with conditions', () => {
        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 300,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 2 }],
          programs: [],
        } as FunctionNode;

        const dynamicFunction: FunctionNode = {
          hash: 'dynamic_hash',
          funcmagic: 200,
          rawname: 'dynamic_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
          dynamic: {
            paths: [
              [1, [[['condition_expr'], true]]],
            ],
          },
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'dynamic_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, dynamicFunction, pathFunction],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(1);
        expect(result[0].nodeType).toBe('LOOP');
        const loopNode = result[0] as any;
        expect(loopNode.children).toHaveLength(1);
        expect(loopNode.children[0].nodeType).toBe('IF');
      });

      it('should handle PATH function with all leaf operations', () => {
        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 200,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          operations: [
            { opmagic: 1 },
            { opmagic: 2 },
          ],
          programs: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, pathFunction],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(1);
        expect(result[0].nodeType).toBe('PATH');
      });

      it('should build PATH stats from root sub-function when wrapper only holds VIEW/ASSEMBLE/CALL ops (new program format)', () => {
        const leaf0: FunctionNode = {
          hash: 'leaf0_hash',
          funcmagic: 14,
          rawname: 'kernel_PATH0_hiddenfunc_leaf0',
          functype: 1 as FunctionType,
          operations: [{ opmagic: 1 }],
        } as FunctionNode;

        const leaf1: FunctionNode = {
          hash: 'leaf1_hash',
          funcmagic: 16,
          rawname: 'kernel_PATH0_hiddenfunc_leaf2',
          functype: 1 as FunctionType,
          operations: [{ opmagic: 2 }],
        } as FunctionNode;

        const rootFunction: FunctionNode = {
          hash: 'root_hash',
          funcmagic: 13,
          rawname: 'kernel_PATH0_hiddenfunc_root',
          functype: FunctionType.PATH,
          operations: [
            { opmagic: 3, calleehash: 'leaf0_hash' },
            { opmagic: 4, calleehash: 'leaf0_hash' },
            { opmagic: 5, calleehash: 'leaf1_hash' },
          ],
          programs: [14, 16],
        } as FunctionNode;

        const pathWrapperFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 9,
          rawname: 'kernel_PATH0',
          functype: FunctionType.PATH,
          operations: [
            { opmagic: 11 },
            { opmagic: 12, calleehash: 'root_hash' },
            { opmagic: 13 },
          ],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 3,
          rawname: 'kernel',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 21, calleehash: 'path_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '2.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, pathWrapperFunction, rootFunction, leaf0, leaf1],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(1);
        expect(result[0].nodeType).toBe('PATH');
        const pathNode = result[0] as ControlFlowPath;
        // PATH节点身份保持为外层包装函数
        expect(pathNode.hash).toBe('path_hash');
        // leaf函数个数来自root子函数programs
        expect(pathNode.meta.leafFunctions).toHaveLength(2);
        // 调用leaf次数来自root子函数CALL操作
        expect(pathNode.meta.calleeRecords).toHaveLength(3);
        // leaf被调用次数由calculateLeafFunctionCalledRecords计算
        expect(pathNode.meta.calledRecords).toHaveLength(3);
      });

      it('should handle PATH function with all dynamic operations', () => {
        const dynamic1: FunctionNode = {
          hash: 'dynamic1_hash',
          funcmagic: 300,
          rawname: 'dynamic1',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 2, calleehash: 'path1_hash' },
          ],
        } as FunctionNode;

        const dynamic2: FunctionNode = {
          hash: 'dynamic2_hash',
          funcmagic: 400,
          rawname: 'dynamic2',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 3, calleehash: 'path2_hash' },
          ],
        } as FunctionNode;

        const path1: FunctionNode = {
          hash: 'path1_hash',
          funcmagic: 500,
          rawname: 'path1',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 4 }],
          programs: [],
        } as FunctionNode;

        const path2: FunctionNode = {
          hash: 'path2_hash',
          funcmagic: 600,
          rawname: 'path2',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 5 }],
          programs: [],
        } as FunctionNode;

        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 200,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          operations: [
            { opmagic: 1, calleehash: 'dynamic1_hash' },
            { opmagic: 2, calleehash: 'dynamic2_hash' },
          ],
          programs: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, pathFunction, dynamic1, dynamic2, path1, path2],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(2);
        expect(result[0].nodeType).toBe('LOOP');
        expect(result[1].nodeType).toBe('LOOP');
      });

      it('should handle mixed operations with leaf-first and graphtype 2', () => {
        const pathInside: FunctionNode = {
          hash: 'path_inside_hash',
          funcmagic: 400,
          rawname: 'path_inside',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 9 }],
          programs: [],
        } as FunctionNode;

        const dynamicCallee: FunctionNode = {
          hash: 'dyn_hash',
          funcmagic: 300,
          rawname: 'dyn_func',
          functype: FunctionType.DYNAMIC,
          operations: [{ opmagic: 9, calleehash: 'path_inside_hash' }],
        } as FunctionNode;

        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 200,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          graphtype: 2,
          operations: [
            { opmagic: 1 },
            { opmagic: 2, calleehash: 'dyn_hash' },
          ],
          programs: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, pathFunction, dynamicCallee, pathInside],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(2);
        expect(result[0].nodeType).toBe('PATH');
        expect(result[1].nodeType).toBe('LOOP');
      });

      it('should treat mixed operations as dynamic when first operation is dynamic', () => {
        const pathInside: FunctionNode = {
          hash: 'path_inside_hash',
          funcmagic: 400,
          rawname: 'path_inside',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 9 }],
          programs: [],
        } as FunctionNode;

        const dynamicCallee: FunctionNode = {
          hash: 'dyn_hash',
          funcmagic: 300,
          rawname: 'dyn_func',
          functype: FunctionType.DYNAMIC,
          operations: [{ opmagic: 9, calleehash: 'path_inside_hash' }],
        } as FunctionNode;

        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 200,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          operations: [
            { opmagic: 1, calleehash: 'dyn_hash' },
            { opmagic: 2, calleehash: 'path_inside_hash' },
          ],
          programs: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, pathFunction, dynamicCallee, pathInside],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(2);
        expect(result[0].nodeType).toBe('LOOP');
        expect(result[1].nodeType).toBe('PATH');
      });

      it('should handle multiple operations in entry function', () => {
        const path1: FunctionNode = {
          hash: 'path1_hash',
          funcmagic: 200,
          rawname: 'path1',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 1 }],
          programs: [],
        } as FunctionNode;

        const path2: FunctionNode = {
          hash: 'path2_hash',
          funcmagic: 300,
          rawname: 'path2',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 2 }],
          programs: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path1_hash' },
            { opmagic: 2, calleehash: 'path2_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, path1, path2],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(2);
        expect(result[0].nodeType).toBe('PATH');
        expect(result[1].nodeType).toBe('PATH');
      });

      it('should throw error for unknown function type', () => {
        const unknownFunction: FunctionNode = {
          hash: 'unknown_hash',
          funcmagic: 200,
          rawname: 'unknown_function',
          functype: 999 as FunctionType,
          operations: [],
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'unknown_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, unknownFunction],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        
        expect(() => analyzer.getControlFlow()).toThrow();
      });

      it('should include source code info for DYNAMIC functions', () => {
        const pathFunction: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 300,
          rawname: 'path_function',
          functype: FunctionType.PATH,
          operations: [{ opmagic: 2 }],
          programs: [],
        } as FunctionNode;

        const dynamicFunction: FunctionNode = {
          hash: 'dynamic_hash',
          funcmagic: 200,
          rawname: 'dynamic_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'path_hash' },
          ],
          file: '/path/to/source.py',
          line: 50,
        } as FunctionNode;

        const entryFunction: FunctionNode = {
          hash: 'entry_hash',
          funcmagic: 100,
          rawname: 'entry_function',
          functype: FunctionType.DYNAMIC,
          operations: [
            { opmagic: 1, calleehash: 'dynamic_hash' },
          ],
        } as FunctionNode;

        program = {
          version: '1.0',
          entryhash: 'entry_hash',
          functions: [entryFunction, dynamicFunction, pathFunction],
        } as ProgramOutput;

        const analyzer = new FlowTreeAnalyzer(program, passes);
        const result = analyzer.getControlFlow();

        expect(result).toHaveLength(1);
        const loopNode = result[0] as any;
        expect(loopNode.sourceCode).toBeDefined();
        expect(loopNode.sourceCode.filePath).toBe('/path/to/source.py');
        expect(loopNode.sourceCode.line).toBe(50);
        expect(loopNode.sourceCode.language).toBe('python');
      });
    });
  });
});
