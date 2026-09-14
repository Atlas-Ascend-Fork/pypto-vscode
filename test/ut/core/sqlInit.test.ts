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
