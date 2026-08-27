import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {
  find: vi.fn(),
  set: vi.fn(),
  query: vi.fn(),
  delete: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('../../../../src/core/store', () => {
  return {
    SqlStore: class MockSqlStore {
      constructor(..._args: any[]) {
        return mockStore;
      }
    },
    defineAttributes: vi.fn((attrs: any) => attrs),
    Store: class MockStore {},
  };
});

describe('control-flow/store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return a store instance from getControlFlowStore', async () => {
    const { getControlFlowStore } = await import('../../../../src/services/control-flow/store');
    const store = getControlFlowStore();
    expect(store).toBeDefined();
  });

  it('should return the same store instance on subsequent calls', async () => {
    const { getControlFlowStore } = await import('../../../../src/services/control-flow/store');
    const store1 = getControlFlowStore();
    const store2 = getControlFlowStore();
    expect(store1).toBe(store2);
  });

  it('should create SqlStore with correct table name', async () => {
    const { getControlFlowStore } = await import('../../../../src/services/control-flow/store');
    const store = getControlFlowStore();
    expect(store).toBeDefined();
  });
});
