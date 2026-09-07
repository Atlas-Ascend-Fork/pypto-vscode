/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You should not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/core/store', () => ({
  defineAttributes: (attrs: any) => attrs,
  SqlStore: class MockSqlStore {
    constructor(public storeName: string, public attributes: any) {}
  },
  Store: class {},
}));

import {
  getComGraphLayoutStore,
  getComGraphFinalResultStore,
  getComGraphFuncDataStore,
  getComGraphFileHashMapStore,
  getComGraphFileCalleeOpAttrStore,
  getMemoryTraceCacheStore,
  getMemoryTraceEventStore,
} from '../../../src/core/sqlInit';

describe('sqlInit store factories', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('creates singleton store per table', async () => {
    const mod = await import('../../../src/core/sqlInit');

    const factories = [
      [mod.getComGraphLayoutStore, 'com_graph_layout'],
      [mod.getComGraphFinalResultStore, 'com_graph_final_result'],
      [mod.getComGraphFuncDataStore, 'com_graph_func_data'],
      [mod.getComGraphFileHashMapStore, 'com_graph_file_hash_map'],
      [mod.getComGraphFileCalleeOpAttrStore, 'com_graph_file_callee_op_attr'],
      [mod.getMemoryTraceCacheStore, 'memory_trace_cache'],
      [mod.getMemoryTraceEventStore, 'memory_trace_events'],
    ] as const;

    for (const [factory, expectedName] of factories) {
      const store = factory();
      expect(store).toBeDefined();
      expect((store as any).storeName).toBe(expectedName);
      expect(factory()).toBe(store);
    }
  });

  it('exposes all getters from the module', () => {
    expect(getComGraphLayoutStore).toBeTypeOf('function');
    expect(getComGraphFinalResultStore).toBeTypeOf('function');
    expect(getComGraphFuncDataStore).toBeTypeOf('function');
    expect(getComGraphFileHashMapStore).toBeTypeOf('function');
    expect(getComGraphFileCalleeOpAttrStore).toBeTypeOf('function');
    expect(getMemoryTraceCacheStore).toBeTypeOf('function');
    expect(getMemoryTraceEventStore).toBeTypeOf('function');
  });
});
