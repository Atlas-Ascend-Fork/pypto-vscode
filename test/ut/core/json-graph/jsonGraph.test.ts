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
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../src/core/json-graph/parseSymbolicAttr', () => ({
  AttrReader: vi.fn().mockImplementation(() => ({
    read: vi.fn(),
  })),
}));

vi.mock('../../../../src/color-list', () => ({
  generateColorList: vi.fn((count: number, isDark: boolean) => ({
    baseColorList: Array.from({ length: count }, (_, i) => `base-${i}`),
    lightColorList: Array.from({ length: count }, (_, i) => `light-${i}`),
  })),
  getLighterColorByHex: vi.fn(() => '#ffffff'),
}));

vi.mock('../../../../src/handler/baseGraphMsgHandler', () => ({
  BaseGraphMsgHandler: {
    returnError: vi.fn(),
    globalCallInOutTensorMap: new Map(),
  },
}));

vi.mock('../../../../src/util', () => ({
  Util: {
    someMethod: vi.fn(),
  },
}));

vi.mock('../../../../src/process', () => ({
  getSemanticColor: vi.fn(() => ({
    dark: { base: '#000000', light: '#ffffff' },
  })),
}));

vi.mock('../../../../src/core/json-graph/utils', () => ({
  addPhaseGroupingInfo: vi.fn(),
  filterSubgraph: vi.fn((_id, nodes, edges) => [nodes, edges]),
  createTensorMaps: vi.fn(() => ({
    rawTensorMap: new Map(),
    magicToTensorMap: new Map(),
    tensorToRawTensorMap: new Map(),
    inoutMap: new Map(),
  })),
  hasSameCoordinationScope: vi.fn(() => true),
  hasValidStructure: vi.fn((data) => !!(data.rawtensors || data.tensors || data.operations)),
  initializeDataStructures: vi.fn(() => ({
    nodes: [],
    edges: [],
    tensorMap: new Map(),
    portMap: new Map(),
    rawTensorProducers: new Map(),
    rawTensorConsumers: new Map(),
  })),
  parseAssembleViewOp: vi.fn(),
  parseConvertOp: vi.fn(),
  parseCopyOp: vi.fn(),
  findIncastIndex: vi.fn(() => 0),
  findOutcastIndex: vi.fn(() => 0),
  removeEmptyNodesForTensor: vi.fn(),
  buildTensorMetadataCompartment: vi.fn(),
  createEmptyNodeWithPort: vi.fn((id, magic) => ({ type: 'node', id: `empty-${id}`, magic })),
  createTokenNode: vi.fn((id, magic) => ({ type: 'node', id, magic })),
  getCastNodeState: vi.fn(() => ({ baseColor: '#000', lightColor: '#fff', isError: false, isAccuracyError: false, isAccuracyException: false })),
  buildCastMetadataCompartment: vi.fn((id) => ({ type: 'compartment', id: `${id}-meta`, children: [] })),
  buildMetaLabels: vi.fn((id) => ({ type: 'label', id: `${id}-meta-label` })),
  buildCallLabels: vi.fn((id) => ({ type: 'label', id: `${id}-call-label` })),
  getCodePath: vi.fn(() => '/test/path'),
  getCodeLine: vi.fn(() => '10'),
  extractNestedData: vi.fn((data) => data),
  createSyncControlFlowEdges: vi.fn(),
  buildTensorNodeObject: vi.fn((nodeId) => ({ type: 'node:tensor', id: nodeId, children: [] })),
  buildTensorNodesObject: vi.fn((nodeId) => ({ type: 'node:tensor', id: nodeId, children: [] })),
  createEmptyNodesForSearch: vi.fn(),
}));

import { AscppDagBuilder } from '../../../../src/core/json-graph/jsonGraph';
import type { FunctionData } from '../../../../src/core/json-graph/jsonGraph.types';

describe('AscppDagBuilder', () => {
  let builder: AscppDagBuilder;
  const mockComGraphData = { funcHash: 'test-hash' };
  const mockServer = { setRef: vi.fn(), comGraphData: { funcHash: 'test-hash' } };

  beforeEach(() => {
    builder = new AscppDagBuilder(mockComGraphData, mockServer, '2.0');
  });

  describe('constructor', () => {
    it('should initialize with required parameters', () => {
      expect(builder.comGraphData).toBe(mockComGraphData);
      expect(builder.server).toBe(mockServer);
      expect(builder.version).toBe('2.0');
      expect(builder.callInOutTensorMap).toBeUndefined();
      expect(builder.diffType).toBeUndefined();
    });

    it('should initialize with optional parameters', () => {
      const callInOutFn = vi.fn();
      const b = new AscppDagBuilder(mockComGraphData, mockServer, '1.0', callInOutFn, 'before');
      expect(b.version).toBe('1.0');
      expect(b.callInOutTensorMap).toBe(callInOutFn);
      expect(b.diffType).toBe('before');
    });

    it('should initialize default sets and maps', () => {
      expect(builder.nodeSet).toBeInstanceOf(Set);
      expect(builder.outcastUnique).toBeInstanceOf(Set);
      expect(builder.incastUniqueSingle).toBeInstanceOf(Set);
      expect(builder.emptyNodesList).toBeInstanceOf(Set);
      expect(builder.emptyOutputSet).toBeInstanceOf(Set);
      expect(builder.recordInOutRawId).toBeInstanceOf(Set);
      expect(builder.recordInOutCastMap).toBeInstanceOf(Map);
      expect(builder.recordNodeIdMap).toBeInstanceOf(Map);
      expect(builder.uniqueKeySet).toBeInstanceOf(Set);
      expect(builder.uniqueTokensSet).toBeInstanceOf(Set);
      expect(builder.callInOutMap).toBeInstanceOf(Map);
    });

    it('should initialize default boolean flags', () => {
      expect(builder.isErrorReport).toBe(false);
      expect(builder.isDefinedDark).toBe(true);
      expect(builder.isLeaf).toBe(false);
      expect(builder.isSearch).toBe(false);
    });
  });

  describe('getAvailableSubgraphs', () => {
    it('should return sorted unique subgraph IDs excluding -1', () => {
      const funcData: FunctionData = {
        operations: [
          { opmagic: 1, opcode: 'ADD', subgraphid: 2, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
          { opmagic: 2, opcode: 'MUL', subgraphid: 1, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
          { opmagic: 3, opcode: 'SUB', subgraphid: 2, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
          { opmagic: 4, opcode: 'DIV', subgraphid: -1, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
        ],
      };

      const result = builder.getAvailableSubgraphs(funcData);
      expect(result).toEqual([1, 2]);
    });

    it('should return empty array when no operations', () => {
      const funcData: FunctionData = {};
      const result = builder.getAvailableSubgraphs(funcData);
      expect(result).toEqual([]);
    });

    it('should return empty array when all subgraphids are -1', () => {
      const funcData: FunctionData = {
        operations: [
          { opmagic: 1, opcode: 'ADD', subgraphid: -1, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
        ],
      };
      const result = builder.getAvailableSubgraphs(funcData);
      expect(result).toEqual([]);
    });

    it('should handle operations without subgraphid', () => {
      const funcData: FunctionData = {
        operations: [
          { opmagic: 1, opcode: 'ADD', ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
        ],
      };
      const result = builder.getAvailableSubgraphs(funcData);
      expect(result).toEqual([]);
    });

    it('should deduplicate subgraph IDs', () => {
      const funcData: FunctionData = {
        operations: [
          { opmagic: 1, opcode: 'A', subgraphid: 3, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
          { opmagic: 2, opcode: 'B', subgraphid: 3, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
          { opmagic: 3, opcode: 'C', subgraphid: 1, ioperands: [], ooperands: [], kind: 0, semantic_label: {}, compareType: null } as any,
        ],
      };
      const result = builder.getAvailableSubgraphs(funcData);
      expect(result).toEqual([1, 3]);
    });
  });

  describe('tryAddUnique', () => {
    it('should return true for new key and add it', () => {
      expect(builder.tryAddUnique('key1')).toBe(true);
      expect(builder.uniqueKeySet.has('key1')).toBe(true);
    });

    it('should return false for existing key', () => {
      builder.tryAddUnique('key1');
      expect(builder.tryAddUnique('key1')).toBe(false);
    });

    it('should handle multiple different keys', () => {
      expect(builder.tryAddUnique('a')).toBe(true);
      expect(builder.tryAddUnique('b')).toBe(true);
      expect(builder.tryAddUnique('a')).toBe(false);
    });
  });

  describe('setColorConfig', () => {
    it('should set color lists for dark theme', () => {
      builder.setColorConfig(true);
      expect(builder.isDefinedDark).toBe(true);
      expect(builder.baseColorList).toBeDefined();
      expect(builder.lightColorList).toBeDefined();
      expect(builder.leafBaseColorList).toBeDefined();
      expect(builder.leafLightColorList).toBeDefined();
    });

    it('should set color lists for light theme', () => {
      builder.setColorConfig(false);
      expect(builder.isDefinedDark).toBe(false);
      expect(builder.baseColorList).toBeDefined();
      expect(builder.baseColorList.length).toBe(360);
      expect(builder.leafBaseColorList.length).toBe(4);
    });
  });

  describe('deleteMiddleEmptyNodes', () => {
    it('should remove nodes matching emptyOutputSet entries', () => {
      builder.emptyOutputSet.add('123');
      const nodes: any[] = [
        { id: 'tensor-123-0', type: 'node' },
        { id: 'tensor-456-0', type: 'node' },
      ];
      builder.deleteMiddleEmptyNodes(nodes);
      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('tensor-456-0');
    });

    it('should do nothing when emptyOutputSet is empty', () => {
      const nodes: any[] = [{ id: 'tensor-123-0', type: 'node' }];
      builder.deleteMiddleEmptyNodes(nodes);
      expect(nodes).toHaveLength(1);
    });

    it('should handle when node is not found', () => {
      builder.emptyOutputSet.add('999');
      const nodes: any[] = [{ id: 'tensor-123-0', type: 'node' }];
      builder.deleteMiddleEmptyNodes(nodes);
      expect(nodes).toHaveLength(1);
    });
  });

  describe('connectHiddenNodes', () => {
    it('should create edges between producers and consumers', () => {
      const rawTensorProducers = new Map<string, any[]>();
      const rawTensorConsumers = new Map<string, any[]>();
      const edges: any[] = [];

      rawTensorProducers.set('raw1', [{ nodeId: 'op1', portId: 'port-a-1' }]);
      rawTensorConsumers.set('raw1', [{ nodeId: 'op2', portId: 'port-b-2' }]);

      builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
      expect(edges).toHaveLength(1);
      expect(edges[0].sourceId).toBe('port-a-1');
      expect(edges[0].targetId).toBe('port-b-2');
    });

    it('should skip edges when producer and consumer have same tensor magic and is in recordInOutRawId', () => {
      builder.recordInOutRawId.add('raw1');
      const rawTensorProducers = new Map<string, any[]>();
      const rawTensorConsumers = new Map<string, any[]>();
      const edges: any[] = [];

      rawTensorProducers.set('raw1', [{ nodeId: 'op1', portId: 'tensor-100-out' }]);
      rawTensorConsumers.set('raw1', [{ nodeId: 'op2', portId: 'tensor-100-in' }]);

      builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
      expect(edges).toHaveLength(0);
    });

    it('should add dashed-edge cssClass when producer port is in emptyNodesList', () => {
      builder.emptyNodesList.add('port-a-1');
      const rawTensorProducers = new Map<string, any[]>();
      const rawTensorConsumers = new Map<string, any[]>();
      const edges: any[] = [];

      rawTensorProducers.set('raw1', [{ nodeId: 'op1', portId: 'port-a-1' }]);
      rawTensorConsumers.set('raw1', [{ nodeId: 'op2', portId: 'port-b-2' }]);

      builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
      expect(edges).toHaveLength(1);
      expect(edges[0].cssClasses).toContain('dashed-edge');
    });

    it('should handle missing consumers gracefully', () => {
      const rawTensorProducers = new Map<string, any[]>();
      const rawTensorConsumers = new Map<string, any[]>();
      const edges: any[] = [];

      rawTensorProducers.set('raw1', [{ nodeId: 'op1', portId: 'port-a-1' }]);

      builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
      expect(edges).toHaveLength(0);
    });
  });

  describe('createSprottyGraph', () => {
    it('should return a graph root with correct structure', () => {
      const funcData: FunctionData = {
        rawtensors: [],
        tensors: [],
        operations: [],
        incasts: [],
        outcasts: [],
      };

      const result = builder.createSprottyGraph(funcData, false, false, false, true);
      expect(result.type).toBe('graph');
      expect(result.id).toBe('root');
      expect(result.children).toBeDefined();
      expect(Array.isArray(result.children)).toBe(true);
    });

    it('should set colorBySubgraph and filterSubgraphId on root', () => {
      const funcData: FunctionData = {
        rawtensors: [],
        tensors: [],
        operations: [],
        incasts: [],
        outcasts: [],
      };

      const result = builder.createSprottyGraph(funcData, false, false, true, true, false, 5);
      expect(result.colorBySubgraph).toBe(true);
      expect(result.filterSubgraphId).toBe(5);
    });
  });
});
