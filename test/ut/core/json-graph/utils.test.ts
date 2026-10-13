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
import { describe, it, expect, vi } from 'vitest';
import {
  hasSameCoordinationScope,
  hasValidStructure,
  initializeDataStructures,
  createTensorMaps,
  findIncastIndex,
  findOutcastIndex,
  removeEmptyNodesForTensor,
  buildTensorMetadataCompartment,
  createEmptyNodeWithPort,
  createTokenNode,
  getCastNodeState,
  buildCastMetadataCompartment,
  buildMetaLabels,
  buildCallLabels,
  getCodePath,
  getCodeLine,
  extractNestedData,
  buildTensorNodeObject,
  buildTensorNodesObject,
  extractTensorMagicFromPortId,
  markEmptyNodeEdgesAsDashed,
} from '../../../../src/core/json-graph/utils';
import type { FunctionData, Operation, Tensor, RawTensor } from '../../../../src/core/json-graph/jsonGraph.types';

describe('json-graph/utils', () => {
  describe('hasSameCoordinationScope', () => {
    it('should return true when both operations have same pipe_id', () => {
      const phaseOp: Operation = {
        opmagic: 1,
        opcode: 'PHASE1',
        sync_queue: { pipe_id: 1, trig_pipe: 0 },
      } as Operation;

      const compOp: Operation = {
        opmagic: 2,
        opcode: 'ADD',
        sync_queue: { pipe_id: 1, trig_pipe: 0 },
      } as Operation;

      expect(hasSameCoordinationScope(phaseOp, compOp)).toBe(true);
    });

    it('should return false when operations have different pipe_id', () => {
      const phaseOp: Operation = {
        opmagic: 1,
        opcode: 'PHASE1',
        sync_queue: { pipe_id: 1, trig_pipe: 0 },
      } as Operation;

      const compOp: Operation = {
        opmagic: 2,
        opcode: 'ADD',
        sync_queue: { pipe_id: 2, trig_pipe: 0 },
      } as Operation;

      expect(hasSameCoordinationScope(phaseOp, compOp)).toBe(false);
    });

    it('should return true when both operations have no sync_queue (default to 0)', () => {
      const phaseOp: Operation = {
        opmagic: 1,
        opcode: 'PHASE1',
      } as Operation;

      const compOp: Operation = {
        opmagic: 2,
        opcode: 'ADD',
      } as Operation;

      expect(hasSameCoordinationScope(phaseOp, compOp)).toBe(true);
    });
  });

  describe('hasValidStructure', () => {
    it('should return true when funcData has rawtensors', () => {
      const funcData: FunctionData = {
        rawtensors: [{ rawmagic: 1 }],
      } as FunctionData;

      expect(hasValidStructure(funcData)).toBe(true);
    });

    it('should return true when funcData has tensors', () => {
      const funcData: FunctionData = {
        tensors: [{ magic: 1 }],
      } as FunctionData;

      expect(hasValidStructure(funcData)).toBe(true);
    });

    it('should return true when funcData has operations', () => {
      const funcData: FunctionData = {
        operations: [{ opmagic: 1 }],
      } as FunctionData;

      expect(hasValidStructure(funcData)).toBe(true);
    });

    it('should return false when funcData has no valid structure', () => {
      const funcData: FunctionData = {} as FunctionData;

      expect(hasValidStructure(funcData)).toBe(false);
    });
  });

  describe('initializeDataStructures', () => {
    it('should return initialized data structures', () => {
      const result = initializeDataStructures();

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.tensorMap).toBeInstanceOf(Map);
      expect(result.portMap).toBeInstanceOf(Map);
      expect(result.rawTensorProducers).toBeInstanceOf(Map);
      expect(result.rawTensorConsumers).toBeInstanceOf(Map);
    });
  });

  describe('createTensorMaps', () => {
    it('should create rawTensorMap from rawtensors', () => {
      const actualData: FunctionData = {
        rawtensors: [
          { rawmagic: 1, data: 'raw1' },
          { rawmagic: 2, data: 'raw2' },
        ],
      } as FunctionData;

      const result = createTensorMaps(actualData);

      expect(result.rawTensorMap.size).toBe(2);
      expect(result.rawTensorMap.get('1')).toEqual({ rawmagic: 1, data: 'raw1' });
      expect(result.rawTensorMap.get('2')).toEqual({ rawmagic: 2, data: 'raw2' });
    });

    it('should create tensorToRawTensorMap from tensors', () => {
      const actualData: FunctionData = {
        tensors: [
          { magic: 1, rawtensor: 10 },
          { magic: 2, rawtensor: 20 },
        ],
      } as FunctionData;

      const result = createTensorMaps(actualData);

      expect(result.tensorToRawTensorMap.size).toBe(2);
      expect(result.tensorToRawTensorMap.get('1')).toBe('10');
      expect(result.tensorToRawTensorMap.get('2')).toBe('20');
    });

    it('should create magicToTensorMap from tensors', () => {
      const actualData: FunctionData = {
        tensors: [
          { magic: 1, data: 'tensor1' },
          { magic: 2, data: 'tensor2' },
        ],
      } as FunctionData;

      const result = createTensorMaps(actualData);

      expect(result.magicToTensorMap.size).toBe(2);
      expect(result.magicToTensorMap.get('1')).toEqual({ magic: 1, data: 'tensor1' });
      expect(result.magicToTensorMap.get('2')).toEqual({ magic: 2, data: 'tensor2' });
    });

    it('should create inoutMap from incasts and outcasts', () => {
      const actualData: FunctionData = {
        incasts: [[1], [2]],
        outcasts: [[3], [4]],
      } as FunctionData;

      const result = createTensorMaps(actualData);

      expect(result.inoutMap.size).toBe(2);
      expect(result.inoutMap.get('incasts')).toEqual(new Set(['1', '2']));
      expect(result.inoutMap.get('outcasts')).toEqual(new Set(['3', '4']));
    });

    it('should handle empty actualData', () => {
      const actualData: FunctionData = {} as FunctionData;

      const result = createTensorMaps(actualData);

      expect(result.rawTensorMap.size).toBe(0);
      expect(result.tensorToRawTensorMap.size).toBe(0);
      expect(result.magicToTensorMap.size).toBe(0);
      expect(result.inoutMap.size).toBe(0);
    });
  });

  describe('findIncastIndex', () => {
    it('should find incast index by magic', () => {
      const actualData: FunctionData = {
        incasts: [[1], [2], [3]],
      } as FunctionData;

      expect(findIncastIndex(actualData, '2')).toBe(1);
    });

    it('should return undefined when incast not found', () => {
      const actualData: FunctionData = {
        incasts: [[1], [2], [3]],
      } as FunctionData;

      expect(findIncastIndex(actualData, '99')).toBeUndefined();
    });

    it('should handle string conversion', () => {
      const actualData: FunctionData = {
        incasts: [[10], [20]],
      } as FunctionData;

      expect(findIncastIndex(actualData, '10')).toBe(0);
    });
  });

  describe('findOutcastIndex', () => {
    it('should find outcast index by magic', () => {
      const actualData: FunctionData = {
        outcasts: [[1], [2], [3]],
      } as FunctionData;

      expect(findOutcastIndex(actualData, '2')).toBe(1);
    });

    it('should return undefined when outcast not found', () => {
      const actualData: FunctionData = {
        outcasts: [[1], [2], [3]],
      } as FunctionData;

      expect(findOutcastIndex(actualData, '99')).toBeUndefined();
    });
  });

  describe('removeEmptyNodesForTensor', () => {
    it('should remove empty nodes for specific tensor', () => {
      const nodes = [
        { id: 'tensor-1-0-empty', type: 'node' },
        { id: 'tensor-2-0', type: 'node' },
        { id: 'tensor-1-1-empty', type: 'node' },
      ];

      removeEmptyNodesForTensor(nodes, '1');

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('tensor-2-0');
    });

    it('should not remove non-empty nodes', () => {
      const nodes = [
        { id: 'tensor-1-0', type: 'node' },
        { id: 'tensor-2-0', type: 'node' },
      ];

      removeEmptyNodesForTensor(nodes, '1');

      expect(nodes).toHaveLength(2);
    });

    it('should handle empty nodes array', () => {
      const nodes: any[] = [];

      removeEmptyNodesForTensor(nodes, '1');

      expect(nodes).toHaveLength(0);
    });
  });

  describe('buildTensorMetadataCompartment', () => {
    it('should build compartment with labels', () => {
      const result = buildTensorMetadataCompartment('tensor-1', ['shape: [1,2,3]', 'dtype: float32']);

      expect(result.type).toBe('compartment');
      expect(result.id).toBe('tensor-1-metadata-compartment');
      expect(result.layout).toBe('vbox');
      expect(result.children).toHaveLength(2);
      expect(result.children[0].text).toBe('shape: [1,2,3]');
      expect(result.children[1].text).toBe('dtype: float32');
    });

    it('should truncate long values', () => {
      const longValue = 'a'.repeat(40);
      const result = buildTensorMetadataCompartment('tensor-1', [`shape: ${longValue}`]);

      // The value part after ':' is ' aaaa...' (with leading space, 41 chars total)
      // Truncation happens at 32 chars, so we get ' aaaa...' (32 chars = space + 31 'a's)
      expect(result.children[0].text).toBe(`shape: ${'a'.repeat(31)}...`);
    });
  });

  describe('createEmptyNodeWithPort', () => {
    it('should create empty node with input and output ports', () => {
      const result = createEmptyNodeWithPort('tensor-1-0-in', '1');

      expect(result.type).toBe('node');
      expect(result.id).toBe('tensor-1-0');
      expect(result.magic).toBe('1');
      expect(result.role).toBe('output');
      expect(result.isEmptyNode).toBe(true);
      expect(result.children).toHaveLength(3); // compartment + inPort + outPort
    });

    it('should create correct port IDs', () => {
      const result = createEmptyNodeWithPort('tensor-1-0-in', '1');

      const inPort = result.children.find(c => c.type === 'port' && c.role === 'input');
      const outPort = result.children.find(c => c.type === 'port' && c.role === 'output');

      expect(inPort?.id).toBe('tensor-1-0-in');
      expect(outPort?.id).toBe('tensor-1-0-out');
    });
  });

  describe('createTokenNode', () => {
    it('should create token node with correct properties', () => {
      const result = createTokenNode('token-1-0-in', '1');

      expect(result.type).toBe('node');
      expect(result.id).toBe('token-1-0');
      expect(result.magic).toBe('');
      expect(result.role).toBe('operation');
      expect(result.isTokenNode).toBe(true);
      expect(result.isEmptyNode).toBe(true);
    });

    it('should create token label', () => {
      const result = createTokenNode('token-1-0-in', '1');

      const labelCompartment = result.children.find(c => c.type === 'compartment');
      expect(labelCompartment?.children).toHaveLength(1);
      expect(labelCompartment?.children[0].text).toBe('Token: 1');
    });
  });

  describe('getCastNodeState', () => {
    it('should return error state when tensor is in error list', () => {
      const tensor: Tensor = { magic: 1 } as Tensor;
      const errNodeList = new Set([1]);

      const result = getCastNodeState(tensor, undefined, 'tensor', errNodeList);

      expect(result.isError).toBe(true);
      expect(result.baseColor).toBe('rgba(231, 67, 74, 1)');
      expect(result.lightColor).toBe('rgba(250, 189, 193, 1)');
    });

    it('should return accuracy error state when rawTensor is in error list', () => {
      const tensor: Tensor = { magic: 1 } as Tensor;
      const rawTensor: RawTensor = { rawmagic: 10 } as RawTensor;
      const wrongRawMagicList = { errorRawMagicList: ['10'] };

      const result = getCastNodeState(tensor, rawTensor, 'output', undefined, wrongRawMagicList);

      expect(result.isAccuracyError).toBe(true);
      expect(result.baseColor).toBe('rgba(185, 54, 59, 1)');
    });

    it('should return accuracy exception state when rawTensor is in exception list', () => {
      const tensor: Tensor = { magic: 1 } as Tensor;
      const rawTensor: RawTensor = { rawmagic: 10 } as RawTensor;
      const wrongRawMagicList = { exceptionRawMagicList: ['10'] };

      const result = getCastNodeState(tensor, rawTensor, 'output', undefined, wrongRawMagicList);

      expect(result.isAccuracyException).toBe(true);
    });

    it('should return no error state when tensor is not in any error list', () => {
      const tensor: Tensor = { magic: 1 } as Tensor;

      const result = getCastNodeState(tensor, undefined, 'tensor');

      expect(result.isError).toBe(false);
      expect(result.isAccuracyError).toBe(false);
      expect(result.isAccuracyException).toBe(false);
    });
  });

  describe('buildCastMetadataCompartment', () => {
    it('should build compartment with metadata labels', () => {
      const result = buildCastMetadataCompartment('cast-1', 'incast', ['shape: [1,2,3]', 'dtype: float32']);

      expect(result.type).toBe('compartment');
      expect(result.id).toBe('cast-1-metadata-compartment');
      expect(result.cssClasses).toContain('incast-metadata-compartment');
      expect(result.children).toHaveLength(2);
    });

    it('should truncate long values', () => {
      const longValue = 'a'.repeat(40);
      const result = buildCastMetadataCompartment('cast-1', 'incast', [`shape: ${longValue}`]);

      // The value part after ':' is ' aaaa...' (with leading space, 41 chars total)
      // Truncation happens at 32 chars, so we get ' aaaa...' (32 chars = space + 31 'a's)
      expect(result.children[0].text).toBe(`shape: ${'a'.repeat(31)}...`);
    });
  });

  describe('buildMetaLabels', () => {
    it('should build meta labels compartment', () => {
      const result = buildMetaLabels('op-1', ['shape: [1,2,3]', 'dtype: float32'], 1, '10');

      expect(result.type).toBe('compartment');
      expect(result.id).toBe('op-1-main-labels-compartment');
      expect(result.magic).toBe('10');
      expect(result.subgraphId).toBe(1);
      expect(result.children).toHaveLength(2);
    });

    it('should truncate long values', () => {
      const longValue = 'a'.repeat(40);
      const result = buildMetaLabels('op-1', [`shape: ${longValue}`], 1, '10');

      // The value part after ':' is ' aaaa...' (with leading space, 41 chars total)
      // Truncation happens at 32 chars, so we get ' aaaa...' (32 chars = space + 31 'a's)
      expect(result.children[0].text).toBe(`shape: ${'a'.repeat(31)}...`);
    });
  });

  describe('buildCallLabels', () => {
    it('should build call labels compartment', () => {
      const result = buildCallLabels('op-1', ['call: func1', 'args: 2'], 1, '10');

      expect(result.type).toBe('compartment');
      expect(result.id).toBe('op-1-main-labels-compartment');
      expect(result.magic).toBe('10');
      expect(result.subgraphId).toBe(1);
      expect(result.children).toHaveLength(2);
    });
  });

  describe('getCodePath', () => {
    it('should return file path when available', () => {
      const op: Operation = {
        opmagic: 1,
        file: '/path/to/file.py',
      } as Operation;

      expect(getCodePath(op)).toBe('/path/to/file.py');
    });

    it('should return semantic_label filename when file is not available', () => {
      const op: Operation = {
        opmagic: 1,
        semantic_label: { filename: '/path/to/semantic.py' },
      } as Operation;

      expect(getCodePath(op)).toBe('/path/to/semantic.py');
    });

    it('should prefer file over semantic_label', () => {
      const op: Operation = {
        opmagic: 1,
        file: '/path/to/file.py',
        semantic_label: { filename: '/path/to/semantic.py' },
      } as Operation;

      expect(getCodePath(op)).toBe('/path/to/file.py');
    });

    it('should return undefined when no path is available', () => {
      const op: Operation = {
        opmagic: 1,
      } as Operation;

      expect(getCodePath(op)).toBeUndefined();
    });

    it('should return undefined when file is empty string', () => {
      const op: Operation = {
        opmagic: 1,
        file: '',
      } as Operation;

      expect(getCodePath(op)).toBeUndefined();
    });
  });

  describe('getCodeLine', () => {
    it('should return line number when available', () => {
      const op: Operation = {
        opmagic: 1,
        line: '42',
      } as Operation;

      expect(getCodeLine(op)).toBe(42);
    });

    it('should return semantic_label lineno when line is not available', () => {
      const op: Operation = {
        opmagic: 1,
        semantic_label: { lineno: 100 },
      } as Operation;

      expect(getCodeLine(op)).toBe(100);
    });

    it('should prefer line over semantic_label', () => {
      const op: Operation = {
        opmagic: 1,
        line: '42',
        semantic_label: { lineno: 100 },
      } as Operation;

      expect(getCodeLine(op)).toBe(42);
    });

    it('should return undefined when no line is available', () => {
      const op: Operation = {
        opmagic: 1,
      } as Operation;

      expect(getCodeLine(op)).toBeUndefined();
    });

    it('should return undefined when line is empty string', () => {
      const op: Operation = {
        opmagic: 1,
        line: '',
      } as Operation;

      expect(getCodeLine(op)).toBeUndefined();
    });

    it('should return undefined when line is not a number', () => {
      const op: Operation = {
        opmagic: 1,
        line: 'not-a-number',
      } as Operation;

      expect(getCodeLine(op)).toBeUndefined();
    });
  });

  describe('extractNestedData', () => {
    it('should return first function when functions array exists', () => {
      const funcData: FunctionData = {
        functions: [
          { rawtensors: [{ rawmagic: 1 }] },
          { rawtensors: [{ rawmagic: 2 }] },
        ],
      } as FunctionData;

      const result = extractNestedData(funcData);

      expect(result).toEqual({ rawtensors: [{ rawmagic: 1 }] });
    });

    it('should return nested data when found in properties', () => {
      const funcData: FunctionData = {
        nested: { rawtensors: [{ rawmagic: 1 }] },
      } as FunctionData;

      const result = extractNestedData(funcData);

      expect(result).toEqual({ rawtensors: [{ rawmagic: 1 }] });
    });

    it('should return original funcData when no nested data found', () => {
      const funcData: FunctionData = {
        someProperty: 'value',
      } as FunctionData;

      const result = extractNestedData(funcData);

      expect(result).toBe(funcData);
    });
  });

  describe('buildTensorNodeObject', () => {
    it('should build tensor node object with correct properties', () => {
      const tensor: Tensor = {
        magic: 1,
        compareType: 'none',
        semantic_label: { label: 'tensor1' },
      } as Tensor;

      const inputPort = { type: 'port', id: 'tensor-1-in', role: 'input' };
      const outputPort = { type: 'port', id: 'tensor-1-out', role: 'output' };

      const result = buildTensorNodeObject(
        'tensor-1',
        tensor,
        '1',
        'x',
        0,
        { baseColor: 'blue', lightColor: 'lightblue' },
        ['shape: [1,2,3]'],
        inputPort as any,
        outputPort as any
      );

      expect(result.type).toBe('node:tensor');
      expect(result.role).toBe('tensor');
      expect(result.id).toBe('tensor-1');
      expect(result.magic).toBe('1');
      expect(result.subgraphId).toBe(0);
      expect(result.baseColor).toBe('blue');
      expect(result.lightColor).toBe('lightblue');
    });
  });

  describe('buildTensorNodesObject', () => {
    it('should build tensor nodes object with error state', () => {
      const tensor: Tensor = {
        magic: 1,
        compareType: 'none',
        semantic_label: { label: 'tensor1' },
      } as Tensor;

      const inputPort = { type: 'port', id: 'tensor-1-in', role: 'input' };
      const outputPort = { type: 'port', id: 'tensor-1-out', role: 'output' };

      const result = buildTensorNodesObject(
        'tensor-1',
        tensor,
        '1',
        'x',
        0,
        { baseColor: 'red', lightColor: 'lightred' },
        true,
        ['shape: [1,2,3]'],
        inputPort as any,
        outputPort as any
      );

      expect(result.type).toBe('node:tensor');
      expect(result.isError).toBe(true);
      expect(result.baseColor).toBe('red');
    });
  });

  describe('extractTensorMagicFromPortId', () => {
    it('should extract tensor magic from port ID', () => {
      expect(extractTensorMagicFromPortId('tensor-123-in')).toBe('123');
    });

    it('should return undefined when port ID does not match pattern', () => {
      expect(extractTensorMagicFromPortId('port-123')).toBeUndefined();
    });

    it('should return undefined when port ID is undefined', () => {
      expect(extractTensorMagicFromPortId(undefined)).toBeUndefined();
    });
  });

  describe('markEmptyNodeEdgesAsDashed', () => {
    it('should mark edges connected to empty outputs as dashed', () => {
      const edges = [
        { id: 'edge-1', sourceId: 'tensor-1-out', targetId: 'tensor-2-in' },
        { id: 'edge-2', sourceId: 'tensor-3-out', targetId: 'tensor-4-in' },
      ];

      const emptyOutputSet = new Set(['1']);

      markEmptyNodeEdgesAsDashed(edges as any, emptyOutputSet);

      expect((edges[0] as any).cssClasses).toEqual(['dashed-edge']);
      expect((edges[1] as any).cssClasses).toBeUndefined();
    });

    it('should handle edges with no empty outputs', () => {
      const edges = [
        { id: 'edge-1', sourceId: 'tensor-1-out', targetId: 'tensor-2-in' },
      ];

      const emptyOutputSet = new Set<string>();

      markEmptyNodeEdgesAsDashed(edges as any, emptyOutputSet);

      expect((edges[0] as any).cssClasses).toBeUndefined();
    });
  });
});
