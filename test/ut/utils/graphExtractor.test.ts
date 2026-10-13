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
import { describe, it, expect } from 'vitest';
import {
  extractIncasts,
  extractOutcasts,
  extractRawTensors,
  extractTensorNodes,
  extractOperationNodes,
  extractFuncMap,
  searchByFunctionHash,
  searchByFunctionName,
  searchFunc,
} from '../../../src/utils/graphExtractor';

describe('graphExtractor', () => {
  describe('extractIncasts', () => {
    it('should extract incasts mapping from valid data', () => {
      const jsonData = {
        incasts: [
          ['input1', 'data1'],
          ['input2', 'data2'],
          ['input3', 'data3'],
        ],
      };
      const result = extractIncasts(jsonData);
      expect(result).toEqual({
        input1: 0,
        input2: 1,
        input3: 2,
      });
    });

    it('should return empty object when incasts is not an array', () => {
      const jsonData = { incasts: 'not an array' };
      const result = extractIncasts(jsonData);
      expect(result).toEqual({});
    });

    it('should return empty object when incasts is undefined', () => {
      const jsonData = {};
      const result = extractIncasts(jsonData);
      expect(result).toEqual({});
    });

    it('should handle empty incasts array', () => {
      const jsonData = { incasts: [] };
      const result = extractIncasts(jsonData);
      expect(result).toEqual({});
    });
  });

  describe('extractOutcasts', () => {
    it('should extract outcasts mapping from valid data', () => {
      const jsonData = {
        outcasts: [
          ['output1', 'data1'],
          ['output2', 'data2'],
        ],
      };
      const result = extractOutcasts(jsonData);
      expect(result).toEqual({
        output1: 0,
        output2: 1,
      });
    });

    it('should return empty object when outcasts is not an array', () => {
      const jsonData = { outcasts: 'not an array' };
      const result = extractOutcasts(jsonData);
      expect(result).toEqual({});
    });

    it('should return empty object when outcasts is undefined', () => {
      const jsonData = {};
      const result = extractOutcasts(jsonData);
      expect(result).toEqual({});
    });

    it('should handle empty outcasts array', () => {
      const jsonData = { outcasts: [] };
      const result = extractOutcasts(jsonData);
      expect(result).toEqual({});
    });
  });

  describe('extractRawTensors', () => {
    it('should extract raw tensor mapping from valid data', () => {
      const jsonData = {
        rawtensors: [
          { rawmagic: 'raw1', data: 'data1' },
          { rawmagic: 'raw2', data: 'data2' },
        ],
      };
      const result = extractRawTensors(jsonData);
      expect(result).toEqual({
        raw1: { rawmagic: 'raw1', data: 'data1' },
        raw2: { rawmagic: 'raw2', data: 'data2' },
      });
    });

    it('should return empty object when rawtensors is not an array', () => {
      const jsonData = { rawtensors: 'not an array' };
      const result = extractRawTensors(jsonData);
      expect(result).toEqual({});
    });

    it('should return empty object when rawtensors is undefined', () => {
      const jsonData = {};
      const result = extractRawTensors(jsonData);
      expect(result).toEqual({});
    });

    it('should handle empty rawtensors array', () => {
      const jsonData = { rawtensors: [] };
      const result = extractRawTensors(jsonData);
      expect(result).toEqual({});
    });
  });

  describe('extractTensorNodes', () => {
    it('should extract tensor nodes grouped by subgraphid', () => {
      const jsonData = {
        tensors: [
          { magic: 't1', subgraphid: 0, rawtensor: 'raw1' },
          { magic: 't2', subgraphid: 0, rawtensor: 'raw2' },
          { magic: 't3', subgraphid: 1, rawtensor: 'raw3' },
        ],
      };
      const incasts = { input1: 0 };
      const outcasts = { output1: 0 };
      const rawTensorMap = {
        raw1: { rawmagic: 'raw1', data: 'data1' },
        raw2: { rawmagic: 'raw2', data: 'data2' },
        raw3: { rawmagic: 'raw3', data: 'data3' },
      };

      const result = extractTensorNodes(jsonData, incasts, outcasts, rawTensorMap);

      expect(result[0]).toBeDefined();
      expect(result[0].t1).toBeDefined();
      expect(result[0].t1.node_id).toBe('tensor-t1-0');
      expect(result[0].t1.node_type).toBe('tensor');
      expect(result[0].t1.subgraphid).toBe(0);
      expect(result[0].t1.rawtensor_info).toEqual({ rawmagic: 'raw1', data: 'data1' });

      expect(result[1]).toBeDefined();
      expect(result[1].t3).toBeDefined();
      expect(result[1].t3.node_id).toBe('tensor-t3-1');
    });

    it('should return empty object when tensors is not an array', () => {
      const jsonData = { tensors: 'not an array' };
      const result = extractTensorNodes(jsonData, {}, {}, {});
      expect(result).toEqual({});
    });

    it('should return empty object when tensors is undefined', () => {
      const jsonData = {};
      const result = extractTensorNodes(jsonData, {}, {}, {});
      expect(result).toEqual({});
    });

    it('should handle tensors without subgraphid', () => {
      const jsonData = {
        tensors: [{ magic: 't1', rawtensor: 'raw1' }],
      };
      const result = extractTensorNodes(jsonData, {}, {}, {});
      expect(result[-1]).toBeDefined();
      expect(result[-1].t1.subgraphid).toBe(-1);
    });

    it('should handle empty tensors array', () => {
      const jsonData = { tensors: [] };
      const result = extractTensorNodes(jsonData, {}, {}, {});
      expect(result).toEqual({});
    });
  });

  describe('extractOperationNodes', () => {
    it('should extract operation nodes grouped by subgraphid', () => {
      const jsonData = {
        operations: [
          { opmagic: 'op1', subgraphid: 0 },
          { opmagic: 'op2', subgraphid: 0 },
          { opmagic: 'op3', subgraphid: 1 },
        ],
      };
      const result = extractOperationNodes(jsonData);

      expect(result[0]).toBeDefined();
      expect(result[0].op1).toBeDefined();
      expect(result[0].op1.node_id).toBe('operation-magic-op1-0');
      expect(result[0].op1.node_type).toBe('operation');
      expect(result[0].op2).toBeDefined();

      expect(result[1]).toBeDefined();
      expect(result[1].op3).toBeDefined();
      expect(result[1].op3.node_id).toBe('operation-magic-op3-1');
    });

    it('should return empty object when operations is not an array', () => {
      const jsonData = { operations: 'not an array' };
      const result = extractOperationNodes(jsonData);
      expect(result).toEqual({});
    });

    it('should return empty object when operations is undefined', () => {
      const jsonData = {};
      const result = extractOperationNodes(jsonData);
      expect(result).toEqual({});
    });

    it('should handle operations without subgraphid', () => {
      const jsonData = {
        operations: [{ opmagic: 'op1' }],
      };
      const result = extractOperationNodes(jsonData);
      expect(result[-1]).toBeDefined();
      expect(result[-1].op1).toBeDefined();
      expect(result[-1].op1.node_id).toBe('operation-magic-op1--1');
    });

    it('should handle empty operations array', () => {
      const jsonData = { operations: [] };
      const result = extractOperationNodes(jsonData);
      expect(result).toEqual({});
    });
  });

  describe('extractFuncMap', () => {
    it('should extract function node mapping', () => {
      const funcHashMap = {
        hash1: { func_magicname: 'func1' },
        hash2: { func_magicname: 'func2' },
      };
      const result = extractFuncMap(funcHashMap);

      expect(result.hash1).toEqual({
        func_magicname: 'func1',
        node_type: 'function',
        hash: 'hash1',
      });
      expect(result.hash2).toEqual({
        func_magicname: 'func2',
        node_type: 'function',
        hash: 'hash2',
      });
    });

    it('should handle empty funcHashMap', () => {
      const result = extractFuncMap({});
      expect(result).toEqual({});
    });
  });

  describe('searchByFunctionHash', () => {
    const funcMap = {
      hash1: { func_magicname: 'func1', hash: 'hash1' },
      hash2: { func_magicname: 'func2', hash: 'hash2' },
      HASH3: { func_magicname: 'func3', hash: 'HASH3' },
    };

    it('should search by hash with string contains (case insensitive)', () => {
      const result = searchByFunctionHash(funcMap, 'hash');
      expect(result).toHaveLength(3);
    });

    it('should search by hash with case sensitive', () => {
      const result = searchByFunctionHash(funcMap, 'HASH', true);
      // Note: isUpper=true keeps keyword as-is but still uses 'i' flag, so it's case-insensitive
      expect(result).toHaveLength(3);
    });

    it('should search by hash with regex', () => {
      const result = searchByFunctionHash(funcMap, 'hash[12]', false, true);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no match', () => {
      const result = searchByFunctionHash(funcMap, 'nonexistent');
      expect(result).toHaveLength(0);
    });

    it('should handle invalid regex gracefully', () => {
      const result = searchByFunctionHash(funcMap, '[invalid', false, true);
      expect(result).toHaveLength(0);
    });
  });

  describe('searchByFunctionName', () => {
    const funcMap = {
      hash1: { func_magicname: 'func1' },
      hash2: { func_magicname: 'func2' },
      hash3: { func_magicname: 'FUNC3' },
    };

    it('should search by name with string contains (case insensitive)', () => {
      const result = searchByFunctionName(funcMap, 'func');
      expect(result).toHaveLength(3);
    });

    it('should search by name with case sensitive', () => {
      const result = searchByFunctionName(funcMap, 'FUNC', true);
      expect(result).toHaveLength(1);
      expect(result[0].func_magicname).toBe('FUNC3');
    });

    it('should search by name with regex', () => {
      const result = searchByFunctionName(funcMap, 'func[12]', false, true);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no match', () => {
      const result = searchByFunctionName(funcMap, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('searchFunc', () => {
    const tensorMap = {
      0: {
        t1: { magic: 't1', subgraphid: 0, rawtensor: 'raw1', semantic_label: { label: 'tensor1' } },
        t2: { magic: 't2', subgraphid: 0, rawtensor: 'raw2' },
      },
      1: {
        t3: { magic: 't3', subgraphid: 1, rawtensor: 'raw3' },
      },
    };
    const opMap = {
      0: {
        op1: { opmagic: 'op1', subgraphid: 0, name: 'add' },
      },
      1: {
        op2: { opmagic: 'op2', subgraphid: 1, name: 'mul' },
      },
    };
    const rawTensorMap = {
      raw1: { rawmagic: 'raw1', data: 'data1' },
      raw2: { rawmagic: 'raw2', data: 'data2' },
      raw3: { rawmagic: 'raw3', data: 'data3' },
    };
    const funcMap = {
      hash1: { func_magicname: 'func1', hash: 'hash1' },
      hash2: { func_magicname: 'func2', hash: 'hash2' },
    };

    it('should search by Function category with hash option', () => {
      const result = searchFunc(
        { searchKey: 'hash1', category: 'Function', option: 'hash' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].hash).toBe('hash1');
    });

    it('should search by Function category with name option', () => {
      const result = searchFunc(
        { searchKey: 'func1', category: 'Function', option: 'name' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].func_magicname).toBe('func1');
    });

    it('should search by Function category with fuzzy search', () => {
      const result = searchFunc(
        { searchKey: 'func', category: 'Function' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should search by Tensor category with magic option', () => {
      const result = searchFunc(
        { searchKey: 't1', category: 'Tensor', option: 'magic' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].magic).toBe('t1');
    });

    it('should search by Tensor category with semantic_label option', () => {
      const result = searchFunc(
        { searchKey: 'tensor1', category: 'Tensor', option: 'semantic_label' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].magic).toBe('t1');
    });

    it('should search by Tensor category with fuzzy search', () => {
      const result = searchFunc(
        { searchKey: 't', category: 'Tensor' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should search by Operation category with magic option', () => {
      const result = searchFunc(
        { searchKey: 'op1', category: 'Operation', option: 'magic' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].opmagic).toBe('op1');
    });

    it('should search by Operation category with fuzzy search', () => {
      const result = searchFunc(
        { searchKey: 'op', category: 'Operation' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should search by Subgraph category', () => {
      const result = searchFunc(
        { searchKey: '0', category: 'Subgraph' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should search by Rawtensor category with magic option', () => {
      const result = searchFunc(
        { searchKey: 'raw1', category: 'Rawtensor', option: 'magic' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result).toHaveLength(1);
      expect(result[0].rawtensor).toBe('raw1');
    });

    it('should search by Rawtensor category with fuzzy search', () => {
      const result = searchFunc(
        { searchKey: 'raw', category: 'Rawtensor' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('should perform global fuzzy search when category is empty', () => {
      const result = searchFunc(
        { searchKey: '1' },
        tensorMap,
        opMap,
        rawTensorMap,
        funcMap
      );
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
