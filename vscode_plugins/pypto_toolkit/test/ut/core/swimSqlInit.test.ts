/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
