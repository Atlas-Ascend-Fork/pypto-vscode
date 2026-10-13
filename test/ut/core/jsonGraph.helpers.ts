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
import { vi } from 'vitest';

import { AscppDagBuilder } from '../../../src/core/json-graph/jsonGraph';
import type { FunctionData, Operation, Tensor, RawTensor } from '../../../src/core/json-graph/jsonGraph.types';

export function makeRawTensor(overrides: Partial<RawTensor> = {}): RawTensor {
  return {
    kind: 0,
    rawmagic: 100,
    rawshape: [1, 2],
    datatype: 6,
    symbol: 'data',
    ...overrides,
  };
}

export function makeTensor(overrides: Partial<Tensor> = {}): Tensor {
  return {
    magic: 1,
    rawtensor: 100,
    offset: [0],
    nodetype: 0,
    format: 0,
    shape: [1, 2],
    kind: 0,
    semantic_label: { label: '' },
    compareType: undefined,
    ...overrides,
  };
}

export function makeOperation(overrides: Partial<Operation> = {}): Operation {
  return {
    kind: 0,
    opmagic: 10,
    opcode: 'ADD',
    ioperands: [1],
    ooperands: [2],
    semantic_label: { label: '' },
    compareType: undefined,
    ...overrides,
  };
}

export function makeFunctionData(overrides: Partial<FunctionData> = {}): FunctionData {
  return {
    func_magicname: 'test_func',
    rawtensors: [makeRawTensor({ rawmagic: 100 }), makeRawTensor({ rawmagic: 101 })],
    tensors: [
      makeTensor({ magic: 1, rawtensor: 100 }),
      makeTensor({ magic: 2, rawtensor: 101 }),
    ],
    operations: [makeOperation()],
    incasts: [1],
    outcasts: [[2]],
    ...overrides,
  };
}

export function makeFullFunctionData(overrides: Partial<FunctionData> = {}): FunctionData {
  return {
    func_magicname: 'test_func',
    rawtensors: [
      makeRawTensor({ rawmagic: 100, symbol: 'data_a' }),
      makeRawTensor({ rawmagic: 101, symbol: 'data_b' }),
      makeRawTensor({ rawmagic: 102, symbol: 'data_c' }),
    ],
    tensors: [
      makeTensor({ magic: 1, rawtensor: 100, shape: [1, 2], offset: [0] }),
      makeTensor({ magic: 2, rawtensor: 101, shape: [2, 3], offset: [0] }),
      makeTensor({ magic: 3, rawtensor: 102, shape: [3, 4], offset: [0] }),
    ],
    operations: [
      makeOperation({ opmagic: 10, opcode: 'ADD', ioperands: [1], ooperands: [2], subgraphid: 0 }),
      makeOperation({ opmagic: 11, opcode: 'MUL', ioperands: [2], ooperands: [3], subgraphid: 0 }),
    ],
    incasts: [[1, [0]]],
    outcasts: [[3, [0]]],
    ...overrides,
  };
}

export function createBuilder(): AscppDagBuilder {
  const server = {
    setRef: vi.fn(),
    comGraphData: { funcHash: 'test-hash' },
  };
  const comGraphData = { calleeMap: {}, funcHash: 'test-hash' };
  return new AscppDagBuilder(comGraphData, server, '2.0');
}
