/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('i18next', () => ({
  t: (key: string) => key,
}));

vi.mock(import('../../../src/handler/baseGraphMsgHandler'), () => ({
  BaseGraphMsgHandler: {
    returnError: vi.fn(),
  },
}));

import {
  hasSameCoordinationScope,
  addPhaseGroupingInfo,
  hasValidStructure,
  initializeDataStructures,
  createTensorMaps,
  parseCopyOp,
  parseConvertOp,
  parseAssembleViewOp,
  filterSubgraph,
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
  createSyncControlFlowEdges,
  createSyncCoordinationEdges,
  createPhaseCoordinationEdges,
  buildTensorNodeObject,
  buildTensorNodesObject,
  extractTensorMagicFromPortId,
  markEmptyNodeEdgesAsDashed,
  createEmptyNodesForSearch,
} from '../../../src/core/json-graph/utils';
import { AttrReader } from '../../../src/core/json-graph/parseSymbolicAttr';
import type { FunctionData, Operation, Tensor, RawTensor, PortReference } from '../../../src/core/json-graph/jsonGraph.types';

function makeRawTensor(overrides: Partial<RawTensor> = {}): RawTensor {
  return { kind: 0, rawmagic: 100, rawshape: [1, 2], datatype: 6, symbol: 'data', ...overrides };
}

function makeTensor(overrides: Partial<Tensor> = {}): Tensor {
  return {
    magic: 1, rawtensor: 100, offset: [0], nodetype: 0, format: 0, shape: [1, 2], kind: 0,
    semantic_label: { label: '' }, compareType: undefined, ...overrides,
  };
}

function makeOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    kind: 0, opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2],
    semantic_label: { label: '' }, compareType: undefined, ...overrides,
  };
}

function makeServer(): any {
  return { comGraphData: { funcHash: 'test-hash' } };
}

describe('hasSameCoordinationScope', () => {
  it('returns true when pipe_ids match', () => {
    const op1 = makeOperation({ sync_queue: { pipe_id: 1 } });
    const op2 = makeOperation({ sync_queue: { pipe_id: 1 } });
    expect(hasSameCoordinationScope(op1, op2)).toBe(true);
  });

  it('returns false when pipe_ids differ', () => {
    const op1 = makeOperation({ sync_queue: { pipe_id: 1 } });
    const op2 = makeOperation({ sync_queue: { pipe_id: 2 } });
    expect(hasSameCoordinationScope(op1, op2)).toBe(false);
  });

  it('returns true when both pipe_ids default to 0', () => {
    const op1 = makeOperation({});
    const op2 = makeOperation({});
    expect(hasSameCoordinationScope(op1, op2)).toBe(true);
  });
});

describe('addPhaseGroupingInfo', () => {
  it('adds phase info to nodes based on PHASE operations', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'PHASE1' }),
      makeOperation({ opmagic: 2, opcode: 'ADD', subgraphid: 1 }),
    ];
    const nodes: any[] = [
      { id: 'operation-magic-1' },
      { id: 'operation-magic-2' },
    ];
    addPhaseGroupingInfo({ operations: ops } as FunctionData, nodes);
    expect((nodes[0] as any).phase).toBe(1);
    expect((nodes[1] as any).phase).toBe(1);
    expect((nodes[1] as any).subgraphId).toBe(1);
  });

  it('handles PHASE2 transition', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'PHASE1' }),
      makeOperation({ opmagic: 2, opcode: 'PHASE2' }),
      makeOperation({ opmagic: 3, opcode: 'ADD' }),
    ];
    const nodes: any[] = [
      { id: 'operation-magic-1' },
      { id: 'operation-magic-2' },
      { id: 'operation-magic-3' },
    ];
    addPhaseGroupingInfo({ operations: ops } as FunctionData, nodes);
    expect((nodes[2] as any).phase).toBe(2);
  });

  it('does nothing when operations is undefined', () => {
    const nodes: any[] = [{ id: 'x' }];
    addPhaseGroupingInfo({} as FunctionData, nodes);
    expect((nodes[0] as any).phase).toBeUndefined();
  });

  it('skips nodes not found in nodes array', () => {
    const ops = [makeOperation({ opmagic: 1, opcode: 'PHASE1' })];
    const nodes: any[] = [{ id: 'other-node' }];
    expect(() => addPhaseGroupingInfo({ operations: ops } as FunctionData, nodes)).not.toThrow();
  });
});

describe('hasValidStructure', () => {
  it('returns true when rawtensors exists', () => {
    expect(hasValidStructure({ rawtensors: [] } as FunctionData)).toBe(true);
  });

  it('returns true when tensors exists', () => {
    expect(hasValidStructure({ tensors: [] } as FunctionData)).toBe(true);
  });

  it('returns true when operations exists', () => {
    expect(hasValidStructure({ operations: [] } as FunctionData)).toBe(true);
  });

  it('returns false when none exist', () => {
    expect(hasValidStructure({} as FunctionData)).toBe(false);
  });
});

describe('initializeDataStructures', () => {
  it('returns empty data structures', () => {
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
  it('creates rawTensorMap keyed by rawmagic', () => {
    const rt1 = makeRawTensor({ rawmagic: 100 });
    const rt2 = makeRawTensor({ rawmagic: 101 });
    const result = createTensorMaps({ rawtensors: [rt1, rt2] } as FunctionData);
    expect(result.rawTensorMap.get('100')).toBe(rt1);
    expect(result.rawTensorMap.get('101')).toBe(rt2);
  });

  it('creates magicToTensorMap and tensorToRawTensorMap', () => {
    const t1 = makeTensor({ magic: 1, rawtensor: 100 });
    const result = createTensorMaps({ tensors: [t1] } as FunctionData);
    expect(result.magicToTensorMap.get('1')).toBe(t1);
    expect(result.tensorToRawTensorMap.get('1')).toBe('100');
  });

  it('creates inoutMap from incasts', () => {
    const result = createTensorMaps({ incasts: [1, [2, [0]]] } as FunctionData);
    expect(result.inoutMap.get('incasts')?.has('1')).toBe(true);
    expect(result.inoutMap.get('incasts')?.has('2')).toBe(true);
  });

  it('creates inoutMap from outcasts', () => {
    const result = createTensorMaps({ outcasts: [[3, [0]]] } as FunctionData);
    expect(result.inoutMap.get('outcasts')?.has('3')).toBe(true);
  });

  it('handles missing data gracefully', () => {
    const result = createTensorMaps({} as FunctionData);
    expect(result.rawTensorMap.size).toBe(0);
    expect(result.magicToTensorMap.size).toBe(0);
    expect(result.inoutMap.size).toBe(0);
  });
});

describe('parseCopyOp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses copy_in operation', () => {
    const server = makeServer();
    // attr: [flag(0), memType(0=MEM_UB), offsetSize(1), kind(2=int), value(10), shapeSize(1), kind(2=int), value(20)]
    const reader = new AttrReader(server, [0, 0, 1, 2, 10, 1, 2, 20]);
    const labelAttr: string[] = [];
    parseCopyOp(labelAttr, reader, false, '2.0');
    expect(labelAttr.some((l) => l.includes('shape:'))).toBe(true);
    expect(labelAttr.some((l) => l.includes('from offset:'))).toBe(true);
    expect(labelAttr.some((l) => l.includes('to:'))).toBe(true);
  });

  it('parses copy_out operation', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [0, 1, 1, 2, 10, 1, 2, 20]);
    const labelAttr: string[] = [];
    parseCopyOp(labelAttr, reader, true, '2.0');
    expect(labelAttr.some((l) => l.includes('from:'))).toBe(true);
    expect(labelAttr.some((l) => l.includes('to offset:'))).toBe(true);
  });
});

describe('parseConvertOp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses convert operation with from and to mem types', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [0, 1]);
    const labelAttr: string[] = [];
    parseConvertOp(labelAttr, reader);
    expect(labelAttr).toContain('from: MEM_UB');
    expect(labelAttr).toContain('to: MEM_L1');
  });
});

describe('parseAssembleViewOp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses assemble operation', () => {
    const server = makeServer();
    // attr: [toMemType(0), offsetSize(1), offset(5), dynOffsetSize(1), expr[0,42], dynShapeSize(1), expr[0,10]]
    const reader = new AttrReader(server, [0, 1, 5, 1, [0, 42], 1, [0, 10]]);
    const labelAttr: string[] = [];
    parseAssembleViewOp(labelAttr, reader, true, '2.0');
    expect(labelAttr.some((l) => l.includes('shape:'))).toBe(true);
    expect(labelAttr.some((l) => l.includes('from:'))).toBe(true);
    expect(labelAttr.some((l) => l.includes('to offset:'))).toBe(true);
  });

  it('parses view operation', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [0, 1, 5, 1, [0, 42], 1, [0, 10]]);
    const labelAttr: string[] = [];
    parseAssembleViewOp(labelAttr, reader, false, '2.0');
    expect(labelAttr.some((l) => l.includes('from offset:'))).toBe(true);
    expect(labelAttr.some((l) => l.includes('to:'))).toBe(true);
  });
});

describe('filterSubgraph', () => {
  it('filters nodes and edges by subgraph id', () => {
    const nodes: any[] = [
      { id: 'op-1', role: 'operation', subgraphId: 0 },
      { id: 'op-2', role: 'operation', subgraphId: 1 },
      { id: 'tensor-1-0', role: 'tensor' },
    ];
    const edges: any[] = [
      { sourceId: 'op-1-out', targetId: 'tensor-1-0-in', type: 'edge' },
      { sourceId: 'op-2-out', targetId: 'tensor-1-0-in', type: 'edge' },
    ];
    const [filteredEdges, filteredNodes] = filterSubgraph(0, nodes, edges);
    expect(filteredNodes.some((n) => n.id === 'op-1')).toBe(true);
    expect(filteredNodes.some((n) => n.id === 'op-2')).toBe(false);
  });

  it('returns empty arrays when no nodes match', () => {
    const nodes: any[] = [{ id: 'op-1', role: 'operation', subgraphId: 1 }];
    const edges: any[] = [];
    const [filteredEdges, filteredNodes] = filterSubgraph(0, nodes, edges);
    expect(filteredNodes).toHaveLength(0);
    expect(filteredEdges).toHaveLength(0);
  });
});

describe('findIncastIndex', () => {
  it('finds index by tensor magic', () => {
    const data = { incasts: [[1, [0]], [2, [1]]] } as FunctionData;
    expect(findIncastIndex(data, '1')).toBe(0);
    expect(findIncastIndex(data, '2')).toBe(1);
  });

  it('returns undefined when not found', () => {
    const data = { incasts: [[1, [0]]] } as FunctionData;
    expect(findIncastIndex(data, '99')).toBeUndefined();
  });
});

describe('findOutcastIndex', () => {
  it('finds index by tensor magic', () => {
    const data = { outcasts: [[3, [0]], [4, [1]]] } as FunctionData;
    expect(findOutcastIndex(data, '3')).toBe(0);
    expect(findOutcastIndex(data, '4')).toBe(1);
  });

  it('returns undefined when not found', () => {
    const data = { outcasts: [[3, [0]]] } as FunctionData;
    expect(findOutcastIndex(data, '99')).toBeUndefined();
  });
});

describe('removeEmptyNodesForTensor', () => {
  it('removes nodes ending with "empty" that contain tensorMagic', () => {
    const nodes: any[] = [
      { id: 'tensor-5-0-empty' },
      { id: 'tensor-5-0' },
      { id: 'tensor-3-0-empty' },
    ];
    removeEmptyNodesForTensor(nodes, '5');
    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === 'tensor-5-0-empty')).toBeUndefined();
  });

  it('does nothing when no matching nodes', () => {
    const nodes: any[] = [{ id: 'tensor-1-0' }];
    removeEmptyNodesForTensor(nodes, '99');
    expect(nodes).toHaveLength(1);
  });
});

describe('buildTensorMetadataCompartment', () => {
  it('builds compartment with labels from parts', () => {
    const result = buildTensorMetadataCompartment('node-1', ['shape: [1,2]', 'dtype: fp16']);
    expect(result.type).toBe('compartment');
    expect(result.id).toBe('node-1-metadata-compartment');
    expect(result.children).toHaveLength(2);
  });

  it('truncates values longer than 32 chars', () => {
    const longValue = 'a'.repeat(40);
    const result = buildTensorMetadataCompartment('node-1', [`key: ${longValue}`]);
    const label = result.children![0] as any;
    expect(label.text).toContain('...');
    expect(label.text.length).toBeLessThan(`key: ${longValue}`.length + 3);
  });
});

describe('createEmptyNodeWithPort', () => {
  it('creates an empty node with input and output ports', () => {
    const result = createEmptyNodeWithPort('tensor-5-0-in', '5');
    expect(result.type).toBe('node');
    expect(result.role).toBe('output');
    expect(result.isEmptyNode).toBe(true);
    expect(result.id).toBe('tensor-5-0');
    expect(result.children).toHaveLength(3);
  });
});

describe('createTokenNode', () => {
  it('creates a token node with label and ports', () => {
    const result = createTokenNode('operation-token1-0-in', 'token1');
    expect(result.type).toBe('node');
    expect(result.isTokenNode).toBe(true);
    expect(result.children).toHaveLength(3);
  });
});

describe('getCastNodeState', () => {
  it('returns error state when tensor magic is in errNodeList', () => {
    const errNodeList = new Set([1]);
    const tensor = makeTensor({ magic: 1 });
    const rawTensor = makeRawTensor({ rawmagic: 100 });
    const result = getCastNodeState(tensor, rawTensor, 'output', errNodeList);
    expect(result.isError).toBe(true);
    expect(result.baseColor).toBe('rgba(231, 67, 74, 1)');
  });

  it('returns accuracy error when rawmagic is in errorRawMagicList for output role', () => {
    const wrongRawMagicList = { errorRawMagicList: ['100'], exceptionRawMagicList: [] };
    const tensor = makeTensor({ magic: 1 });
    const rawTensor = makeRawTensor({ rawmagic: 100 });
    const result = getCastNodeState(tensor, rawTensor, 'output', undefined, wrongRawMagicList);
    expect(result.isAccuracyError).toBe(true);
  });

  it('returns accuracy exception when rawmagic is in exceptionRawMagicList for output role', () => {
    const wrongRawMagicList = { errorRawMagicList: [], exceptionRawMagicList: ['100'] };
    const tensor = makeTensor({ magic: 1 });
    const rawTensor = makeRawTensor({ rawmagic: 100 });
    const result = getCastNodeState(tensor, rawTensor, 'output', undefined, wrongRawMagicList);
    expect(result.isAccuracyException).toBe(true);
  });

  it('does not return accuracy error for non-output role', () => {
    const wrongRawMagicList = { errorRawMagicList: ['100'], exceptionRawMagicList: [] };
    const tensor = makeTensor({ magic: 1 });
    const rawTensor = makeRawTensor({ rawmagic: 100 });
    const result = getCastNodeState(tensor, rawTensor, 'input', undefined, wrongRawMagicList);
    expect(result.isAccuracyError).toBe(false);
  });

  it('returns default state when no errors', () => {
    const tensor = makeTensor({ magic: 1 });
    const rawTensor = makeRawTensor({ rawmagic: 100 });
    const result = getCastNodeState(tensor, rawTensor, 'tensor');
    expect(result.isError).toBe(false);
    expect(result.isAccuracyError).toBe(false);
    expect(result.isAccuracyException).toBe(false);
  });
});

describe('buildCastMetadataCompartment', () => {
  it('builds compartment with node role css class', () => {
    const result = buildCastMetadataCompartment('node-1', 'input', ['shape: [1,2]']);
    expect(result.type).toBe('compartment');
    expect(result.cssClasses).toContain('input-metadata-compartment');
  });
});

describe('buildMetaLabels', () => {
  it('builds compartment with meta labels', () => {
    const result = buildMetaLabels('op-1', ['key: val', 'key2: val2'], 0, '10');
    expect(result.type).toBe('compartment');
    expect(result.children).toHaveLength(2);
  });

  it('handles missing value gracefully', () => {
    const result = buildMetaLabels('op-1', ['keyonly'], 0, '10');
    expect(result.children).toHaveLength(1);
  });
});

describe('buildCallLabels', () => {
  it('builds compartment with call labels', () => {
    const result = buildCallLabels('op-1', ['key: val'], 0, '10');
    expect(result.type).toBe('compartment');
    expect(result.children).toHaveLength(1);
  });
});

describe('getCodePath', () => {
  it('returns op.file when available', () => {
    expect(getCodePath(makeOperation({ file: '/path/to/file.py' }))).toBe('/path/to/file.py');
  });

  it('returns semantic_label filename when file is empty', () => {
    const op = makeOperation({ file: '', semantic_label: { filename: '/semantic/file.py' } });
    expect(getCodePath(op)).toBe('/semantic/file.py');
  });

  it('returns undefined when neither is available', () => {
    expect(getCodePath(makeOperation({}))).toBeUndefined();
  });
});

describe('getCodeLine', () => {
  it('returns parsed line number from op.line', () => {
    expect(getCodeLine(makeOperation({ line: '42' }))).toBe(42);
  });

  it('returns semantic_label lineno when line is empty', () => {
    const op = makeOperation({ line: '', semantic_label: { lineno: 10 } });
    expect(getCodeLine(op)).toBe(10);
  });

  it('returns undefined when neither is available', () => {
    expect(getCodeLine(makeOperation({}))).toBeUndefined();
  });

  it('returns undefined when line is not a number', () => {
    expect(getCodeLine(makeOperation({ line: 'abc' }))).toBeUndefined();
  });
});

describe('extractNestedData', () => {
  it('extracts first function from functions array', () => {
    const inner = { rawtensors: [], tensors: [], operations: [] } as FunctionData;
    const result = extractNestedData({ functions: [inner] } as FunctionData);
    expect(result).toBe(inner);
  });

  it('returns original data when no nesting found', () => {
    const data = { rawtensors: [] } as FunctionData;
    expect(extractNestedData(data)).toBe(data);
  });

  it('searches nested object properties', () => {
    const inner = { rawtensors: [], tensors: [], operations: [] } as FunctionData;
    const data = { wrapper: inner } as any;
    expect(extractNestedData(data)).toBe(inner);
  });
});

describe('createSyncControlFlowEdges', () => {
  it('creates edges between sync operations with same pipe', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'SYNC_SRC', sync_queue: { pipe_id: 1, trig_pipe: 0 } }),
      makeOperation({ opmagic: 2, opcode: 'SYNC_DST', sync_queue: { pipe_id: 1, trig_pipe: 0 } }),
    ];
    const edges: any[] = [];
    createSyncControlFlowEdges({ operations: ops } as FunctionData, [], edges);
    expect(edges.some((e) => e.type === 'edge:control')).toBe(true);
  });

  it('creates edges between phase operations', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'PHASE1' }),
      makeOperation({ opmagic: 2, opcode: 'PHASE2' }),
    ];
    const edges: any[] = [];
    createSyncControlFlowEdges({ operations: ops } as FunctionData, [], edges);
    expect(edges.some((e) => e.id?.includes('phase-flow'))).toBe(true);
  });

  it('does nothing when operations is undefined', () => {
    const edges: any[] = [];
    createSyncControlFlowEdges({} as FunctionData, [], edges);
    expect(edges).toHaveLength(0);
  });

  it('does not create sync edges for single sync operation', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'SYNC_SRC', sync_queue: { pipe_id: 1, trig_pipe: 0 } }),
    ];
    const edges: any[] = [];
    createSyncControlFlowEdges({ operations: ops } as FunctionData, [], edges);
    expect(edges.filter((e) => e.id?.includes('control-flow')).length).toBe(0);
  });
});

describe('createSyncCoordinationEdges', () => {
  it('creates coordination edges between sync and computational ops', () => {
    const syncOps = {
      'pipe-0-trig-0': [{ index: 0, op: makeOperation({ opmagic: 1, opcode: 'SYNC_SRC' }) }],
    };
    const compOps = [{ index: 1, op: makeOperation({ opmagic: 2, opcode: 'ADD', subgraphid: 0 }) }];
    const edges: any[] = [];
    createSyncCoordinationEdges({} as FunctionData, syncOps, compOps, edges);
    expect(edges.length).toBeGreaterThan(0);
  });

  it('does not create edges when no nearby sync ops', () => {
    const syncOps = {
      'pipe-0-trig-0': [{ index: 100, op: makeOperation({ opmagic: 1, opcode: 'SYNC_SRC' }) }],
    };
    const compOps = [{ index: 0, op: makeOperation({ opmagic: 2, opcode: 'ADD', subgraphid: 0 }) }];
    const edges: any[] = [];
    createSyncCoordinationEdges({} as FunctionData, syncOps, compOps, edges);
    expect(edges).toHaveLength(0);
  });
});

describe('createPhaseCoordinationEdges', () => {
  it('creates coordination edges from phase to computational ops', () => {
    const phaseOps = [{ index: 0, op: makeOperation({ opmagic: 1, opcode: 'PHASE1', sync_queue: { pipe_id: 0 } }) }];
    const compOps = [{ index: 1, op: makeOperation({ opmagic: 2, opcode: 'ADD', subgraphid: 0, sync_queue: { pipe_id: 0 } }) }];
    const edges: any[] = [];
    createPhaseCoordinationEdges(phaseOps, compOps, edges);
    expect(edges.length).toBeGreaterThan(0);
  });

  it('returns early when phaseOps is empty', () => {
    const edges: any[] = [];
    createPhaseCoordinationEdges([], [], edges);
    expect(edges).toHaveLength(0);
  });
});

describe('buildTensorNodeObject', () => {
  it('builds a tensor node with label and ports', () => {
    const tensor = makeTensor({ magic: 1 });
    const inputPort = { type: 'port', id: 'node-in', role: 'input', size: { width: 8, height: 8 } } as any;
    const outputPort = { type: 'port', id: 'node-out', role: 'output', size: { width: 8, height: 8 } } as any;
    const result = buildTensorNodeObject('node-1', tensor, '1', 'data', 0, { baseColor: '#fff', lightColor: '#eee' }, ['shape: [1,2]'], inputPort, outputPort);
    expect(result.type).toBe('node:tensor');
    expect(result.role).toBe('tensor');
    expect(result.children).toHaveLength(3);
  });
});

describe('buildTensorNodesObject', () => {
  it('builds a tensor node with isError flag', () => {
    const tensor = makeTensor({ magic: 1 });
    const inputPort = { type: 'port', id: 'node-in', role: 'input', size: { width: 8, height: 8 } } as any;
    const outputPort = { type: 'port', id: 'node-out', role: 'output', size: { width: 8, height: 8 } } as any;
    const result = buildTensorNodesObject('node-1', tensor, '1', 'data', 0, { baseColor: '#fff', lightColor: '#eee' }, true, ['shape: [1,2]'], inputPort, outputPort);
    expect(result.isError).toBe(true);
  });
});

describe('extractTensorMagicFromPortId', () => {
  it('extracts magic from tensor port id', () => {
    expect(extractTensorMagicFromPortId('tensor-123-0-out')).toBe('123');
  });

  it('returns undefined for non-tensor port id', () => {
    expect(extractTensorMagicFromPortId('operation-1-0-in')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(extractTensorMagicFromPortId(undefined)).toBeUndefined();
  });
});

describe('markEmptyNodeEdgesAsDashed', () => {
  it('marks edges connected to empty output as dashed', () => {
    const edges: any[] = [
      { sourceId: 'tensor-5-0-out', targetId: 'op-1-in', type: 'edge' },
      { sourceId: 'op-2-out', targetId: 'op-3-in', type: 'edge' },
    ];
    markEmptyNodeEdgesAsDashed(edges, new Set(['5']));
    expect((edges[0] as any).cssClasses).toContain('dashed-edge');
    expect((edges[1] as any).cssClasses).toBeUndefined();
  });

  it('does nothing when no edges match', () => {
    const edges: any[] = [{ sourceId: 'op-1-out', targetId: 'op-2-in' }];
    markEmptyNodeEdgesAsDashed(edges, new Set(['99']));
    expect((edges[0] as any).cssClasses).toBeUndefined();
  });
});

describe('createEmptyNodesForSearch', () => {
  it('creates empty nodes for COPY_OUT operations in path', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ooperands: [3] });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    const tensorToRawTensorMap = new Map([['3', '100']]);
    const rawTensorConsumers = new Map<string, PortReference[]>();
    const pathNodesSet = new Set(['10']);
    const opListMap = new Map([['10', 0]]);
    const outcastUnique = new Set<string>();
    const tensorNodeMap = new Map<string, { nodeId: string }>();
    const emptyOutputSet = new Set<string>();
    const emptyNodesList = new Set<string>();

    createEmptyNodesForSearch(actualData, nodes, edges, true, tensorToRawTensorMap, rawTensorConsumers,
      pathNodesSet, opListMap, outcastUnique, tensorNodeMap, emptyOutputSet, emptyNodesList);
    expect(nodes.length).toBeGreaterThan(0);
    expect(emptyOutputSet.has('3')).toBe(true);
  });

  it('does nothing when operations is undefined', () => {
    const nodes: any[] = [];
    const edges: any[] = [];
    createEmptyNodesForSearch({} as FunctionData, nodes, edges, true,
      new Map(), new Map(), new Set(), new Map(), new Set(), new Map(), new Set(), new Set());
    expect(nodes).toHaveLength(0);
  });

  it('skips ops not in opListMap', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ooperands: [3] });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    createEmptyNodesForSearch(actualData, nodes, edges, true,
      new Map(), new Map(), new Set(['99']), new Map(), new Set(), new Map(), new Set(), new Set());
    expect(nodes).toHaveLength(0);
  });

  it('skips non COPY_OUT/ASSEMBLE ops', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'ADD', ooperands: [3] });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    createEmptyNodesForSearch(actualData, nodes, edges, true,
      new Map(), new Map(), new Set(['10']), new Map([['10', 0]]), new Set(), new Map(), new Set(), new Set());
    expect(nodes).toHaveLength(0);
  });

  it('creates empty nodes with showTensorNodes=false (covers registerEmptyNodeConsumer)', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ooperands: [3] });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    const tensorToRawTensorMap = new Map([['3', '100']]);
    const rawTensorConsumers = new Map<string, PortReference[]>();
    createEmptyNodesForSearch(actualData, nodes, edges, false, tensorToRawTensorMap, rawTensorConsumers,
      new Set(['10']), new Map([['10', 0]]), new Set(), new Map(), new Set(), new Set());
    expect(nodes.length).toBeGreaterThan(0);
    expect(rawTensorConsumers.has('100')).toBe(true);
  });

  it('skips tensor already in outcastUnique', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ooperands: [3, 4] });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    const outcastUnique = new Set<string>(['3']);
    createEmptyNodesForSearch(actualData, nodes, edges, true,
      new Map(), new Map(), new Set(['10']), new Map([['10', 0]]), outcastUnique, new Map(), new Set(), new Set());
    expect(nodes.length).toBe(1);
  });

  it('creates empty nodes with showTensorNodes=true and tensorNodeMap entry (covers createEdgeForEmptyNode)', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ooperands: [3], subgraphid: 0 });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    const tensorNodeMap = new Map([['3', { nodeId: 'tensor-3-0' }]]);
    createEmptyNodesForSearch(actualData, nodes, edges, true,
      new Map(), new Map(), new Set(['10']), new Map([['10', 0]]), new Set(), tensorNodeMap, new Set(), new Set());
    expect(nodes.length).toBe(1);
    expect(edges.length).toBe(1);
  });

  it('creates empty nodes with showTensorNodes=false and no rawTensorId (covers registerEmptyNodeConsumer skip)', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ooperands: [3], subgraphid: 0 });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    // tensorToRawTensorMap is empty so registerEmptyNodeConsumer will skip
    createEmptyNodesForSearch(actualData, nodes, edges, false,
      new Map(), new Map(), new Set(['10']), new Map([['10', 0]]), new Set(), new Map(), new Set(), new Set());
    expect(nodes.length).toBe(1);
  });

  it('marks dashed edges for empty output (covers isEdgeConnectedToEmptyOutput + markEmptyNodeEdgesAsDashed)', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'COPY_OUT', ooperands: [3, 4], subgraphid: 0 });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [
      { sourceId: 'tensor-3-0-out', targetId: 'op-1-in', type: 'edge' },
    ];
    // First call creates empty nodes and marks '3' in emptyOutputSet
    // Then markEmptyNodeEdgesAsDashed will mark edges connected to '3'
    createEmptyNodesForSearch(actualData, nodes, edges, true,
      new Map(), new Map(), new Set(['10']), new Map([['10', 0]]), new Set(), new Map(), new Set(), new Set());
    // The pre-existing edge with sourceId tensor-3-0-out should be marked dashed
    const dashedEdge = edges.find((e: any) => e.sourceId === 'tensor-3-0-out');
    expect(dashedEdge?.cssClasses).toContain('dashed-edge');
  });

  it('handles ASSEMBLE op (covers isCopyOutOrAssembleOp for ASSEMBLE)', () => {
    const op = makeOperation({ opmagic: 10, opcode: 'ASSEMBLE', ooperands: [3], subgraphid: 0 });
    const actualData = { operations: [op] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    createEmptyNodesForSearch(actualData, nodes, edges, true,
      new Map(), new Map(), new Set(['10']), new Map([['10', 0]]), new Set(), new Map(), new Set(), new Set());
    expect(nodes.length).toBe(1);
  });

  it('handles undefined op (shouldCreateEmptyNodeForOp false for undefined)', () => {
    const actualData = { operations: [undefined as any] } as FunctionData;
    const nodes: any[] = [];
    const edges: any[] = [];
    createEmptyNodesForSearch(actualData, nodes, edges, true,
      new Map(), new Map(), new Set(['10']), new Map([['10', 0]]), new Set(), new Map(), new Set(), new Set());
    expect(nodes).toHaveLength(0);
  });
});

// Internal functions (extractTensorIdFromEdge, collectConnectedTensorsAndIOs, etc.)
// are covered indirectly via filterSubgraph and createEmptyNodesForSearch below.

describe('filterSubgraph - comprehensive', () => {
  it('filters nodes and edges with incast/outcast connections', () => {
    const nodes: any[] = [
      { id: 'op-1', role: 'operation', subgraphId: 0 },
      { id: 'tensor-5-0', role: 'tensor' },
      { id: 'incast-0-tensor-3', role: 'input' },
      { id: 'outcast-0-tensor-4', role: 'output' },
      { id: 'op-2', role: 'operation', subgraphId: 1 },
    ];
    const edges: any[] = [
      { sourceId: 'incast-0-tensor-3-out', targetId: 'tensor-5-0-in', type: 'edge' },
      { sourceId: 'tensor-5-0-out', targetId: 'outcast-0-tensor-4-in', type: 'edge' },
      { sourceId: 'op-1-out', targetId: 'tensor-5-0-in', type: 'edge' },
      { sourceId: 'op-2-out', targetId: 'op-3-in', type: 'edge' },
    ];
    const [filteredEdges, filteredNodes] = filterSubgraph(0, nodes, edges);
    expect(filteredNodes.some((n: any) => n.id === 'op-1')).toBe(true);
    expect(filteredNodes.some((n: any) => n.id === 'incast-0-tensor-3')).toBe(true);
    expect(filteredNodes.some((n: any) => n.id === 'outcast-0-tensor-4')).toBe(true);
  });

  it('covers edges with undefined sourceId/targetId (isEdgeRelevant false branch)', () => {
    const nodes: any[] = [
      { id: 'op-1', role: 'operation', subgraphId: 0 },
      { id: 'tensor-5-0', role: 'tensor' },
    ];
    const edges: any[] = [
      { sourceId: undefined, targetId: undefined, type: 'edge' },
      { sourceId: 'op-1-out', targetId: undefined, type: 'edge' },
      { sourceId: undefined, targetId: 'tensor-5-0-in', type: 'edge' },
    ];
    const [filteredEdges, filteredNodes] = filterSubgraph(0, nodes, edges);
    expect(filteredEdges).toHaveLength(0);
  });

  it('covers edges not connected to any relevant node', () => {
    const nodes: any[] = [
      { id: 'op-1', role: 'operation', subgraphId: 0 },
    ];
    const edges: any[] = [
      { sourceId: 'op-2-out', targetId: 'op-3-in', type: 'edge' },
    ];
    const [filteredEdges] = filterSubgraph(0, nodes, edges);
    expect(filteredEdges).toHaveLength(0);
  });

  it('covers incast/outcast edge extraction via filterSubgraph', () => {
    // This test covers extractInputOutputIdFromEdge and collectConnectedIOsByTensor
    const nodes: any[] = [
      { id: 'op-1', role: 'operation', subgraphId: 0 },
      { id: 'tensor-5-0', role: 'tensor' },
      { id: 'incast-0-tensor-3', role: 'input' },
      { id: 'outcast-0-tensor-4', role: 'output' },
    ];
    const edges: any[] = [
      // incast -> tensor edge (covers collectConnectedIOsByTensor incast branch)
      { sourceId: 'incast-0-tensor-3-out', targetId: 'tensor-5-0-in', type: 'edge' },
      // tensor -> outcast edge (covers collectConnectedIOsByTensor outcast branch)
      { sourceId: 'tensor-5-0-out', targetId: 'outcast-0-tensor-4-in', type: 'edge' },
      // op -> tensor edge (covers extractTensorIdFromEdge sourceId match)
      { sourceId: 'op-1-out', targetId: 'tensor-5-0-in', type: 'edge' },
      // tensor -> op edge (covers extractTensorIdFromEdge targetId match)
      { sourceId: 'tensor-5-0-out', targetId: 'op-1-in', type: 'edge' },
      // incast -> op edge (covers extractInputOutputIdFromEdge incast branch in collectConnectedTensorsAndIOs)
      { sourceId: 'incast-0-tensor-3-out', targetId: 'op-1-in', type: 'edge' },
      // op -> outcast edge (covers extractInputOutputIdFromEdge outcast branch in collectConnectedTensorsAndIOs)
      { sourceId: 'op-1-out', targetId: 'outcast-0-tensor-4-in', type: 'edge' },
    ];
    const [filteredEdges, filteredNodes] = filterSubgraph(0, nodes, edges);
    // incast and outcast should be connected via tensor and op
    expect(filteredNodes.some((n: any) => n.id === 'incast-0-tensor-3')).toBe(true);
    expect(filteredNodes.some((n: any) => n.id === 'outcast-0-tensor-4')).toBe(true);
  });
});

describe('createSyncControlFlowEdges - comprehensive', () => {
  it('creates coordination edges for computational ops near sync ops', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'SYNC_SRC', sync_queue: { pipe_id: 0, trig_pipe: 0 } }),
      makeOperation({ opmagic: 2, opcode: 'ADD', subgraphid: 1, sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 3, opcode: 'SYNC_DST', sync_queue: { pipe_id: 0, trig_pipe: 0 } }),
    ];
    const edges: any[] = [];
    createSyncControlFlowEdges({ operations: ops } as FunctionData, [], edges);
    expect(edges.some((e: any) => e.type === 'edge:control')).toBe(true);
  });

  it('creates coordination edges with multiple before and after sync ops (reduce logic)', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'SYNC_SRC', sync_queue: { pipe_id: 0, trig_pipe: 0 } }),
      makeOperation({ opmagic: 2, opcode: 'SYNC_SRC', sync_queue: { pipe_id: 1, trig_pipe: 0 } }),
      makeOperation({ opmagic: 3, opcode: 'ADD', subgraphid: 1, sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 4, opcode: 'SYNC_DST', sync_queue: { pipe_id: 0, trig_pipe: 0 } }),
      makeOperation({ opmagic: 5, opcode: 'SYNC_DST', sync_queue: { pipe_id: 1, trig_pipe: 0 } }),
    ];
    const edges: any[] = [];
    createSyncControlFlowEdges({ operations: ops } as FunctionData, [], edges);
    expect(edges.some((e: any) => e.id?.includes('sync-coord-before'))).toBe(true);
    expect(edges.some((e: any) => e.id?.includes('sync-coord-after'))).toBe(true);
  });

  it('creates phase coordination edges with computational ops between phases', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'PHASE1', sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 2, opcode: 'ADD', subgraphid: 1, sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 3, opcode: 'PHASE2', sync_queue: { pipe_id: 0 } }),
    ];
    const edges: any[] = [];
    createSyncControlFlowEdges({ operations: ops } as FunctionData, [], edges);
    expect(edges.some((e: any) => e.id?.includes('phase-coord'))).toBe(true);
    expect(edges.some((e: any) => e.id?.includes('phase-flow'))).toBe(true);
  });

  it('creates phase coordination edges with last comp ops from previous phase', () => {
    const ops = [
      makeOperation({ opmagic: 1, opcode: 'PHASE1', sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 2, opcode: 'ADD', subgraphid: 1, sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 3, opcode: 'PHASE2', sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 4, opcode: 'ADD', subgraphid: 1, sync_queue: { pipe_id: 0 } }),
      makeOperation({ opmagic: 5, opcode: 'PHASE1', sync_queue: { pipe_id: 0 } }),
    ];
    const edges: any[] = [];
    createSyncControlFlowEdges({ operations: ops } as FunctionData, [], edges);
    expect(edges.some((e: any) => e.id?.includes('phase-coord') && e.id?.includes('-to-'))).toBe(true);
  });
});

describe('buildCastMetadataCompartment - long value', () => {
  it('truncates values longer than 32 chars', () => {
    const longValue = 'a'.repeat(40);
    const result = buildCastMetadataCompartment('node-1', 'input', [`key: ${longValue}`]);
    const label = result.children![0] as any;
    expect(label.text).toContain('...');
  });
});

describe('buildMetaLabels - long value', () => {
  it('truncates values longer than 32 chars', () => {
    const longValue = 'b'.repeat(40);
    const result = buildMetaLabels('op-1', [`key: ${longValue}`], 0, '10');
    const label = result.children[0];
    expect(label.text).toContain('...');
  });
});

describe('buildCallLabels - long value', () => {
  it('truncates values longer than 32 chars', () => {
    const longValue = 'c'.repeat(40);
    const result = buildCallLabels('op-1', [`key: ${longValue}`], 0, '10');
    const label = result.children[0];
    expect(label.text).toContain('...');
  });
});
