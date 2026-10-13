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
import { PathLeafAnalyzer } from '../../../../src/services/control-flow/path-leaf';
import type { FunctionNode } from '../../../../src/types/control-flow';
import type { PassDirectory } from '../../../../src/types/workspace';

describe('control-flow/path-leaf', () => {
  describe('PathLeafAnalyzer', () => {
    let functionHashMap: Map<string, FunctionNode>;
    let functionMagicMap: Map<number, FunctionNode>;
    let passes: PassDirectory[];

    beforeEach(() => {
      functionHashMap = new Map();
      functionMagicMap = new Map();
      passes = [];
    });

    describe('constructor', () => {
      it('should initialize with empty maps', () => {
        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        expect(analyzer).toBeDefined();
      });

      it('should initialize with populated maps', () => {
        const functionNode: FunctionNode = {
          hash: 'hash1',
          funcmagic: 123,
          rawname: 'test_function',
        } as FunctionNode;

        functionHashMap.set('hash1', functionNode);
        functionMagicMap.set(123, functionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        expect(analyzer).toBeDefined();
      });

      it('should scan passes during initialization', () => {
        const mockPass: PassDirectory = {
          name: 'Pass_01',
          passStage: 'TENSOR_GRAPH',
          children: [
            {
              computeType: 'root',
              pathName: 'test_path',
              absolutePath: '/path/to/graph.json',
              passIndex: 1,
              hasHealthReport: false,
            } as any,
          ],
        } as PassDirectory;

        passes.push(mockPass);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        expect(analyzer).toBeDefined();
      });
    });

    describe('makePathFunction', () => {
      it('should create PATH node with basic function node', () => {
        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'path_function',
          operations: [{ opmagic: 1 }],
          programs: [],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionMagicMap.set(100, pathFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const result = analyzer.makePathFunction(pathFunctionNode);

        expect(result.nodeType).toBe('PATH');
        expect(result.magic).toBe(100);
        expect(result.magicName).toBe('path_function');
        expect(result.hash).toBe('path_hash');
        expect(result.meta).toBeDefined();
        expect(result.meta.leafFunctions).toEqual([]);
        expect(result.meta.calledRecords).toEqual([]);
        expect(result.meta.calleeRecords).toEqual([]);
        expect(result.meta.passes).toEqual([]);
      });

      it('should create PATH node with leaf functions', () => {
        const leafFunctionNode: FunctionNode = {
          hash: 'leaf_hash',
          funcmagic: 200,
          rawname: 'leaf_function',
        } as FunctionNode;

        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'path_function',
          operations: [{ opmagic: 1 }],
          programs: [200],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionHashMap.set('leaf_hash', leafFunctionNode);
        functionMagicMap.set(100, pathFunctionNode);
        functionMagicMap.set(200, leafFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const result = analyzer.makePathFunction(pathFunctionNode);

        expect(result.meta.leafFunctions).toHaveLength(1);
        expect(result.meta.leafFunctions[0].hash).toBe('leaf_hash');
        expect(result.meta.leafFunctions[0].magic).toBe(200);
        expect(result.meta.leafFunctions[0].programId).toBe('00');
      });

      it('should create PATH node with callee records', () => {
        const calleeFunctionNode: FunctionNode = {
          hash: 'callee_hash',
          funcmagic: 300,
          rawname: 'callee_function',
        } as FunctionNode;

        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'path_function',
          operations: [
            { opmagic: 1, calleehash: 'callee_hash' },
          ],
          programs: [],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionHashMap.set('callee_hash', calleeFunctionNode);
        functionMagicMap.set(100, pathFunctionNode);
        functionMagicMap.set(300, calleeFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const result = analyzer.makePathFunction(pathFunctionNode);

        expect(result.meta.calleeRecords).toHaveLength(1);
        expect(result.meta.calleeRecords[0].calleeHash).toBe('callee_hash');
        expect(result.meta.calleeRecords[0].callerHash).toBe('path_hash');
      });

      it('should handle multiple leaf functions', () => {
        const leaf1: FunctionNode = {
          hash: 'leaf1_hash',
          funcmagic: 201,
          rawname: 'leaf1',
        } as FunctionNode;

        const leaf2: FunctionNode = {
          hash: 'leaf2_hash',
          funcmagic: 202,
          rawname: 'leaf2',
        } as FunctionNode;

        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'path_function',
          operations: [{ opmagic: 1 }],
          programs: [201, 202],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionHashMap.set('leaf1_hash', leaf1);
        functionHashMap.set('leaf2_hash', leaf2);
        functionMagicMap.set(100, pathFunctionNode);
        functionMagicMap.set(201, leaf1);
        functionMagicMap.set(202, leaf2);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const result = analyzer.makePathFunction(pathFunctionNode);

        expect(result.meta.leafFunctions).toHaveLength(2);
        expect(result.meta.leafFunctions[0].programId).toBe('00');
        expect(result.meta.leafFunctions[1].programId).toBe('01');
      });
    });

    describe('calculateLeafFunctionCalledRecords', () => {
      it('should calculate called records for leaf functions', () => {
        const leafFunctionNode: FunctionNode = {
          hash: 'leaf_hash',
          funcmagic: 200,
          rawname: 'leaf_function',
        } as FunctionNode;

        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'path_function',
          operations: [
            { opmagic: 1, calleehash: 'leaf_hash' },
          ],
          programs: [200],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionHashMap.set('leaf_hash', leafFunctionNode);
        functionMagicMap.set(100, pathFunctionNode);
        functionMagicMap.set(200, leafFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const pathFunction = analyzer.makePathFunction(pathFunctionNode);
        
        analyzer.calculateLeafFunctionCalledRecords();

        expect(pathFunction.meta.calledRecords).toHaveLength(1);
        expect(pathFunction.meta.calledRecords[0].callerHash).toBe('path_hash');
        expect(pathFunction.meta.calledRecords[0].calleeHash).toBe('leaf_hash');
      });

      it('should handle multiple path functions calling same leaf', () => {
        const leafFunctionNode: FunctionNode = {
          hash: 'leaf_hash',
          funcmagic: 200,
          rawname: 'leaf_function',
        } as FunctionNode;

        const path1: FunctionNode = {
          hash: 'path1_hash',
          funcmagic: 100,
          rawname: 'path1',
          operations: [
            { opmagic: 1, calleehash: 'leaf_hash' },
          ],
          programs: [200],
        } as FunctionNode;

        const path2: FunctionNode = {
          hash: 'path2_hash',
          funcmagic: 101,
          rawname: 'path2',
          operations: [
            { opmagic: 2, calleehash: 'leaf_hash' },
          ],
          programs: [200],
        } as FunctionNode;

        functionHashMap.set('path1_hash', path1);
        functionHashMap.set('path2_hash', path2);
        functionHashMap.set('leaf_hash', leafFunctionNode);
        functionMagicMap.set(100, path1);
        functionMagicMap.set(101, path2);
        functionMagicMap.set(200, leafFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const pathFunction1 = analyzer.makePathFunction(path1);
        const pathFunction2 = analyzer.makePathFunction(path2);
        
        analyzer.calculateLeafFunctionCalledRecords();

        // Both path functions call the same leaf, so each should have 2 called records
        // (one from path1 calling it, one from path2 calling it)
        expect(pathFunction1.meta.calledRecords).toHaveLength(2);
        expect(pathFunction2.meta.calledRecords).toHaveLength(2);
      });

      it('should handle empty path functions', () => {
        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        
        expect(() => analyzer.calculateLeafFunctionCalledRecords()).not.toThrow();
      });
    });

    describe('pass scanning', () => {
      it('should scan passes with root compute graphs', () => {
        const mockPass: PassDirectory = {
          name: 'Pass_01',
          passStage: 'TENSOR_GRAPH',
          children: [
            {
              computeType: 'root',
              pathName: 'test_path',
              absolutePath: '/path/to/root.json',
              passIndex: 1,
              hasHealthReport: false,
            } as any,
          ],
        } as PassDirectory;

        passes.push(mockPass);

        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'test_path',
          operations: [{ opmagic: 1 }],
          programs: [],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionMagicMap.set(100, pathFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const result = analyzer.makePathFunction(pathFunctionNode);

        expect(result.meta.passes).toHaveLength(1);
        expect(result.meta.passes[0].passName).toBe('Pass_01');
        expect(result.meta.passes[0].pathName).toBe('test_path');
      });

      it('should handle passes with leaf compute graphs', () => {
        const leafFunctionNode: FunctionNode = {
          hash: 'leaf_hash',
          funcmagic: 200,
          rawname: 'leaf_function',
        } as FunctionNode;

        const mockPass: PassDirectory = {
          name: 'Pass_01',
          passStage: 'TENSOR_GRAPH',
          children: [
            {
              computeType: 'root',
              pathName: 'test_path',
              absolutePath: '/path/to/root.json',
              passIndex: 1,
              hasHealthReport: false,
            } as any,
            {
              computeType: 'leaf',
              pathName: 'test_path',
              leafHash: 'leaf_hash',
              leafProgramId: '00',
              absolutePath: '/path/to/leaf.json',
              name: 'leaf_file.json',
              passIndex: 1,
              hasHealthReport: false,
            } as any,
          ],
        } as PassDirectory;

        passes.push(mockPass);

        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'test_path',
          operations: [
            { opmagic: 1, calleehash: 'leaf_hash' },
          ],
          programs: [200],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionHashMap.set('leaf_hash', leafFunctionNode);
        functionMagicMap.set(100, pathFunctionNode);
        functionMagicMap.set(200, leafFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const result = analyzer.makePathFunction(pathFunctionNode);

        expect(result.meta.passes).toHaveLength(1);
        expect(result.meta.passes[0].leafFunctions).toHaveLength(1);
      });

      it('should handle multiple passes', () => {
        const pass1: PassDirectory = {
          name: 'Pass_01',
          passStage: 'TENSOR_GRAPH',
          children: [
            {
              computeType: 'root',
              pathName: 'test_path',
              absolutePath: '/path/to/pass1.json',
              passIndex: 1,
              hasHealthReport: false,
            } as any,
          ],
        } as PassDirectory;

        const pass2: PassDirectory = {
          name: 'Pass_02',
          passStage: 'BUFFER_FUSION',
          children: [
            {
              computeType: 'root',
              pathName: 'test_path',
              absolutePath: '/path/to/pass2.json',
              passIndex: 2,
              hasHealthReport: true,
            } as any,
          ],
        } as PassDirectory;

        passes.push(pass1, pass2);

        const pathFunctionNode: FunctionNode = {
          hash: 'path_hash',
          funcmagic: 100,
          rawname: 'test_path',
          operations: [{ opmagic: 1 }],
          programs: [],
        } as FunctionNode;

        functionHashMap.set('path_hash', pathFunctionNode);
        functionMagicMap.set(100, pathFunctionNode);

        const analyzer = new PathLeafAnalyzer(functionHashMap, functionMagicMap, passes);
        const result = analyzer.makePathFunction(pathFunctionNode);

        expect(result.meta.passes).toHaveLength(2);
        expect(result.meta.passes[0].passName).toBe('Pass_01');
        expect(result.meta.passes[1].passName).toBe('Pass_02');
        expect(result.meta.passes[1].hasHealthReport).toBe(true);
      });
    });
  });
});
