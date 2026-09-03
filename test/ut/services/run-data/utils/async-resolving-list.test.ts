/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi } from 'vitest';
import { AsyncListResolverImpl } from '../../../../../src/services/run-data/utils/async-resolving-list';

describe('run-data/utils/async-resolving-list', () => {
  describe('AsyncListResolverImpl', () => {
    describe('isResolving', () => {
      it('should return false when not resolving', () => {
        const handler = vi.fn().mockResolvedValue({ data: 'result' });
        const resolver = new AsyncListResolverImpl(handler);
        
        expect(resolver.isResolving()).toBe(false);
      });

      it('should return true when resolving', async () => {
        const handler = vi.fn().mockImplementation(async () => {
          await new Promise(r => setTimeout(r, 10));
          return { data: 'result' };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3]);
        expect(resolver.isResolving()).toBe(true);
        
        await resolver.waitFor(3);
        // Wait for the promise chain to fully complete
        await new Promise(r => setTimeout(r, 20));
        expect(resolver.isResolving()).toBe(false);
      });
    });

    describe('start', () => {
      it('should process items sequentially', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        const results = await resolver.start([1, 2, 3]);
        
        expect(handler).toHaveBeenCalledTimes(3);
        expect(handler).toHaveBeenNthCalledWith(1, 1);
        expect(handler).toHaveBeenNthCalledWith(2, 2);
        expect(handler).toHaveBeenNthCalledWith(3, 3);
        expect(results).toEqual(['result-1', 'result-2', 'result-3']);
      });

      it('should handle empty target list', async () => {
        const handler = vi.fn().mockResolvedValue({ data: 'result' });
        const resolver = new AsyncListResolverImpl(handler);
        
        const results = await resolver.start([]);
        
        expect(handler).not.toHaveBeenCalled();
        expect(results).toEqual([]);
      });

      it('should skip items when handler returns skip: true', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          if (item === 2) {
            return { skip: true };
          }
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        const results = await resolver.start([1, 2, 3]);
        
        expect(handler).toHaveBeenCalledTimes(3);
        expect(results).toEqual(['result-1', 'result-3']);
      });

      it('should return existing task if already resolving', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 10));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        const promise1 = resolver.start([1, 2, 3]);
        const promise2 = resolver.start([4, 5, 6]);
        
        expect(promise1).toBe(promise2);
        
        const results = await promise1;
        expect(results).toEqual(['result-1', 'result-2', 'result-3']);
      });
    });

    describe('waitFor', () => {
      it('should wait for specified number of items', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 10));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3, 4, 5]);
        const results = await resolver.waitFor(3);
        
        expect(results).toHaveLength(3);
        expect(results).toEqual(['result-1', 'result-2', 'result-3']);
      });

      it('should return immediately if already resolved enough items', async () => {
        const handler = vi.fn().mockResolvedValue({ data: 'result' });
        const resolver = new AsyncListResolverImpl(handler);
        
        await resolver.start([1, 2, 3, 4, 5]);
        const results = await resolver.waitFor(3);
        
        expect(results).toHaveLength(3);
      });

      it('should return immediately if not resolving', async () => {
        const handler = vi.fn().mockResolvedValue({ data: 'result' });
        const resolver = new AsyncListResolverImpl(handler);
        
        const results = await resolver.waitFor(5);
        
        expect(results).toEqual([]);
      });

      it('should handle multiple waitFor calls', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 10));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3, 4, 5]);
        
        const [results1, results2, results3] = await Promise.all([
          resolver.waitFor(2),
          resolver.waitFor(3),
          resolver.waitFor(5),
        ]);
        
        // All waitFor calls resolve with the current state at resolution time
        expect(results1.length).toBeGreaterThanOrEqual(2);
        expect(results2.length).toBeGreaterThanOrEqual(3);
        expect(results3).toHaveLength(5);
      });

      it('should trigger all waiters when target reached', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 10));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3]);
        
        const wait1 = resolver.waitFor(2);
        const wait2 = resolver.waitFor(2);
        
        const [results1, results2] = await Promise.all([wait1, wait2]);
        
        expect(results1).toHaveLength(2);
        expect(results2).toHaveLength(2);
      });
    });

    describe('stop', () => {
      it('should stop resolving and return current results', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 50));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3, 4, 5]);
        
        await new Promise(r => setTimeout(r, 60));
        const results = await resolver.stop();
        
        expect(results.length).toBeLessThan(5);
        expect(results.length).toBeGreaterThan(0);
      });

      it('should return resolved list if not resolving', async () => {
        const handler = vi.fn().mockResolvedValue({ data: 'result' });
        const resolver = new AsyncListResolverImpl(handler);
        
        await resolver.start([1, 2, 3]);
        const results = await resolver.stop();
        
        expect(results).toEqual(['result', 'result', 'result']);
      });

      it('should return empty list if never started', async () => {
        const handler = vi.fn().mockResolvedValue({ data: 'result' });
        const resolver = new AsyncListResolverImpl(handler);
        
        const results = await resolver.stop();
        
        expect(results).toEqual([]);
      });

      it('should allow starting new resolution after stop', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 10));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3]);
        await resolver.stop();
        // Wait for the promise chain to fully complete
        await new Promise(r => setTimeout(r, 20));
        
        const results = await resolver.start([4, 5, 6]);
        
        expect(results).toEqual(['result-4', 'result-5', 'result-6']);
      });
    });

    describe('integration scenarios', () => {
      it('should handle waitFor after stop', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 50));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3, 4, 5]);
        await new Promise(r => setTimeout(r, 60));
        await resolver.stop();
        
        const results = await resolver.waitFor(10);
        
        expect(results.length).toBeLessThan(5);
      });

      it('should handle rapid start/stop cycles', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 10));
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3]);
        await resolver.stop();
        await new Promise(r => setTimeout(r, 20));
        
        resolver.start([4, 5, 6]);
        await resolver.stop();
        await new Promise(r => setTimeout(r, 20));
        
        const results = await resolver.start([7, 8, 9]);
        
        expect(results).toEqual(['result-7', 'result-8', 'result-9']);
      });

      it('should handle skip items with waitFor', async () => {
        const handler = vi.fn().mockImplementation(async (item: number) => {
          await new Promise(r => setTimeout(r, 10));
          if (item === 2 || item === 4) {
            return { skip: true };
          }
          return { data: `result-${item}` };
        });
        const resolver = new AsyncListResolverImpl(handler);
        
        resolver.start([1, 2, 3, 4, 5]);
        const results = await resolver.waitFor(3);
        
        expect(results).toEqual(['result-1', 'result-3', 'result-5']);
      });
    });
  });
});
