/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
type MemoryFixture = Record<string, any>;

function createAccess(overrides: Record<string, any> = {}) {
  return {
    seqNo: 1,
    taskId: 1,
    funcId: 1,
    opIdx: 1,
    rootIndex: 0,
    isWrite: true,
    offset: 0,
    shape: [1, 4],
    rawShape: [1, 4],
    overflow: false,
    execStart: 100,
    execEnd: 110,
    timeResolved: true,
    ...overrides,
  };
}

function createTensor(overrides: Record<string, any> = {}) {
  return {
    rawId: 'tensor-a',
    instanceId: 'instance-a',
    base: 1100,
    end: 1500,
    size: 400,
    memType: 'global',
    isWorkspace: false,
    ndim: 2,
    logicalShape: [1, 4],
    rawShape: [1, 4],
    rawmagic: 'magic-alpha',
    lifeStart: 120,
    lifeEnd: 180,
    regionId: 0,
    accesses: [createAccess()],
    ...overrides,
  };
}

export function createMemoryUnitFixture(overrides: Partial<MemoryFixture> = {}): MemoryFixture {
  const fixture = {
    meta: {
      timeUnit: 10,
      timeDenominator: 1,
      t0: 100,
      addrUnit: 'byte',
      memTypeSource: 'workspaceRange',
      regions: [
        {
          regionId: 0,
          addr0: 1000,
          addrEnd: 2000,
          span: 1000,
          occupiedBytes: 600,
          fill: 0.6,
          count: 2,
          totalBytes: 700,
          workspaceCount: 1,
          globalCount: 1,
        },
        {
          regionId: 1,
          addr0: 3000,
          addrEnd: 5000,
          span: 2000,
          occupiedBytes: 500,
          fill: 0.25,
          count: 1,
          totalBytes: 500,
          workspaceCount: 0,
          globalCount: 1,
        },
      ],
      memoryScope: 'GM',
      reuseSegmented: false,
      rawShapeAvailable: true,
      viewAxisShape: [1, 4],
      validation: {},
    },
    rawTensors: [
      createTensor(),
      createTensor({
        rawId: 'tensor-b',
        instanceId: 'instance-b',
        base: 1300,
        end: 1600,
        size: 300,
        isWorkspace: true,
        rawmagic: 'magic-beta',
        lifeStart: 150,
        lifeEnd: 210,
      }),
      createTensor({
        rawId: 'tensor-c',
        instanceId: 'instance-c',
        base: 3500,
        end: 4000,
        size: 500,
        rawmagic: 'magic-gamma',
        lifeStart: 110,
        lifeEnd: 130,
        regionId: 1,
      }),
    ],
  };

  return {
    ...fixture,
    ...overrides,
    meta: {
      ...fixture.meta,
      ...overrides.meta,
    },
  };
}
