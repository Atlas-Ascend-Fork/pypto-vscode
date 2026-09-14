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
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const mockLayout = vi.fn();

vi.mock('elkjs', () => ({
  default: class MockElk {
    layout = (...args: unknown[]) => mockLayout(...args);
  },
}));

describe('layoutWork', () => {
  let listener: (data: { type?: string; graphData?: unknown }) => void;
  let originalSend: undefined;

  beforeAll(async () => {
    await import('../../../src/core/layoutWork');
    listener = process.listeners('message').at(-1) as typeof listener;
    expect(listener).toBeTypeOf('function');
    originalSend = (process as any).send;
  });

  afterAll(() => {
    process.removeListener('message', listener as any);
    (process as any).send = originalSend;
  });

  it('ignores messages other than layout type', () => {
    listener({ type: 'other', graphData: { id: 'root' } });
    expect(mockLayout).not.toHaveBeenCalled();
  });

  it('runs ELK layout and posts result when process.send is available', async () => {
    const send = vi.fn();
    (process as any).send = send;
    mockLayout.mockResolvedValue({ id: 'root', x: 0 });
    const graphData = { id: 'root', children: [] };

    listener({ type: 'layout', graphData });
    await vi.waitFor(() => expect(send).toHaveBeenCalled());

    expect(mockLayout).toHaveBeenCalledWith(graphData);
    expect(send).toHaveBeenCalledWith({ type: 'result', data: { id: 'root', x: 0 } });
    (process as any).send = originalSend;
  });

  it('posts error message when layout fails', async () => {
    const send = vi.fn();
    (process as any).send = send;
    mockLayout.mockRejectedValue(new Error('boom'));

    listener({ type: 'layout', graphData: { id: 'root' } });
    await vi.waitFor(() => expect(send).toHaveBeenCalled());

    expect(send).toHaveBeenCalledWith({
      type: 'error',
      message: 'ELK 布局计算失败',
      data: 'boom',
    });
    (process as any).send = originalSend;
  });

  it('does not throw when process.send is unavailable', async () => {
    (process as any).send = undefined;
    mockLayout.mockResolvedValue({ id: 'root' });

    expect(() => listener({ type: 'layout', graphData: { id: 'root' } })).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
