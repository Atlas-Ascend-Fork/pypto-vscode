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

import { RequestSourceType, NODE_COUNT_LIMIT, WHITE_COMMANDS } from '../../../src/handler/handler-types';

describe('handler-types constants', () => {
  it('NODE_COUNT_LIMIT equals 10000', () => {
    expect(NODE_COUNT_LIMIT).toBe(10000);
  });

  it('WHITE_COMMANDS contains 14 commands', () => {
    expect(WHITE_COMMANDS.size).toBe(14);
  });

  it('WHITE_COMMANDS includes required commands', () => {
    const requiredCommands = [
      'askLayout',
      'searchAllFunc',
      'jumpToCodeLine',
      'getHealthyReport',
      'getAccurancyReport',
      'searchAccurancySumList',
      'getAccurancyDetail',
      'getInitialData',
      'callInOutTensorMap',
      'getSubgraph',
      'innerGetSubgraph',
      'getSprottyGraphWithLevel',
      'accuFilePathGet',
      'getCmpDiffListData',
    ];
    for (const cmd of requiredCommands) {
      expect(WHITE_COMMANDS.has(cmd)).toBe(true);
    }
  });
});

describe('RequestSourceType enum', () => {
  it('NodeOverLimit equals 1', () => {
    expect(RequestSourceType.NodeOverLimit).toBe(1);
  });

  it('SearchNoMagic equals 2', () => {
    expect(RequestSourceType.SearchNoMagic).toBe(2);
  });

  it('SearchMagic equals 3', () => {
    expect(RequestSourceType.SearchMagic).toBe(3);
  });
});
