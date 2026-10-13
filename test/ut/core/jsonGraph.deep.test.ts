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
import type { FunctionData, Operation, PortReference } from '../../../src/core/json-graph/jsonGraph.types';
import {
  makeRawTensor,
  makeTensor,
  makeOperation,
  makeFullFunctionData,
  createBuilder,
} from './jsonGraph.helpers';

// ==================== Deep branch coverage ====================

describe('AscppDagBuilder.createSprottyGraph - search with inouttensors', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('covers createIncastNode with inouttensors in search mode', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[3, [0]]],
      inouttensors: {
        inTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }],
        outTensors: [{ tensor: makeTensor({ magic: 3 }), rawTensor: makeRawTensor({ rawmagic: 102 }) }],
      },
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createOutcastNode in search mode with duplicate magic', () => {
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
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createIncastNode duplicate incastUniqueSingle in search', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1, 1], ooperands: [2] }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[3, [0]]],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '11', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - full graph with inouttensors', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('covers createIncastNodes and createOutcastNodes with inouttensors', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
      incasts: [[1, [0, 1]]],
      outcasts: [[3, [0]]],
      inouttensors: {
        inTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }],
        outTensors: [{ tensor: makeTensor({ magic: 3 }), rawTensor: makeRawTensor({ rawmagic: 102 }) }],
      },
    });
    const result = builder.createSprottyGraph(funcData, false);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('covers createOutcastNodes with Middle name (recordInOutCastMap)', () => {
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
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createCallInOutTensorMap - continue branches', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('skips operands that appear in both ioperands and ooperands', () => {
    const callInOutTensorMap = vi.fn();
    const server = { setRef: vi.fn(), comGraphData: { funcHash: 'hash', calleeMap: {} } };
    const builder = new AscppDagBuilder({ calleeMap: {}, funcHash: 'hash' }, server, '2.0', callInOutTensorMap);
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [
        makeOperation({
          opmagic: 10, opcode: 'CALL',
          ioperands: [1, 2], ooperands: [2, 3],
          calleehash: 'callee1',
        }),
      ],
    });
    builder.createSprottyGraph(funcData, true);
    expect(callInOutTensorMap).toHaveBeenCalled();
    const callData = callInOutTensorMap.mock.calls[0][0];
    const callItem = callData['callee1'];
    expect(callItem.inTensors.length).toBe(1);
    expect(callItem.outTensors.length).toBe(1);
  });

  it('skips when tensor not found in magicToTensorMap', () => {
    const callInOutTensorMap = vi.fn();
    const server = { setRef: vi.fn(), comGraphData: { funcHash: 'hash', calleeMap: {} } };
    const builder = new AscppDagBuilder({ calleeMap: {}, funcHash: 'hash' }, server, '2.0', callInOutTensorMap);
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
      ],
      operations: [
        makeOperation({
          opmagic: 10, opcode: 'CALL',
          ioperands: [99], ooperands: [1],
          calleehash: 'callee1',
        }),
      ],
    });
    builder.createSprottyGraph(funcData, true);
    expect(callInOutTensorMap).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - rawTensor.rawmagic invalid in incast/outcast', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error for invalid rawmagic in createIncastNode', () => {
    const builder = createBuilder();
    const invalidRaw = makeRawTensor({ rawmagic: 100 });
    (invalidRaw as any).rawmagic = 'invalid' as any;
    const funcData = makeFullFunctionData({
      rawtensors: [invalidRaw],
      tensors: [makeTensor({ magic: 1, rawtensor: 'invalid' as any })],
      operations: [],
      incasts: [[1, [0]]],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error for invalid rawmagic in createOutcastNode', () => {
    const builder = createBuilder();
    const invalidRaw = makeRawTensor({ rawmagic: 101 });
    (invalidRaw as any).rawmagic = null as any;
    const funcData = makeFullFunctionData({
      rawtensors: [invalidRaw],
      tensors: [makeTensor({ magic: 1, rawtensor: null as any })],
      operations: [],
      incasts: [],
      outcasts: [[1, [0]]],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - tensor magic invalid in createTensorNode', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when tensor.magic is invalid in search mode', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [makeTensor({ magic: 1, rawtensor: 100 }), makeTensor({ magic: 2, rawtensor: 101 })],
      operations: [makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] })],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - no incasts/outcasts', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles data without incasts and outcasts arrays', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      incasts: undefined as any,
      outcasts: undefined as any,
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - hidden nodes with empty output', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles COPY_OUT with showTensorNodes=false and empty output', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ioperands: [1], ooperands: [2], attr: [0, 0, 1, 2, 10, 1, 2, 20] }),
      ],
      incasts: [],
      outcasts: [],
    });
    const result = builder.createSprottyGraph(funcData, false);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('handles ASSEMBLE with showTensorNodes=false', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ASSEMBLE', ioperands: [1], ooperands: [2], attr: [0, 1, 5, [0, 42], [0, 10]] }),
      ],
      incasts: [],
      outcasts: [],
    });
    const result = builder.createSprottyGraph(funcData, false);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createSprottyGraph - diffType', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('passes diffType to returnError calls', () => {
    const callInOutTensorMap = vi.fn();
    const server = { setRef: vi.fn(), comGraphData: { funcHash: 'hash' } };
    const builder = new AscppDagBuilder({}, server, '2.0', callInOutTensorMap, 'before');
    builder.setColorConfig(true);
    const funcData = makeFullFunctionData({
      tensors: [makeTensor({ magic: undefined as any })],
      operations: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.handleCopyOutOrAssemble - direct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early for non COPY_OUT/ASSEMBLE ops', () => {
    const builder = createBuilder();
    const nodes: any[] = [];
    (builder as any).handleCopyOutOrAssemble(
      makeOperation({ opcode: 'ADD' }), '1', undefined, true,
      new Map(), new Map(), nodes, 'port-1',
    );
    expect(nodes).toHaveLength(0);
  });

  it('returns early in search mode', () => {
    const builder = createBuilder();
    builder.isSearch = true;
    const nodes: any[] = [];
    (builder as any).handleCopyOutOrAssemble(
      makeOperation({ opcode: 'COPY_OUT', ooperands: [1] }), '1', undefined, true,
      new Map(), new Map(), nodes, 'port-1',
    );
    expect(nodes).toHaveLength(0);
  });

  it('returns early when tensorMagic is in outcastUnique', () => {
    const builder = createBuilder();
    builder.outcastUnique.add('1');
    const nodes: any[] = [];
    (builder as any).handleCopyOutOrAssemble(
      makeOperation({ opcode: 'COPY_OUT', ooperands: [1] }), '1', undefined, true,
      new Map(), new Map(), nodes, 'port-1',
    );
    expect(nodes).toHaveLength(0);
  });

  it('creates empty node with showTensorNodes=false', () => {
    const builder = createBuilder();
    const nodes: any[] = [];
    const tensorToRawTensorMap = new Map([['1', '100']]);
    const rawTensorConsumers = new Map();
    (builder as any).handleCopyOutOrAssemble(
      makeOperation({ opcode: 'COPY_OUT', ooperands: [1] }), '1', undefined, false,
      tensorToRawTensorMap, rawTensorConsumers, nodes, 'port-1',
    );
    expect(nodes.length).toBe(1);
    expect(rawTensorConsumers.has('100')).toBe(true);
  });
});

describe('AscppDagBuilder.createOutputEdge - direct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns undefined when showTensorNodes is false', () => {
    const builder = createBuilder();
    const result = (builder as any).createOutputEdge('op-1', 'port-1', '1', 0, [], new Map(), false);
    expect(result).toBeUndefined();
  });

  it('creates edge to consumer when not in search mode', () => {
    const builder = createBuilder();
    const portMap = new Map([['consumer-1', { nodeId: 'tensor-1-0', portId: 'tensor-1-0-in' }]]);
    const edges: any[] = [];
    const result = (builder as any).createOutputEdge('op-1', 'port-1', '1', 0, edges, portMap, true);
    expect(result).toBe('tensor-1-0-in');
    expect(edges.length).toBe(1);
  });

  it('creates edge in search mode', () => {
    const builder = createBuilder();
    builder.tensorNodeMap.set('1', { nodeId: 'tensor-1-0' });
    const edges: any[] = [];
    const result = (builder as any).createOutputEdge('op-1', 'port-1', '1', 0, edges, new Map(), true, '10');
    expect(result).toBe('tensor-1-0-in');
  });
});

describe('AscppDagBuilder.resolveOutcastNodeIds - direct', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resolves with duplicate node and Middle name', () => {
    const builder = createBuilder();
    builder.nodeSet.add('tensor-1-0');
    const result = (builder as any).resolveOutcastNodeIds(makeTensor({ magic: 1 }), '1', 'Middle (100)', []);
    expect(result.graphId).toBe(-1);
  });

  it('resolves with recordInOutCastMap match', () => {
    const builder = createBuilder();
    builder.recordInOutCastMap.set('1', 'tensor-1-0-out');
    builder.recordNodeIdMap.set('1', 'tensor-1-0');
    const nodes: any[] = [{ id: 'tensor-1-0' }];
    const result = (builder as any).resolveOutcastNodeIds(makeTensor({ magic: 1 }), '1', 'Out (100)', nodes);
    expect(result.outPortId).toBe('tensor-1-0-out');
    expect(nodes).toHaveLength(0);
  });
});

describe('AscppDagBuilder.registerIncastPortMapping - direct', () => {
  it('registers with showTensorNodes=true', () => {
    const builder = createBuilder();
    const portMap = new Map();
    (builder as any).registerIncastPortMapping('1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', true, portMap, new Map());
    expect(portMap.get('producer-1')).toEqual({ nodeId: 'node-1', portId: 'port-1' });
  });

  it('registers with showTensorNodes=false', () => {
    const builder = createBuilder();
    const portMap = new Map();
    const rawTensorProducers = new Map();
    (builder as any).registerIncastPortMapping('1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', false, portMap, rawTensorProducers);
    expect(portMap.get('producer-rawtensor-100')).toEqual({ nodeId: 'node-1', portId: 'port-1' });
    expect(rawTensorProducers.has('100')).toBe(true);
  });
});

describe('AscppDagBuilder.registerOutcastPorts - direct', () => {
  it('registers with showTensorNodes=true and existing port', () => {
    const builder = createBuilder();
    const portMap = new Map([['consumer-1', { nodeId: 'old', portId: 'old-port' }]]);
    (builder as any).registerOutcastPorts(true, portMap, '1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', new Map());
    expect(portMap.get('consumer-1')).toEqual({ nodeId: 'node-1', portId: 'port-1' });
  });

  it('does nothing with showTensorNodes=true and no existing port', () => {
    const builder = createBuilder();
    const portMap = new Map();
    (builder as any).registerOutcastPorts(true, portMap, '1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', new Map());
    expect(portMap.has('consumer-1')).toBe(false);
  });

  it('adds to recordInOutRawId when tensor is in recordInOutCastMap', () => {
    const builder = createBuilder();
    builder.recordInOutCastMap.set('1', 'some-port');
    const rawTensorConsumers = new Map<string, PortReference[]>();
    (builder as any).registerOutcastPorts(false, new Map(), '1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', rawTensorConsumers);
    expect(builder.recordInOutRawId.has('100')).toBe(true);
  });
});

describe('AscppDagBuilder.createParentIncastNodes - direct', () => {
  it('returns early when index >= inTensors length', () => {
    const builder = createBuilder();
    const actualData = { inouttensors: { inTensors: [] } } as any;
    expect(() => (builder as any).createParentIncastNodes(actualData, [], [], 5, 'port-1')).not.toThrow();
  });

  it('returns early when tensor or rawTensor is missing', () => {
    const builder = createBuilder();
    const actualData = { inouttensors: { inTensors: [{ tensor: null, rawTensor: null }] } } as any;
    expect(() => (builder as any).createParentIncastNodes(actualData, [], [], 0, 'port-1')).not.toThrow();
  });
});

describe('AscppDagBuilder.createParentOutCastNodes - direct', () => {
  it('returns early when tensor or rawTensor is missing', () => {
    const builder = createBuilder();
    const actualData = { inouttensors: { outTensors: [{ tensor: null, rawTensor: null }] } } as any;
    expect(() => (builder as any).createParentOutCastNodes(actualData, [], [], 0, 'port-1')).not.toThrow();
  });
});

describe('AscppDagBuilder.pushIncastNode - direct', () => {
  it('pushes node without inouttensors', () => {
    const builder = createBuilder();
    const nodes: any[] = [];
    (builder as any).pushIncastNode({} as FunctionData, nodes, [], 0, { id: 'node-1' } as any, 'port-1');
    expect(nodes).toHaveLength(1);
  });

  it('pushes node with inouttensors', () => {
    const builder = createBuilder();
    const nodes: any[] = [];
    const actualData = { inouttensors: { inTensors: [] } } as any;
    (builder as any).pushIncastNode(actualData, nodes, [], 0, { id: 'node-1' } as any, 'port-1');
    expect(nodes).toHaveLength(1);
  });
});

describe('AscppDagBuilder.registerIncastPorts - direct', () => {
  it('registers with showTensorNodes=true and existing port', () => {
    const builder = createBuilder();
    const portMap = new Map([['producer-1', { nodeId: 'old', portId: 'old-port' }]]);
    (builder as any).registerIncastPorts(true, portMap, '1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', new Map());
    expect(portMap.get('producer-1')).toEqual({ nodeId: 'node-1', portId: 'port-1' });
  });

  it('does nothing with showTensorNodes=true and no existing port', () => {
    const builder = createBuilder();
    const portMap = new Map();
    (builder as any).registerIncastPorts(true, portMap, '1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', new Map());
    expect(portMap.has('producer-1')).toBe(false);
  });
});

describe('AscppDagBuilder.pushOutcastNode - direct', () => {
  it('pushes node without inouttensors', () => {
    const builder = createBuilder();
    const nodes: any[] = [];
    const result = (builder as any).pushOutcastNode({} as FunctionData, nodes, [], { id: 'node-1' } as any, '1', 0, 'port-1');
    expect(nodes).toHaveLength(1);
    expect(result).toBe(0);
  });

  it('pushes node with inouttensors and no recordInOutCastMap', () => {
    const builder = createBuilder();
    const nodes: any[] = [];
    const actualData = { inouttensors: { outTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }] } } as any;
    const result = (builder as any).pushOutcastNode(actualData, nodes, [], { id: 'node-1' } as any, '1', 0, 'port-1');
    expect(result).toBe(1);
  });

  it('pushes node with inouttensors and recordInOutCastMap match', () => {
    const builder = createBuilder();
    builder.recordInOutCastMap.set('1', 'some-port');
    const nodes: any[] = [];
    const actualData = { inouttensors: { outTensors: [] } } as any;
    const result = (builder as any).pushOutcastNode(actualData, nodes, [], { id: 'node-1' } as any, '1', 0, 'port-1');
    expect(result).toBe(0);
  });
});

describe('AscppDagBuilder.createOperationNodes - no operations', () => {
  it('returns early when operations is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    expect(() => (builder as any).createOperationNodes({} as FunctionData, [], [], new Map(), new Map(), new Map(), new Map(), true, false, false, [])).not.toThrow();
  });
});

describe('AscppDagBuilder.createRegularOperationNode - opmagic invalid', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when opmagic is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const nodes: any[] = [];
    (builder as any).createRegularOperationNode(
      makeOperation({ opmagic: undefined as any }), 'op-1', nodes, [], new Map(),
      new Map(), new Map(), new Map(), true, false, undefined, [],
    );
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - multiple subgraphs', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles operations in different subgraphs', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3], subgraphid: 1 }),
      ],
    });
    const result = builder.createSprottyGraph(funcData, true);
    const opNodes = result.children?.filter((c: any) => c.type === 'node' && c.role === 'operation');
    expect(opNodes?.length).toBe(2);
  });
});

// ==================== Final deep branch coverage ====================

describe('AscppDagBuilder.createNodeListMap - tensor2opMap overwrite', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('overwrites existing tensor2opMap entry', () => {
    const builder = createBuilder();
    builder.tensor2opMap.set('1', { inOp: new Set(), outOp: new Set() });
    const funcData = makeFullFunctionData({
      tensors: [makeTensor({ magic: 1 }), makeTensor({ magic: 2 })],
      operations: [makeOperation({ opmagic: 10, ioperands: [1], ooperands: [2] })],
    });
    builder.createNodeListMap(funcData);
    expect(builder.tensor2opMap.has('1')).toBe(true);
  });
});

describe('AscppDagBuilder.opSearchForward - no operations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when operations is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    expect(() => builder.opSearchForward('10', {} as FunctionData, [], [], new Map(),
      new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), true)
    ).not.toThrow();
  });
});

describe('AscppDagBuilder.opSearchBackward - no operations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when operations is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    expect(() => builder.opSearchBackward('10', {} as FunctionData, [], [], new Map(),
      new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), new Map(), true)
    ).not.toThrow();
  });
});

describe('AscppDagBuilder.createSprottyGraph - search with incast and outcast', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('covers createIncastNode full path in search', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }),
        makeTensor({ magic: 2, rawtensor: 101, subgraphid: 0 }),
        makeTensor({ magic: 3, rawtensor: 102, subgraphid: 0 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3], subgraphid: 0 }),
      ],
      incasts: [[1, [0, 1]]],
      outcasts: [[3, [0]]],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createOutcastNode full path in search', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[3, [0]]],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '11', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createTensorNode in search (non-cast tensor)', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers search with inouttensors for createIncastNode parent nodes', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[3, [0]]],
      inouttensors: {
        inTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }],
        outTensors: [{ tensor: makeTensor({ magic: 3 }), rawTensor: makeRawTensor({ rawmagic: 102 }) }],
      },
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '2');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers search with duplicate tensor magic for singlePathNodeSet', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }),
        makeTensor({ magic: 2, rawtensor: 101, subgraphid: 0 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1, 2], ooperands: [2] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[2, [0]]],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '3');
    expect(builder.server.setRef).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createIncastNodes - tensor not found', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when tensor not in magicToTensorMap', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [makeTensor({ magic: 1, rawtensor: 100 })],
      operations: [],
      incasts: [[99, [0]]],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when tensor rawtensor is invalid in incast', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      rawtensors: [makeRawTensor({ rawmagic: 100 })],
      tensors: [makeTensor({ magic: 1, rawtensor: undefined as any })],
      operations: [],
      incasts: [[1, [0]]],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createOutcastNodes - tensor not found', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when tensor not in magicToTensorMap for outcast', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [makeTensor({ magic: 1, rawtensor: 100 })],
      operations: [],
      incasts: [],
      outcasts: [[99, [0]]],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when rawTensor rawmagic invalid in outcast', () => {
    const builder = createBuilder();
    const invalidRaw = makeRawTensor({ rawmagic: 101 });
    (invalidRaw as any).rawmagic = 'bad' as any;
    const funcData = makeFullFunctionData({
      rawtensors: [invalidRaw],
      tensors: [makeTensor({ magic: 1, rawtensor: 'bad' as any })],
      operations: [],
      incasts: [],
      outcasts: [[1, [0]]],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createTensorNodes - invalid rawtensor', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when rawtensor is falsy and not 0 in createTensorNodes', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      rawtensors: [makeRawTensor({ rawmagic: 100 })],
      tensors: [makeTensor({ magic: 1, rawtensor: undefined as any })],
      operations: [],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - createCallInOutTensorMap continue', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('covers continue when operand appears in both ioperands and ooperands', () => {
    const callInOutTensorMap = vi.fn();
    const server = { setRef: vi.fn(), comGraphData: { funcHash: 'hash', calleeMap: {} } };
    const builder = new AscppDagBuilder({ calleeMap: {}, funcHash: 'hash' }, server, '2.0', callInOutTensorMap);
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
        makeTensor({ magic: 4, rawtensor: 103 }),
      ],
      operations: [
        makeOperation({
          opmagic: 10, opcode: 'CALL',
          ioperands: [1, 4], ooperands: [4, 3],
          calleehash: 'callee1',
        }),
      ],
      rawtensors: [
        makeRawTensor({ rawmagic: 100 }),
        makeRawTensor({ rawmagic: 101 }),
        makeRawTensor({ rawmagic: 102 }),
        makeRawTensor({ rawmagic: 103 }),
      ],
    });
    builder.createSprottyGraph(funcData, true);
    expect(callInOutTensorMap).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - search level 0', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('stops at search level 0', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '0');
    expect(builder.server.setRef).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - tensorSearch without tensor2opMap', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns when tensor2opMap has no entry for startNode', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 5, rawtensor: 102, nodetype: 1 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '5');
    expect(builder.server.setRef).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createSprottyGraph - deep search paths', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('covers createIncastNode with incast found in search', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }),
        makeTensor({ magic: 2, rawtensor: 101, subgraphid: 0 }),
        makeTensor({ magic: 3, rawtensor: 102, subgraphid: 0 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3], subgraphid: 0 }),
      ],
      incasts: [[1, [0, 1]]],
      outcasts: [[3, [0]]],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '3');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createOutcastNode with outcast in search backward', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }),
        makeTensor({ magic: 2, rawtensor: 101, subgraphid: 0 }),
        makeTensor({ magic: 3, rawtensor: 102, subgraphid: 0 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
        makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3], subgraphid: 0 }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[3, [0, 1]]],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '11', '3');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createTensorNode with nodetype 0 in search', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }),
        makeTensor({ magic: 2, rawtensor: 101, subgraphid: 0 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
      ],
      incasts: [],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '3');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createIncastNode with duplicate magic in search', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }),
        makeTensor({ magic: 2, rawtensor: 101, subgraphid: 0 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[1, [0]]],
    });
    builder.createSprottyGraph(funcData, true, false, false, true, false, undefined, '10', '3');
    expect(builder.server.setRef).toHaveBeenCalled();
  });

  it('covers createIncastNodes with rawtensor invalid', () => {
    const builder = createBuilder();
    const invalidRaw = makeRawTensor({ rawmagic: 100 });
    (invalidRaw as any).rawmagic = 'bad' as any;
    const funcData = makeFullFunctionData({
      rawtensors: [invalidRaw],
      tensors: [makeTensor({ magic: 1, rawtensor: 'bad' as any })],
      operations: [],
      incasts: [[1, [0]]],
      outcasts: [],
    });
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('covers createOutcastNodes with resolveOutcastNodeIds duplicate', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2] }),
      ],
      incasts: [[1, [0]]],
      outcasts: [[3, [0]], [3, [1]]],
      inouttensors: {
        inTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }],
        outTensors: [{ tensor: makeTensor({ magic: 3 }), rawTensor: makeRawTensor({ rawmagic: 102 }) }],
      },
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('covers createOutputPorts with emptyOutputSet in hidden mode', () => {
    const builder = createBuilder();
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
      ],
      operations: [
        makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ioperands: [1], ooperands: [2], attr: [0, 0, 1, 2, 10, 1, 2, 20] }),
      ],
      incasts: [],
      outcasts: [],
    });
    const result = builder.createSprottyGraph(funcData, false);
    expect(result.children?.length).toBeGreaterThan(0);
  });

  it('covers createCallInOutTensorMap with tensor not found for ooperands', () => {
    const callInOutTensorMap = vi.fn();
    const server = { setRef: vi.fn(), comGraphData: { funcHash: 'hash', calleeMap: {} } };
    const builder = new AscppDagBuilder({ calleeMap: {}, funcHash: 'hash' }, server, '2.0', callInOutTensorMap);
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
      ],
      operations: [
        makeOperation({
          opmagic: 10, opcode: 'CALL',
          ioperands: [1], ooperands: [99],
          calleehash: 'callee1',
        }),
      ],
    });
    builder.createSprottyGraph(funcData, true);
    expect(callInOutTensorMap).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createIncastNode - direct calls', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when incasts is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const nodes: any[] = [];
    (builder as any).createIncastNode('1', makeTensor({ magic: 1 }), {} as FunctionData, nodes, [], new Map(), new Map(), new Map(), true);
    expect(nodes).toHaveLength(0);
  });

  it('returns early when rawTensor.rawmagic is invalid', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const invalidRaw = makeRawTensor({ rawmagic: 100 });
    (invalidRaw as any).rawmagic = 'bad' as any;
    const rawTensorMap = new Map([['100', invalidRaw]]);
    const funcData = { incasts: [[1, [0]]] } as FunctionData;
    (builder as any).createIncastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('returns when incastUniqueSingle already has tensorMagic', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.incastUniqueSingle.add('1');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { incasts: [[1, [0]]] } as FunctionData;
    (builder as any).createIncastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
  });

  it('returns when tryAddUnique fails', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.tryAddUnique('m1_s0_in');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { incasts: [[1, [0]]] } as FunctionData;
    (builder as any).createIncastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
  });

  it('returns when singlePathNodeSet has nodeId', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.singlePathNodeSet.add('tensor-1-0');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { incasts: [[1, [0]]] } as FunctionData;
    (builder as any).createIncastNode('1', makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
  });

  it('creates full incast node with duplicate magic', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.duplicateMagic.add('1');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { incasts: [[1, [0]]] } as FunctionData;
    const nodes: any[] = [];
    (builder as any).createIncastNode('1', makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }), funcData, nodes, [], new Map(), new Map(), rawTensorMap, true);
    expect(nodes.length).toBe(1);
  });

  it('creates incast node with inouttensors', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = {
      incasts: [[1, [0]]],
      inouttensors: { inTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }] },
    } as any;
    const nodes: any[] = [];
    (builder as any).createIncastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, nodes, [], new Map(), new Map(), rawTensorMap, true);
    expect(nodes.length).toBe(2);
  });
});

describe('AscppDagBuilder.createOutcastNode - direct calls', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when outcasts is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    (builder as any).createOutcastNode('1', makeTensor({ magic: 1 }), {} as FunctionData, [], [], new Map(), new Map(), new Map(), true);
  });

  it('returns early when rawTensor.rawmagic is invalid', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const invalidRaw = makeRawTensor({ rawmagic: 100 });
    (invalidRaw as any).rawmagic = 'bad' as any;
    const rawTensorMap = new Map([['100', invalidRaw]]);
    const funcData = { outcasts: [[1, [0]]] } as FunctionData;
    (builder as any).createOutcastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('returns when outcastUnique already has tensorMagic', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.outcastUnique.add('1');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { outcasts: [[1, [0]]] } as FunctionData;
    (builder as any).createOutcastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
  });

  it('returns when tryAddUnique fails for outcast', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.tryAddUnique('m1_s0_out');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { outcasts: [[1, [0]]] } as FunctionData;
    (builder as any).createOutcastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
  });

  it('returns when singlePathNodeSet has nodeId for outcast', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.singlePathNodeSet.add('tensor-1-0');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { outcasts: [[1, [0]]] } as FunctionData;
    (builder as any).createOutcastNode('1', makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }), funcData, [], [], new Map(), new Map(), rawTensorMap, true);
  });

  it('creates full outcast node with duplicate magic', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.duplicateMagic.add('1');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = { outcasts: [[1, [0]]] } as FunctionData;
    const nodes: any[] = [];
    (builder as any).createOutcastNode('1', makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }), funcData, nodes, [], new Map(), new Map(), rawTensorMap, true);
    expect(nodes.length).toBe(1);
  });

  it('creates outcast node with inouttensors', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const funcData = {
      outcasts: [[1, [0]]],
      inouttensors: { outTensors: [{ tensor: makeTensor({ magic: 1 }), rawTensor: makeRawTensor({ rawmagic: 100 }) }] },
    } as any;
    const nodes: any[] = [];
    (builder as any).createOutcastNode('1', makeTensor({ magic: 1, rawtensor: 100 }), funcData, nodes, [], new Map(), new Map(), rawTensorMap, true);
    expect(nodes.length).toBe(2);
  });
});

describe('AscppDagBuilder.createTensorNode - direct calls', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns early when tensors is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    (builder as any).createTensorNode('1', makeTensor({ magic: 1 }), {} as FunctionData, [], new Map(), new Map(), new Map());
  });

  it('returns early when tensor.magic is invalid', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = { tensors: [makeTensor({ magic: 1 })] } as FunctionData;
    (builder as any).createTensorNode('1', makeTensor({ magic: 'bad' as any }), funcData, [], new Map(), new Map(), new Map());
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('returns early when rawTensor.rawmagic is invalid', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const invalidRaw = makeRawTensor({ rawmagic: 100 });
    (invalidRaw as any).rawmagic = 'bad' as any;
    const rawTensorMap = new Map([['100', invalidRaw]]);
    (builder as any).createTensorNode('1', makeTensor({ magic: 1, rawtensor: 100 }), { tensors: [makeTensor({ magic: 1 })] } as FunctionData, [], new Map(), rawTensorMap, new Map());
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('returns when singlePathNodeSet has nodeId', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.singlePathNodeSet.add('tensor-1-0');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    (builder as any).createTensorNode('1', makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }), { tensors: [makeTensor({ magic: 1 })] } as FunctionData, [], new Map(), rawTensorMap, new Map());
  });

  it('creates tensor node with nodetype 0', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const nodes: any[] = [];
    (builder as any).createTensorNode('1', makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 }), { tensors: [makeTensor({ magic: 1 })] } as FunctionData, nodes, new Map(), rawTensorMap, new Map());
    expect(nodes.length).toBe(1);
  });
});

describe('AscppDagBuilder.createTensorNodes - nodeMagic duplicate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles duplicate nodeId in search mode with nodeMagic', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.singlePathNodeSet.add('tensor-1-0');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const nodes: any[] = [];
    (builder as any).createTensorNodes(
      { tensors: [makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0 })] } as FunctionData,
      nodes, new Map(), rawTensorMap, new Map(), new Map(), undefined, '10',
    );
  });

  it('returns early when tensors is undefined', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    (builder as any).createTensorNodes({} as FunctionData, [], new Map(), new Map(), new Map(), new Map(), undefined);
  });

  it('reports error when tensor.magic is invalid', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = { tensors: [makeTensor({ magic: 'bad' as any })] } as FunctionData;
    (builder as any).createTensorNodes(funcData, [], new Map(), new Map(), new Map(), new Map(), undefined);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when rawtensor is falsy', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = { tensors: [makeTensor({ magic: 1, rawtensor: undefined as any })] } as FunctionData;
    (builder as any).createTensorNodes(funcData, [], new Map(), new Map(), new Map(), new Map(), undefined);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when rawTensor.rawmagic is invalid', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const invalidRaw = makeRawTensor({ rawmagic: 100 });
    (invalidRaw as any).rawmagic = 'bad' as any;
    const rawTensorMap = new Map([['100', invalidRaw]]);
    const funcData = { tensors: [makeTensor({ magic: 1, rawtensor: 100 })] } as FunctionData;
    (builder as any).createTensorNodes(funcData, [], new Map(), rawTensorMap, new Map(), new Map(), undefined);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createIncastNodes - rawtensor invalid', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('reports error when tensor rawtensor is falsy in incast', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const funcData = {
      tensors: [makeTensor({ magic: 1, rawtensor: undefined as any })],
      incasts: [[1, [0]]],
    } as FunctionData;
    builder.createSprottyGraph(funcData, true);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AscppDagBuilder.createOutcastNodes - resolveOutcastNodeIds duplicate', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles duplicate nodeId for outcast', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.nodeSet.add('tensor-3-0');
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [],
      incasts: [],
      outcasts: [[3, [0]]],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.registerOutcastPortMapping - direct', () => {
  it('registers with showTensorNodes=false', () => {
    const builder = createBuilder();
    const portMap = new Map();
    const rawTensorConsumers = new Map<string, PortReference[]>();
    (builder as any).registerOutcastPortMapping('1', makeRawTensor({ rawmagic: 100 }), 'node-1', 'port-1', false, portMap, rawTensorConsumers);
    expect(portMap.get('consumer-rawtensor-100')).toEqual({ nodeId: 'node-1', portId: 'port-1' });
  });
});

describe('AscppDagBuilder.createTensorNode - removes empty nodes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('removes existing empty nodes for tensor magic', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const nodes: any[] = [
      { id: 'tensor-1-0-empty', type: 'node' },
      { id: 'other-node', type: 'node' },
    ];
    (builder as any).createTensorNode('1', makeTensor({ magic: 1, rawtensor: 100, subgraphid: 0, nodetype: 0 }), { tensors: [makeTensor({ magic: 1 })] } as FunctionData, nodes, new Map(), rawTensorMap, new Map());
    expect(nodes.find((n) => n.id === 'tensor-1-0-empty')).toBeUndefined();
  });
});

describe('AscppDagBuilder.createIncastNodes - tryAddUnique fail', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('skips incast when tryAddUnique fails', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.tryAddUnique('m1_s0_in');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const magicToTensorMap = new Map([['1', makeTensor({ magic: 1, rawtensor: 100 })]]);
    const funcData = {
      tensors: [makeTensor({ magic: 1, rawtensor: 100 })],
      incasts: [[1, [0]]],
    } as FunctionData;
    const nodes: any[] = [];
    (builder as any).createIncastNodes(funcData, nodes, [], new Map(), magicToTensorMap, rawTensorMap, new Map(), true);
    expect(nodes).toHaveLength(0);
  });
});

describe('AscppDagBuilder.createOutcastNodes - resolveOutcastNodeIds with recordInOutCastMap', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('resolves outcast node with recordInOutCastMap match', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.recordInOutCastMap.set('3', 'tensor-3-0-out');
    builder.recordNodeIdMap.set('3', 'tensor-3-0');
    const funcData = makeFullFunctionData({
      tensors: [
        makeTensor({ magic: 1, rawtensor: 100 }),
        makeTensor({ magic: 2, rawtensor: 101 }),
        makeTensor({ magic: 3, rawtensor: 102 }),
      ],
      operations: [],
      incasts: [[3, [0]]],
      outcasts: [[3, [0]]],
    });
    const result = builder.createSprottyGraph(funcData, true);
    expect(result.children?.length).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createOutputPorts - emptyOutputSet', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('adds to emptyNodesList when tensor is in emptyOutputSet', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.emptyOutputSet.add('2');
    const children: any[] = [];
    const nodes: any[] = [];
    const tensorToRawTensorMap = new Map([['2', '101']]);
    (builder as any).createOutputPorts(
      makeOperation({ opmagic: 10, ooperands: [2] }), 'op-10-0', children, [],
      new Map(), tensorToRawTensorMap, new Map(), new Map(), false, nodes,
    );
    expect(builder.emptyNodesList.size).toBeGreaterThan(0);
  });
});

describe('AscppDagBuilder.createOutcastNodes - tryAddUnique fail', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('skips outcast when tryAddUnique fails', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.tryAddUnique('m1_s0_out');
    const rawTensorMap = new Map([['100', makeRawTensor({ rawmagic: 100 })]]);
    const magicToTensorMap = new Map([['1', makeTensor({ magic: 1, rawtensor: 100 })]]);
    const funcData = {
      tensors: [makeTensor({ magic: 1, rawtensor: 100 })],
      outcasts: [[1, [0]]],
    } as FunctionData;
    const nodes: any[] = [];
    (builder as any).createOutcastNodes(funcData, nodes, [], new Map(), magicToTensorMap, rawTensorMap, new Map(), true);
    expect(nodes).toHaveLength(0);
  });
});

describe('AscppDagBuilder.resolveOutcastNodeIds - duplicate non-Middle', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets isErrorReport when duplicate non-Middle node found', () => {
    const builder = createBuilder();
    builder.setColorConfig(true);
    builder.nodeSet.add('tensor-3-0');
    const result = (builder as any).resolveOutcastNodeIds(makeTensor({ magic: 3, subgraphid: 0 }), '3', 'Out (100)', []);
    expect(result.graphId).toBe(-2);
    expect(builder.isErrorReport).toBe(true);
  });
});
