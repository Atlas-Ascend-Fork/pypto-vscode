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

const { mockGetComGraphDataSum, mockGetComGraphDataDetail, mockSearchKeyword } = vi.hoisted(() => ({
  mockGetComGraphDataSum: vi.fn().mockResolvedValue({ pass: 10, fail: 2 }),
  mockGetComGraphDataDetail: vi.fn().mockResolvedValue({ detail: 'data' }),
  mockSearchKeyword: vi.fn().mockResolvedValue({ results: [] }),
}));

vi.mock(import('../../../src/common/accurancyAnylasis'), () => ({
  getComGraphDataSum: mockGetComGraphDataSum,
  getComGraphDataDetail: mockGetComGraphDataDetail,
  searchKeyword: mockSearchKeyword,
}));

import {
  parseAccuracyPath,
  getAccurancyReport,
  searchAccurancySumList,
  getAccurancyDetail,
} from '../../../src/handler/accuracy-report-service';

describe('parseAccuracyPath', () => {
  it('parses Pass directory and function name from path', () => {
    const result = parseAccuracyPath('/output/Pass_01_Optimize/graph_TENSOR_funcA_LEAF_abc123.json');
    expect(result.curPassName).toBe('Pass_01_Optimize');
    expect(result.curFuncMagicNameString).toBe('TENSOR_funcA_LEAF_abc123');
  });

  it('removes _ROOT suffix from function name', () => {
    const result = parseAccuracyPath('/output/Pass_02/graph_TENSOR_funcB_ROOT.json');
    expect(result.curFuncMagicNameString).toBe('TENSOR_funcB');
  });

  it('handles path without _ROOT suffix', () => {
    const result = parseAccuracyPath('/output/Pass_03/graph_TENSOR_funcC_LEAF_def456.json');
    expect(result.curFuncMagicNameString).toBe('TENSOR_funcC_LEAF_def456');
  });
});

describe('getAccurancyReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getComGraphDataSum and sets AccurancyReport ref', async () => {
    const server = {
      comGraphData: { fsPath: '/output/Pass_01/graph_TENSOR_func_LEAF_abc.json' },
      query: { flowVerifyPath: '/verify', computeGraphDirPath: '/dir' },
      setRef: vi.fn(),
    };
    await getAccurancyReport(server);
    expect(mockGetComGraphDataSum).toHaveBeenCalledWith(
      '/output/Pass_01/graph_TENSOR_func_LEAF_abc.json',
      'Pass_01',
      'TENSOR_func_LEAF_abc',
      30,
      0,
      '/verify',
      '/dir',
    );
    expect(server.setRef).toHaveBeenCalledWith('AccurancyReport', { data: { pass: 10, fail: 2 } });
  });

  it('returns early when fsPath is undefined', async () => {
    const server = {
      comGraphData: {},
      query: {},
      setRef: vi.fn(),
    };
    await getAccurancyReport(server);
    expect(mockGetComGraphDataSum).not.toHaveBeenCalled();
    expect(server.setRef).not.toHaveBeenCalled();
  });
});

describe('searchAccurancySumList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls searchKeyword with pagination and keyword', async () => {
    const server = {
      comGraphData: { fsPath: '/output/Pass_02/graph_TENSOR_func_LEAF_xyz.json' },
      query: { flowVerifyPath: '/v', computeGraphDirPath: '/d' },
      setRef: vi.fn(),
    };
    const message = { data: { pageSize: 50, startOffset: 2, keyword: 'error' } };
    await searchAccurancySumList(server, message);
    expect(mockSearchKeyword).toHaveBeenCalledWith(
      '/output/Pass_02/graph_TENSOR_func_LEAF_xyz.json',
      'Pass_02',
      'TENSOR_func_LEAF_xyz',
      'error',
      50,
      100,
      '/v',
      '/d',
    );
    expect(server.setRef).toHaveBeenCalledWith('AccurancyList', { data: { results: [] } });
  });

  it('uses default values when message.data fields are missing', async () => {
    const server = {
      comGraphData: { fsPath: '/output/Pass_03/graph_TENSOR_func_LEAF_abc.json' },
      query: {},
      setRef: vi.fn(),
    };
    const message = { data: {} };
    await searchAccurancySumList(server, message);
    expect(mockSearchKeyword).toHaveBeenCalledWith(
      '/output/Pass_03/graph_TENSOR_func_LEAF_abc.json',
      'Pass_03',
      'TENSOR_func_LEAF_abc',
      '',
      30,
      NaN,
      undefined,
      undefined,
    );
  });
});

describe('getAccurancyDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getComGraphDataDetail with loopInfo and rawMagic', async () => {
    const server = {
      comGraphData: { fsPath: '/output/Pass_04/graph_TENSOR_func_LEAF_def.json' },
      query: { flowVerifyPath: '/v', computeGraphDirPath: '/d' },
      setRef: vi.fn(),
    };
    const message = { data: { loopInfo: 'loop1', rawMagic: 'raw123' } };
    await getAccurancyDetail(server, message);
    expect(mockGetComGraphDataDetail).toHaveBeenCalledWith(
      '/output/Pass_04/graph_TENSOR_func_LEAF_def.json',
      'Pass_04',
      'TENSOR_func_LEAF_def',
      'loop1',
      'raw123',
      10000,
      0,
      '/v',
      '/d',
    );
    expect(server.setRef).toHaveBeenCalledWith('AccurancyDetail', { data: { detail: 'data' } });
  });
});
