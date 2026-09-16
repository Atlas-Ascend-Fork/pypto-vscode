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

vi.mock(import('../../../src/color-list'), () => ({
  generateColorList: vi.fn((count: number, _isDark?: boolean) => ({
    baseColorList: Array.from({ length: count }, (_, i) => `#base-${i}`),
    lightColorList: Array.from({ length: count }, (_, i) => `#light-${i}`),
  })),
  getLighterColorByHex: vi.fn((hex: string) => `${hex}-lighter`),
}));

vi.mock(import('../../../src/process'), () => ({
  getSemanticColor: vi.fn(() => ({
    dark: { base: 'semantic-base', light: 'semantic-light' },
  })),
}));

vi.mock(import('../../../src/handler/baseGraphMsgHandler'), () => ({
  BaseGraphMsgHandler: {
    returnError: vi.fn(),
  },
}));

vi.mock(import('../../../src/core/json-graph/parseSymbolicAttr'), () => {
  class MockAttrReader {
    private attr: any[];
    constructor(public server: any, attr: any[]) {
      this.attr = attr ? [...attr] : [];
    }
    hasNext() { return this.attr.length > 0; }
    readIndex() { return 0; }
    readNumber() { return this.attr.length > 0 ? this.attr.shift() : NaN; }
    readStringOrNumberArray() {
      if (this.attr.length > 0) {
        const val = this.attr.shift();
        return Array.isArray(val) ? val : undefined;
      }
      return undefined;
    }
    readOptionalNumber() { return this.attr.length > 0 ? this.attr.shift() : null; }
  }
  return {
    AttrReader: MockAttrReader,
    genMathScalarExpr: vi.fn(() => 'mock_expr'),
    parseSymbolicOrIntList: vi.fn(() => ['1', '2']),
    parseExprList: vi.fn(() => ['1', '2']),
  };
});

import { AscppDagBuilder } from '../../../src/core/json-graph/jsonGraph';
import { BaseGraphMsgHandler } from '../../../src/handler/baseGraphMsgHandler';
import type { FunctionData, Operation, Tensor, RawTensor } from '../../../src/core/json-graph/jsonGraph.types';
import { makeRawTensor, makeTensor, makeOperation, makeFunctionData, createBuilder } from './jsonGraph.helpers';

describe('AscppDagBuilder.constructor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with provided values', () => {
    const server = { setRef: vi.fn(), comGraphData: { funcHash: 'hash1' } };
    const builder = new AscppDagBuilder({ funcHash: 'hash1' }, server, '1.5');
    expect(builder.comGraphData).toEqual({ funcHash: 'hash1' });
    expect(builder.server).toBe(server);
    expect(builder.version).toBe('1.5');
  });

  it('accepts callInOutTensorMap and diffType', () => {
    const callInOutTensorMap = vi.fn();
    const server = { setRef: vi.fn() };
    const builder = new AscppDagBuilder({}, server, '2.0', callInOutTensorMap, 'before');
    expect(builder.callInOutTensorMap).toBe(callInOutTensorMap);
    expect(builder.diffType).toBe('before');
  });
});

describe('AscppDagBuilder.tryAddUnique', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for a new key', () => {
    const builder = createBuilder();
    expect(builder.tryAddUnique('key1')).toBe(true);
  });

  it('returns false for an existing key', () => {
    const builder = createBuilder();
    builder.tryAddUnique('key1');
    expect(builder.tryAddUnique('key1')).toBe(false);
  });

  it('handles multiple unique keys', () => {
    const builder = createBuilder();
    expect(builder.tryAddUnique('a')).toBe(true);
    expect(builder.tryAddUnique('b')).toBe(true);
    expect(builder.tryAddUnique('a')).toBe(false);
    expect(builder.tryAddUnique('c')).toBe(true);
  });
});

describe('AscppDagBuilder.getAvailableSubgraphs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts subgraph IDs excluding -1', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      operations: [
        makeOperation({ opmagic: 1, subgraphid: 0 }),
        makeOperation({ opmagic: 2, subgraphid: 2 }),
        makeOperation({ opmagic: 3, subgraphid: -1 }),
        makeOperation({ opmagic: 4, subgraphid: 1 }),
      ],
    });
    const result = builder.getAvailableSubgraphs(funcData);
    expect(result).toEqual([0, 1, 2]);
  });

  it('returns empty array when operations is undefined', () => {
    const builder = createBuilder();
    const result = builder.getAvailableSubgraphs({} as FunctionData);
    expect(result).toEqual([]);
  });

  it('returns empty array when operations is empty', () => {
    const builder = createBuilder();
    const result = builder.getAvailableSubgraphs({ operations: [] } as FunctionData);
    expect(result).toEqual([]);
  });

  it('deduplicates subgraph IDs', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      operations: [
        makeOperation({ opmagic: 1, subgraphid: 0 }),
        makeOperation({ opmagic: 2, subgraphid: 0 }),
        makeOperation({ opmagic: 3, subgraphid: 1 }),
      ],
    });
    const result = builder.getAvailableSubgraphs(funcData);
    expect(result).toEqual([0, 1]);
  });

  it('returns sorted subgraph IDs', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      operations: [
        makeOperation({ opmagic: 1, subgraphid: 5 }),
        makeOperation({ opmagic: 2, subgraphid: 1 }),
        makeOperation({ opmagic: 3, subgraphid: 3 }),
      ],
    });
    const result = builder.getAvailableSubgraphs(funcData);
    expect(result).toEqual([1, 3, 5]);
  });

  it('extracts subgraph IDs from nested data when structure is invalid', () => {
    const builder = createBuilder();
    const nestedData = {
      functions: [
        makeFunctionData({
          operations: [
            makeOperation({ opmagic: 1, subgraphid: 0 }),
            makeOperation({ opmagic: 2, subgraphid: 2 }),
          ],
        }),
      ],
    };
    const result = builder.getAvailableSubgraphs(nestedData as any);
    expect(result).toEqual([0, 2]);
  });
});

describe('AscppDagBuilder.setColorConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets color lists for dark theme', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    expect(builder.isDefinedDark).toBe(true);
    expect(builder.baseColorList).toHaveLength(360);
    expect(builder.lightColorList).toHaveLength(360);
    expect(builder.leafBaseColorList).toHaveLength(4);
    expect(builder.leafLightColorList).toHaveLength(4);
  });

  it('sets color lists for light theme', () => {
    const builder = createBuilder();
    builder.setColorConfig(false);
    expect(builder.isDefinedDark).toBe(false);
  });
});

describe('AscppDagBuilder.createSprottyGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a graph model with root id and bottom edge', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData();
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.type).toBe('graph');
    expect(result.id).toBe('root');
    const bottomNode = result.children?.find((c: any) => c.type === 'bottom');
    expect(bottomNode).toBeDefined();
  });

  it('includes nodes and edges in children', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData();
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(1);
  });

  it('applies colorBySubgraph flag to root', () => {
    const builder = createBuilder();
    const result = builder.createSprottyGraph(makeFunctionData(), true, false, true);
    expect((result as any).colorBySubgraph).toBe(true);
  });

  it('applies filterSubgraphId to root when specified', () => {
    const builder = createBuilder();
    const result = builder.createSprottyGraph(makeFunctionData(), true, false, false, true, false, 0);
    expect((result as any).filterSubgraphId).toBe(0);
  });

  it('handles showTensorNodes=false by connecting hidden nodes', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData();
    const result = builder.createSprottyGraph(funcData, false);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('handles showSyncNodes=true by creating sync control flow edges', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData();
    const result = builder.createSprottyGraph(funcData, true, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('handles nested data structure via extractNestedData', () => {
    const builder = createBuilder();
    const nestedData = {
      functions: [makeFunctionData()],
    };
    const result = builder.createSprottyGraph(nestedData as any, true);
    expect(result.type).toBe('graph');
  });

  it('creates graph for single node search when nodeMagic is provided', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      operations: [makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] })],
    });
    const result = builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10');
    expect(result.type).toBe('graph');
    expect(builder.isSearch).toBe(true);
  });
});

describe('AscppDagBuilder.createNodeListMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('populates opListMap and tensorListMap', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] }),
      ],
    });
    builder.createNodeListMap(funcData);
    expect(builder.opListMap.has('10')).toBe(true);
    expect(builder.tensorListMap.has('1')).toBe(true);
    expect(builder.tensorListMap.has('2')).toBe(true);
  });

  it('populates tensor2opMap with inOp and outOp sets', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      tensors: [makeTensor({ magic: 1 }), makeTensor({ magic: 2 })],
      operations: [makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] })],
    });
    builder.createNodeListMap(funcData);
    const tensor1Ops = builder.tensor2opMap.get('1');
    expect(tensor1Ops).toBeDefined();
    expect(tensor1Ops?.outOp.has('10')).toBe(true);
    const tensor2Ops = builder.tensor2opMap.get('2');
    expect(tensor2Ops?.inOp.has('10')).toBe(true);
  });

  it('detects duplicate magic between incasts and outcasts', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      tensors: [makeTensor({ magic: 5 })],
      incasts: [5],
      outcasts: [[5]],
      operations: [],
    });
    builder.createNodeListMap(funcData);
    expect(builder.duplicateMagic.has('5')).toBe(true);
  });

  it('populates op2CastMap with incast and outcast operands', () => {
    const builder = createBuilder();
    const funcData = makeFunctionData({
      tensors: [makeTensor({ magic: 1 }), makeTensor({ magic: 2 })],
      operations: [makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] })],
    });
    builder.createNodeListMap(funcData);
    const op2Cast = builder.op2CastMap.get('10');
    expect(op2Cast).toBeDefined();
    expect(op2Cast?.get('incast')).toEqual([1]);
    expect(op2Cast?.get('outcast')).toEqual([2]);
  });
});

describe('AscppDagBuilder.createGraphFullNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates tensor nodes when showTensorNodes is true', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = makeFunctionData();
    const result = builder.createSprottyGraph(funcData, true);
    const nodes = result.children?.filter((c: any) => c.type === 'node' || c.type === 'node:tensor');
    expect((nodes?.length ?? 0)).toBeGreaterThan(0);
  });

  it('creates fan-out connections when showTensorNodes is false', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = makeFunctionData();
    const result = builder.createSprottyGraph(funcData, false);
    const edges = result.children?.filter((c: any) => c.type === 'edge');
    expect((edges?.length ?? 0)).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.connectHiddenNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates fan-out edges between producers and consumers', () => {
    const builder = createBuilder();
    const rawTensorProducers = new Map([
      ['100', [{ nodeId: 'node-a', portId: 'tensor-1-0-out' }]],
    ]);
    const rawTensorConsumers = new Map([
      ['100', [{ nodeId: 'node-b', portId: 'operation-10-0-in' }]],
    ]);
    const edges: any[] = [];
    builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
    expect(edges.length).toBe(1);
    expect(edges[0].sourceId).toBe('tensor-1-0-out');
    expect(edges[0].targetId).toBe('operation-10-0-in');
  });

  it('skips edges when producer and consumer share same tensor magic and rawTensorId is in recordInOutRawId', () => {
    const builder = createBuilder();
    builder.recordInOutRawId.add('100');
    const rawTensorProducers = new Map([
      ['100', [{ nodeId: 'node-a', portId: 'tensor-1-0-out' }]],
    ]);
    const rawTensorConsumers = new Map([
      ['100', [{ nodeId: 'node-b', portId: 'tensor-1-0-in' }]],
    ]);
    const edges: any[] = [];
    builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
    expect(edges.length).toBe(0);
  });

  it('creates multiple edges for fan-out with multiple consumers', () => {
    const builder = createBuilder();
    const rawTensorProducers = new Map([
      ['100', [{ nodeId: 'prod', portId: 'port-1' }]],
    ]);
    const rawTensorConsumers = new Map([
      ['100', [
        { nodeId: 'cons1', portId: 'port-2' },
        { nodeId: 'cons2', portId: 'port-3' },
      ]],
    ]);
    const edges: any[] = [];
    builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
    expect(edges.length).toBe(2);
  });

  it('adds dashed-edge css class when producer port is in emptyNodesList', () => {
    const builder = createBuilder();
    builder.emptyNodesList.add('empty-port-1');
    const rawTensorProducers = new Map([
      ['100', [{ nodeId: 'node-a', portId: 'empty-port-1' }]],
    ]);
    const rawTensorConsumers = new Map([
      ['100', [{ nodeId: 'node-b', portId: 'port-2' }]],
    ]);
    const edges: any[] = [];
    builder.connectHiddenNodes(rawTensorProducers, rawTensorConsumers, edges);
    expect(edges[0].cssClasses).toContain('dashed-edge');
  });
});

describe('AscppDagBuilder.deleteMiddleEmptyNodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('removes nodes whose id matches emptyOutputSet entries', () => {
    const builder = createBuilder();
    builder.emptyOutputSet.add('5');
    const nodes: any[] = [
      { id: 'tensor-5-0', type: 'node' },
      { id: 'tensor-1-0', type: 'node' },
      { id: 'tensor-5-1', type: 'node' },
    ];
    builder.deleteMiddleEmptyNodes(nodes);
    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === 'tensor-5-0')).toBeUndefined();
  });

  it('does nothing when emptyOutputSet is empty', () => {
    const builder = createBuilder();
    const nodes: any[] = [{ id: 'tensor-1-0' }, { id: 'tensor-2-0' }];
    builder.deleteMiddleEmptyNodes(nodes);
    expect(nodes).toHaveLength(2);
  });

  it('handles case where node id does not exist in nodes array', () => {
    const builder = createBuilder();
    builder.emptyOutputSet.add('99');
    const nodes: any[] = [{ id: 'tensor-1-0' }];
    builder.deleteMiddleEmptyNodes(nodes);
    expect(nodes).toHaveLength(1);
  });
});

describe('AscppDagBuilder.createGraphSingleSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls setRef with PathNodesSet after search', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = makeFunctionData({
      tensors: [makeTensor({ magic: 1 }), makeTensor({ magic: 2 })],
      operations: [makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] })],
      incasts: [1],
      outcasts: [[2]],
    });
    const nodes: any[] = [];
    const edges: any[] = [];
    const portMap = new Map();
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })], ['101', makeRawTensor({ rawmagic: 101 })]]);
    const magicToTensorMap = new Map([['1', makeTensor({ magic: 1, rawtensor: 100 })], ['2', makeTensor({ magic: 2, rawtensor: 101 })]]);
    const tensorToRawTensorMap = new Map([['1', '100'], ['2', '101']]);
    const tensorMap = new Map();
    const inoutMap = new Map([['incasts', new Set<string>()], ['outcasts', new Set<string>()]]);
    const rawTensorProducers = new Map();
    const rawTensorConsumers = new Map();

    builder.createGraphSingleSearch(
      '10', funcData, nodes, edges, portMap,
      tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers,
      rawTensorMap, magicToTensorMap, tensorMap, inoutMap, true,
    );
    expect(builder.server.setRef).toHaveBeenCalledWith('PathNodesSet', expect.objectContaining({ data: expect.any(Array) }));
  });

  it('searches by tensor when nodeMagic is not in opListMap', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = makeFunctionData({
      tensors: [makeTensor({ magic: 1 }), makeTensor({ magic: 2 })],
      operations: [makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] })],
      incasts: [1],
      outcasts: [[2]],
    });
    const nodes: any[] = [];
    const edges: any[] = [];
    const portMap = new Map();
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })], ['101', makeRawTensor({ rawmagic: 101 })]]);
    const magicToTensorMap = new Map([['1', makeTensor({ magic: 1, rawtensor: 100 })], ['2', makeTensor({ magic: 2, rawtensor: 101 })]]);
    const tensorToRawTensorMap = new Map([['1', '100'], ['2', '101']]);
    const tensorMap = new Map();
    const inoutMap = new Map([['incasts', new Set<string>()], ['outcasts', new Set<string>()]]);
    const rawTensorProducers = new Map();
    const rawTensorConsumers = new Map();

    builder.createGraphSingleSearch(
      '1', funcData, nodes, edges, portMap,
      tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers,
      rawTensorMap, magicToTensorMap, tensorMap, inoutMap, true,
    );
    expect(builder.server.setRef).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports error when tensor magic is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = makeFunctionData({
      tensors: [makeTensor({ magic: undefined as any })],
      operations: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when rawTensor rawmagic is invalid', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const invalidRawTensor = makeRawTensor({ rawmagic: 200 });
    (invalidRawTensor as any).rawmagic = undefined;
    const funcData = makeFunctionData({
      rawtensors: [invalidRawTensor],
      tensors: [makeTensor({ magic: 1, rawtensor: 'undefined' as any })],
      operations: [],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.prepareSprottyGraphData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op method that does not throw', () => {
    const builder = createBuilder();
    expect(() => builder.prepareSprottyGraphData()).not.toThrow();
  });
});
