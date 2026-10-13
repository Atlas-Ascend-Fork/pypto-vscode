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
