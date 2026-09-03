/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect } from 'vitest';

import { buildSubgraphQuery, applyFailMagicResults } from '../../../src/handler/subgraph-helpers';

describe('buildSubgraphQuery', () => {
  const oldQuery = { isSearch: true, nodeMagic: '5', other: 'value' };
  const parentInfo = { parentHash: 'parent123' };

  it('returns oldQuery when entryHash equals calleehash (entry-level graph)', () => {
    const result = buildSubgraphQuery('entry123', oldQuery, 'entry123', 'funcA', '/path', undefined, undefined, parentInfo);
    expect(result).toBe(oldQuery);
  });

  it('enriches query with funcHash when entryHash differs from calleehash', () => {
    const result = buildSubgraphQuery('entry123', oldQuery, 'callee456', 'funcB', '/path', '10', '2', parentInfo);
    expect(result).toEqual({
      ...oldQuery,
      funcHash: 'callee456',
      subFuncmagicname: 'funcB',
      curPath: '/path',
      calleeOpMagic: '10',
      calleeOpSubgraphId: '2',
      isSearch: true,
      parentInfo,
      nodeMagic: '5',
    });
  });

  it('preserves isSearch and nodeMagic from oldQuery', () => {
    const result = buildSubgraphQuery('entry', oldQuery, 'callee', 'func', '/p', undefined, undefined, null);
    expect(result.isSearch).toBe(true);
    expect(result.nodeMagic).toBe('5');
  });

  it('handles undefined calleeOpMagic and calleeOpSubgraphId', () => {
    const result = buildSubgraphQuery('entry', oldQuery, 'callee', 'func', '/p', undefined, undefined, parentInfo);
    expect(result.calleeOpMagic).toBeUndefined();
    expect(result.calleeOpSubgraphId).toBeUndefined();
  });
});

describe('applyFailMagicResults', () => {
  it('applies brief type accuracy results', () => {
    const comGraphData: any = {};
    const failMagicRes = {
      accuType: 'brief',
      wrongRawMagicList: {
        errorRawMagicList: new Set([1, 2, 3]),
        exceptionRawMagicList: new Set([4, 5]),
      },
    };
    const result = applyFailMagicResults(comGraphData, failMagicRes);
    expect(result).toBe(true);
    expect(comGraphData.wrongRawMagicList).toEqual({
      errorRawMagicList: [1, 2, 3],
      exceptionRawMagicList: [4, 5],
    });
  });

  it('applies op type accuracy results', () => {
    const comGraphData: any = {};
    const failMagicRes = {
      accuType: 'op',
      failMagicList: [10, 20, 30],
    };
    const result = applyFailMagicResults(comGraphData, failMagicRes);
    expect(result).toBe(true);
    expect(comGraphData.failOpMagicList).toEqual([10, 20, 30]);
  });

  it('applies task type accuracy results', () => {
    const comGraphData: any = {};
    const failMagicRes = {
      accuType: 'task',
      failMagicList: [100, 200],
    };
    const result = applyFailMagicResults(comGraphData, failMagicRes);
    expect(result).toBe(true);
    expect(comGraphData.failMagicList).toEqual([100, 200]);
  });

  it('returns false when data already exists (wrongRawMagicList and failOpMagicList both present)', () => {
    const comGraphData: any = {
      wrongRawMagicList: { errorRawMagicList: [1] },
      failOpMagicList: [10],
    };
    const failMagicRes = { accuType: 'brief', wrongRawMagicList: {} };
    const result = applyFailMagicResults(comGraphData, failMagicRes);
    expect(result).toBe(false);
  });

  it('returns false for unknown accuType', () => {
    const comGraphData: any = {};
    const failMagicRes = { accuType: 'unknown', data: [] };
    const result = applyFailMagicResults(comGraphData, failMagicRes);
    expect(result).toBe(false);
  });

  it('handles empty Sets in brief type', () => {
    const comGraphData: any = {};
    const failMagicRes = {
      accuType: 'brief',
      wrongRawMagicList: {
        errorRawMagicList: new Set(),
        exceptionRawMagicList: new Set(),
      },
    };
    const result = applyFailMagicResults(comGraphData, failMagicRes);
    expect(result).toBe(true);
    expect(comGraphData.wrongRawMagicList).toEqual({
      errorRawMagicList: [],
      exceptionRawMagicList: [],
    });
  });
});
