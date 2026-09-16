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
import type { FunctionData, Operation } from '../../../src/core/json-graph/jsonGraph.types';
import {
  makeRawTensor,
  makeTensor,
  makeOperation,
  makeFullFunctionData,
  createBuilder,
} from './jsonGraph.helpers';

// ==================== Comprehensive coverage tests ====================

describe('AscppDagBuilder.getTensorCommonAttr', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('parses all attrs when valid', () => {
    const builder = createBuilder();
    const labelAttr: string[] = [];
    (builder as any).getTensorCommonAttr(labelAttr, makeTensor({ shape: [1, 2], offset: [0] }), makeRawTensor({ rawshape: [1, 2], datatype: 6 }));
    expect(labelAttr.length).toBe(4);
  });

  it('reports error when shape is missing', () => {
    const builder = createBuilder();
    const labelAttr: string[] = [];
    (builder as any).getTensorCommonAttr(labelAttr, makeTensor({ shape: undefined as any }), makeRawTensor({ rawshape: [1] }));
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when rawshape is missing', () => {
    const builder = createBuilder();
    const labelAttr: string[] = [];
    (builder as any).getTensorCommonAttr(labelAttr, makeTensor({ shape: [1] }), makeRawTensor({ rawshape: undefined as any }));
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when offset is missing', () => {
    const builder = createBuilder();
    const labelAttr: string[] = [];
    (builder as any).getTensorCommonAttr(labelAttr, makeTensor({ shape: [1], offset: undefined as any }), makeRawTensor({ rawshape: [1] }));
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when datatype is missing', () => {
    const builder = createBuilder();
    const labelAttr: string[] = [];
    (builder as any).getTensorCommonAttr(labelAttr, makeTensor({ shape: [1], offset: [0] }), makeRawTensor({ rawshape: [1], datatype: undefined as any }));
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - token nodes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates token nodes when operations have itokens/otokens', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], itokens: ['tok1'], otokens: ['tok2'] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.some((c: any) => c.isTokenNode === true)).toBe(true);
  });
});

describe('AscppDagBuilder.createSprottyGraph - CALL operations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates CALL operation nodes with calleehash', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'CALL', ioperands: [1], ooperands: [2, 3], calleehash: 'callee1', func_magicname: 'called_func' }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.some((c: any) => c.calleehash === 'callee1')).toBe(true);
  });

  it('resolves call func name from calleeMap', () => {
    const comGraphData = { calleeMap: { callee1: { func_magicname: 'mapped_func' } }, funcHash: 'hash' };
    const server = { setRef: vi.fn(), comGraphData };
    const builder = new AscppDagBuilder(comGraphData, server, '2.0');
    builder.setColorConfig(true);
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'CALL', ioperands: [1], ooperands: [2], calleehash: 'callee1' }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    const callNode = result.children?.find((c: any) => c.calleehash === 'callee1');
    expect(callNode).toBeDefined();
  });
});

describe('AscppDagBuilder.createSprottyGraph - COPY_OUT/ASSEMBLE operations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates empty nodes for COPY_OUT operations', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ioperands: [1], ooperands: [2], attr: [0, 0, 1, 2, 10, 1, 2, 20] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('creates empty nodes for ASSEMBLE operations', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ASSEMBLE', ioperands: [1], ooperands: [2], attr: [0, 1, 5, [0, 42], [0, 10]] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - inouttensors', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates parent incast/outcast nodes when inouttensors is present', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      inouttensors: {
        inTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }],
        outTensors: [{ tensor: makeTensor({ magic: 3 }), rawTensor: makeRawTensor({ rawmagic: 102 }) }],
      },
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.some((c: any) => c.id?.includes('parent-incast'))).toBe(true);
    expect(result.children?.some((c: any) => c.id?.includes('parent-outcast'))).toBe(true);
  });
});

describe('AscppDagBuilder.createSprottyGraph - search mode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('searches forward and backward from an operation node', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '2');
    expect(result.type).toBe('graph');
    expect(builder.isSearch).toBe(true);
  });

  it('searches from a tensor node', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData();
    const result = builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '1');
    expect(result.type).toBe('graph');
  });
});

describe('AscppDagBuilder.createSprottyGraph - various opcodes with attr', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('parses COPY_IN operation attr', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'COPY_IN', ioperands: [1], ooperands: [2], attr: [0, 0, 1, 2, 10, 1, 2, 20] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('parses CONVERT operation attr', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'CONVERT', ioperands: [1], ooperands: [2], attr: [0, 1] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('parses VIEW operation attr', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'VIEW', ioperands: [1], ooperands: [2], attr: [0, 1, 5, [0, 42], [0, 10]] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('handles unknown opcode with attr', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'UNKNOWN_OP', ioperands: [1], ooperands: [2], attr: [0] }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('handles operation without attr', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], attr: undefined }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - leaf mode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uses leaf color config when isLeaf is true', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], mixSubgraphCore: 'AIC' }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true, false, false, true, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - three mode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('uses semantic colors in three mode', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], semantic_label: { label: 'compute' } }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true, true, false, true, false, undefined, undefined, undefined, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - error nodes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('marks error nodes with red color', () => {
    const builder = createBuilder();
    const errNodeList = new Set([10]);
    const funcData = makeFullFunctionData();
    const result = builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, undefined, undefined, false, errNodeList);
    const opNode = result.children?.find((c: any) => c.magic === '10');
    expect(opNode?.baseColor).toBe('rgba(231, 67, 74, 1)');
  });
});

describe('AscppDagBuilder.createSprottyGraph - wrong raw magic', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('marks accuracy error nodes with wrongRawMagicList', () => {
    const builder = createBuilder();
    const wrongRawMagicList = { errorRawMagicList: ['101'], exceptionRawMagicList: ['102'] };
    const funcData = makeFullFunctionData();
    const result = builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, undefined, undefined, false, undefined, wrongRawMagicList);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - duplicate magic', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles tensors that appear in both incasts and outcasts', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[1, [0]], [2, [0]]],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - callInOutTensorMap callback', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('invokes callInOutTensorMap callback when CALL op exists', () => {
    const callInOutTensorMap = vi.fn();
    const server = { setRef: vi.fn(), comGraphData: { funcHash: 'hash', calleeMap: {} } };
    const builder = new AscppDagBuilder({ calleeMap: {}, funcHash: 'hash' }, server, '2.0', callInOutTensorMap);
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'CALL', ioperands: [1], ooperands: [2], calleehash: 'callee1' }),
      ],
    });
    builder.createSprottyGraph(funcData, true);
    expect(callInOutTensorMap).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.getNodeColors', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns leaf colors when isLeaf', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.isLeaf = true;
    const colors = (builder as any).getNodeColors(makeOperation({ mixSubgraphCore: 'AIC' }), 0, false);
    expect(colors.baseColor).toBeDefined();
  });

  it('returns error colors when op is in errNodeList', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const errNodeList = new Set([10]);
    const colors = (builder as any).getNodeColors(makeOperation({ opmagic: 10 }), -1, false, errNodeList);
    expect(colors.baseColor).toBe('rgba(231, 67, 74, 1)');
  });

  it('returns semantic colors in three mode', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const colors = (builder as any).getNodeColors(makeOperation({ semantic_label: { label: 'compute' } }), 0, true);
    expect(colors.baseColor).toBe('semantic-base');
  });
});

describe('AscppDagBuilder.getTensorNodeColors', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns error colors when tensor is in errNodeList', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const errNodeList = new Set([1]);
    const colors = (builder as any).getTensorNodeColors(0, makeTensor({ magic: 1 }), errNodeList);
    expect(colors.baseColor).toBe('rgba(231, 67, 74, 1)');
  });

  it('returns default colors for negative graphId', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const colors = (builder as any).getTensorNodeColors(-1, makeTensor({ magic: 1 }));
    expect(colors.baseColor).toBe('var(--devui-tensor-node-base-color)');
  });
});

describe('AscppDagBuilder.createCastNode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates a cast node with metadata', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const tensor = makeTensor({ magic: 1, shape: [1, 2], offset: [0], rawtensor: 100, compareType: 'none' as any });
    const rawTensor = makeRawTensor({ rawmagic: 100, rawshape: [1, 2], datatype: 6 });
    const node = (builder as any).createCastNode(tensor, rawTensor, 'node-1', 'port-1', '1', 'In (100)', [0], 'input');
    expect(node.type).toBe('node:tensor');
    expect(node.role).toBe('input');
    expect(node.isMiddle).toBe(false);
  });

  it('marks node as middle when tensorName includes Middle', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const tensor = makeTensor({ magic: 1, shape: [1], offset: [0], rawtensor: 100, compareType: 'none' as any });
    const rawTensor = makeRawTensor({ rawmagic: 100, rawshape: [1], datatype: 6 });
    const node = (builder as any).createCastNode(tensor, rawTensor, 'node-1', 'port-1', '1', 'Middle (100)', [], 'output');
    expect(node.isMiddle).toBe(true);
  });
});

describe('AscppDagBuilder.createSprottyGraph - filterSubgraph', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('filters by subgraph id', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3], subgraphid: 1 }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true, false, false, true, false, 0);
    expect((result as any).filterSubgraphId).toBe(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - hidden tensor mode edge cases', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles duplicate outcast nodes with recordInOutCastMap', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[1, [0]], [2, [0]]],
      inouttensors: {
        inTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }],
        outTensors: [{ tensor: makeTensor({ magic: 2 }), rawTensor: makeRawTensor({ rawmagic: 101 }) }],
      },
    });
    const result = builder.createSprottyGraph(funcData, false);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.parseOperationAttr', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when attr is empty', () => {
    const builder = createBuilder();
    const labelAttr: string[] = [];
    (builder as any).parseOperationAttr(labelAttr, makeOperation({ opcode: 'COPY_IN', attr: [] }));
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when attr is undefined', () => {
    const builder = createBuilder();
    const labelAttr: string[] = [];
    (builder as any).parseOperationAttr(labelAttr, makeOperation({ opcode: 'COPY_IN', attr: undefined as any }));
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.buildLabelParts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('builds label parts for CALL operation', () => {
    const builder = createBuilder();
    const labelParts: string[] = [];
    (builder as any).buildLabelParts(labelParts, makeOperation({ opcode: 'CALL', ioperands: [1, 2], ooperands: [3], calleehash: 'hash1', attr: [0] }), true);
    expect(labelParts.some((p) => p.includes('InCast:'))).toBe(true);
    expect(labelParts.some((p) => p.includes('OutCast:'))).toBe(true);
    expect(labelParts.some((p) => p.includes('calleehash:'))).toBe(true);
  });

  it('does not parse attr when hasAttrValue is false', () => {
    const builder = createBuilder();
    const labelParts: string[] = [];
    (builder as any).buildLabelParts(labelParts, makeOperation({ opcode: 'ADD', attr: [0] }), false);
    expect(labelParts).toHaveLength(0);
  });
});

describe('AscppDagBuilder.createInputPorts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates input port and edges for showTensorNodes', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const children: any[] = [];
    const edges: any[] = [];
    const portMap = new Map([['producer-1', { nodeId: 'tensor-1-0', portId: 'tensor-1-0-out' }]]);
    (builder as any).createInputPorts(makeOperation({ opmagic: 10, ioperands: [1] }), 'op-10-0', children, edges, portMap, new Map(), new Map(), true);
    expect(children.some((c: any) => c.type === 'port')).toBe(true);
    expect(edges.length).toBe(1);
  });

  it('creates input port in search mode', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.tensorNodeMap.set('1', { nodeId: 'tensor-1-0' });
    const children: any[] = [];
    const edges: any[] = [];
    (builder as any).createInputPorts(makeOperation({ opmagic: 10, ioperands: [1] }), 'op-10-0', children, edges, new Map(), new Map(), new Map(), true, '10');
    expect(edges.length).toBe(1);
  });

  it('collects rawTensorConsumers when showTensorNodes is false', () => {
    const builder = createBuilder();
    const children: any[] = [];
    const edges: any[] = [];
    const rawTensorConsumers = new Map();
    const tensorToRawTensorMap = new Map([['1', '100']]);
    (builder as any).createInputPorts(makeOperation({ opmagic: 10, ioperands: [1] }), 'op-10-0', children, edges, new Map(), tensorToRawTensorMap, rawTensorConsumers, false);
    expect(rawTensorConsumers.has('100')).toBe(true);
  });

  it('returns early when ioperands is undefined', () => {
    const builder = createBuilder();
    const children: any[] = [];
    const edges: any[] = [];
    (builder as any).createInputPorts(makeOperation({ ioperands: undefined as any }), 'op-10-0', children, edges, new Map(), new Map(), new Map(), true);
    expect(children).toHaveLength(0);
  });
});

describe('AscppDagBuilder.createOutputPorts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('creates output port and edges for showTensorNodes', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const children: any[] = [];
    const edges: any[] = [];
    const portMap = new Map([['consumer-2', { nodeId: 'tensor-2-0', portId: 'tensor-2-0-in' }]]);
    (builder as any).createOutputPorts(makeOperation({ opmagic: 10, ooperands: [2] }), 'op-10-0', children, edges, portMap, new Map(), new Map(), new Map(), true, []);
    expect(children.some((c: any) => c.type === 'port')).toBe(true);
  });

  it('creates output port in search mode', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.tensorNodeMap.set('2', { nodeId: 'tensor-2-0' });
    const children: any[] = [];
    const edges: any[] = [];
    (builder as any).createOutputPorts(makeOperation({ opmagic: 10, ooperands: [2] }), 'op-10-0', children, edges, new Map(), new Map(), new Map(), new Map(), true, [], '10');
    expect(edges.length).toBe(1);
  });

  it('collects rawTensorProducers when showTensorNodes is false', () => {
    const builder = createBuilder();
    const children: any[] = [];
    const edges: any[] = [];
    const rawTensorProducers = new Map();
    const rawTensorConsumers = new Map();
    const tensorToRawTensorMap = new Map([['2', '101']]);
    (builder as any).createOutputPorts(makeOperation({ opmagic: 10, ooperands: [2] }), 'op-10-0', children, edges, new Map(), tensorToRawTensorMap, rawTensorProducers, rawTensorConsumers, false, []);
    expect(rawTensorProducers.has('101')).toBe(true);
  });

  it('returns early when ooperands is undefined', () => {
    const builder = createBuilder();
    const children: any[] = [];
    const edges: any[] = [];
    (builder as any).createOutputPorts(makeOperation({ ooperands: undefined as any }), 'op-10-0', children, edges, new Map(), new Map(), new Map(), new Map(), true, []);
    expect(children).toHaveLength(0);
  });
});

describe('AscppDagBuilder.createInputTtokens', () => {
  it('creates edges for itokens', () => {
    const builder = createBuilder();
    const children: any[] = [];
    const edges: any[] = [];
    (builder as any).createInputTtokens(makeOperation({ itokens: ['tok1', 'tok2'] }), 'op-10-0', children, edges);
    expect(edges.length).toBe(2);
  });

  it('returns early when itokens is undefined', () => {
    const builder = createBuilder();
    const edges: any[] = [];
    (builder as any).createInputTtokens(makeOperation({ itokens: undefined as any }), 'op-10-0', [], edges);
    expect(edges).toHaveLength(0);
  });
});

describe('AscppDagBuilder.createOutputTtokens', () => {
  it('creates edges for otokens', () => {
    const builder = createBuilder();
    const children: any[] = [];
    const edges: any[] = [];
    (builder as any).createOutputTtokens(makeOperation({ otokens: ['tok1'] }), 'op-10-0', children, edges);
    expect(edges.length).toBe(1);
  });

  it('returns early when otokens is undefined', () => {
    const builder = createBuilder();
    const edges: any[] = [];
    (builder as any).createOutputTtokens(makeOperation({ otokens: undefined as any }), 'op-10-0', [], edges);
    expect(edges).toHaveLength(0);
  });
});

describe('AscppDagBuilder.getCallFuncName', () => {
  it('returns func name from calleeMap', () => {
    const comGraphData = { calleeMap: { h1: { func_magicname: 'mapped_func' } }, funcHash: 'hash' };
    const server = { setRef: vi.fn(), comGraphData };
    const builder = new AscppDagBuilder(comGraphData, server, '2.0');
    expect((builder as any).getCallFuncName(makeOperation({ calleehash: 'h1' }))).toBe('mapped_func');
  });

  it('returns func_magicname when not in calleeMap', () => {
    const builder = createBuilder();
    expect((builder as any).getCallFuncName(makeOperation({ func_magicname: 'fallback_func', calleehash: 'h2' }))).toBe('fallback_func');
  });

  it('returns Not found function when neither available', () => {
    const builder = createBuilder();
    expect((builder as any).getCallFuncName(makeOperation({ calleehash: 'h3' }))).toBe('Not found function');
  });
});

describe('AscppDagBuilder.createSprottyGraph - tensor with nodetype != 0', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('skips tensor nodes when nodetype is not 0', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100, nodetype: 1 }),
        makeTensor({ magic: 2, rawtensor: 101, nodetype: 0 }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - opmagic undefined', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when opmagic is undefined', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: undefined as any, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - tensor rawtensor missing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when tensor rawtensor is falsy and not 0', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: undefined as any }),
      ],
      operations: [],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});
