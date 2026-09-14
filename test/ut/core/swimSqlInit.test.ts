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

const { mockStoreInstance, MockSqlStore, mockDefineAttributes } = vi.hoisted(() => ({
  mockStoreInstance: { set: vi.fn(), get: vi.fn(), all: vi.fn() },
  MockSqlStore: vi.fn(function () { return mockStoreInstance; }),
  mockDefineAttributes: vi.fn((config: any) => config),
}));

vi.mock(import('../../../src/core/store'), () => ({
  defineAttributes: mockDefineAttributes,
  SqlStore: MockSqlStore,
  Store: class {},
}));

describe('swimSqlInit', () => {
  beforeEach(() => {
    vi.resetModules();
    MockSqlStore.mockClear();
    mockDefineAttributes.mockClear();
  });

  it('creates and returns the store on first call', async () => {
    const { getSwimGraphParsedInfoStore } = await import('../../../src/core/swimSqlInit');
    const store = getSwimGraphParsedInfoStore();
    expect(MockSqlStore).toHaveBeenCalledWith('swim_graph_parsed_info', expect.any(Object));
    expect(store).toBe(mockStoreInstance);
  });

  it('returns the same store instance on subsequent calls (singleton)', async () => {
    const { getSwimGraphParsedInfoStore } = await import('../../../src/core/swimSqlInit');
    const store1 = getSwimGraphParsedInfoStore();
    const store2 = getSwimGraphParsedInfoStore();
    expect(store1).toBe(store2);
    expect(MockSqlStore).toHaveBeenCalledTimes(1);
  });

  it('passes correct table name and attributes to SqlStore', async () => {
    const { getSwimGraphParsedInfoStore } = await import('../../../src/core/swimSqlInit');
    getSwimGraphParsedInfoStore();
    const callArgs = MockSqlStore.mock.calls[0];
    expect(callArgs[0]).toBe('swim_graph_parsed_info');
    const attrs = callArgs[1];
    expect(attrs.filePath).toEqual({ type: String, isQuery: true, isPrimary: true, defaultValue: '' });
    expect(attrs.lastChangeTime).toEqual({ type: String });
    expect(attrs.dynTopoLastChangeTime).toEqual({ type: String });
    expect(attrs.pmuLastChangeTime).toEqual({ type: String });
    expect(attrs.infoPath).toEqual({ type: String });
  });
});
