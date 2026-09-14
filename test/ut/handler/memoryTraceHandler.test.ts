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

const mockEventStore = vi.hoisted(() => ({
  query: vi.fn(() => ({
    filter: vi.fn(() => ({
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
  batchSet: vi.fn().mockResolvedValue(undefined),
}));

const mockCacheStore = vi.hoisted(() => ({
  query: vi.fn(() => ({
    filter: vi.fn(() => ({
      exec: vi.fn().mockResolvedValue([]),
    })),
  })),
  set: vi.fn().mockResolvedValue(undefined),
  find: vi.fn().mockResolvedValue(null),
}));

const mockGetMemoryTraceEventStore = vi.hoisted(() =>
  vi.fn(() => mockEventStore)
);

const mockGetMemoryTraceCacheStore = vi.hoisted(() =>
  vi.fn(() => mockCacheStore)
);

vi.mock('../../../src/core/sqlInit', () => ({
  getMemoryTraceEventStore: mockGetMemoryTraceEventStore,
  getMemoryTraceCacheStore: mockGetMemoryTraceCacheStore,
  MemoryTraceEvent: class {},
  BufferState: class {},
}));

vi.mock('fs', () => ({
  createReadStream: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    stat: vi.fn().mockResolvedValue({ size: 1000, mtimeMs: 1234567890 }),
    readFile: vi.fn().mockResolvedValue(Buffer.from('{}')),
  },
  stat: vi.fn().mockResolvedValue({ size: 1000, mtimeMs: 1234567890 }),
  readFile: vi.fn().mockResolvedValue(Buffer.from('{}')),
}));

vi.mock('stream-json', () => ({
  parser: vi.fn(() => ({
    on: vi.fn(),
    pipe: vi.fn(),
  })),
}));

vi.mock('stream-json/streamers/StreamValues', () => ({
  streamValues: vi.fn(() => ({
    on: vi.fn(),
    [Symbol.asyncIterator]: async function* () {
      yield { value: {} };
    },
  })),
}));

import { MemoryTraceHandler } from '../../../src/handler/memoryTraceHandler';
import { createReadStream } from 'fs';
import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';

describe('MemoryTraceHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isCacheValid', () => {
    it('should return false when no cache records exist', async () => {
      const result = await MemoryTraceHandler.isCacheValid('/test/file.json');
      expect(result).toBe(false);
    });

    it('should return false when event records are empty', async () => {
      mockGetMemoryTraceCacheStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ mtime: 1234567890 }]),
          })),
        })),
        set: vi.fn(),
      } as any);

      const result = await MemoryTraceHandler.isCacheValid('/test/file.json');
      expect(result).toBe(false);
    });

    it('should return true when mtime matches', async () => {
      mockGetMemoryTraceEventStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ id: 1 }]),
          })),
        })),
        batchSet: vi.fn(),
      } as any);

      mockGetMemoryTraceCacheStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ mtime: 1234567890 }]),
          })),
        })),
        set: vi.fn(),
      } as any);

      const result = await MemoryTraceHandler.isCacheValid('/test/file.json');
      expect(result).toBe(true);
    });

    it('should return false when mtime does not match', async () => {
      mockGetMemoryTraceEventStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ id: 1 }]),
          })),
        })),
        batchSet: vi.fn(),
      } as any);

      mockGetMemoryTraceCacheStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ mtime: 9999999999 }]),
          })),
        })),
        set: vi.fn(),
      } as any);

      const result = await MemoryTraceHandler.isCacheValid('/test/file.json');
      expect(result).toBe(false);
    });
  });

  describe('parse', () => {
    it('should skip parsing when cache is valid', async () => {
      mockGetMemoryTraceEventStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ id: 1 }]),
          })),
        })),
        batchSet: vi.fn(),
      } as any);

      mockGetMemoryTraceCacheStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ mtime: 1234567890 }]),
          })),
        })),
        set: vi.fn(),
      } as any);

      await MemoryTraceHandler.parse('/test/file.json');
      expect(mockGetMemoryTraceEventStore().batchSet).not.toHaveBeenCalled();
    });

    it('should parse and cache when cache is invalid', async () => {
      const fs = await import('fs/promises');
      vi.mocked(fs.readFile).mockResolvedValueOnce(
        Buffer.from(JSON.stringify({ timeline: [{ eventType: 'ALLOC_EXEC', clock: 100, memId: 1 }] }))
      );

      await MemoryTraceHandler.parse('/test/file.json');
      expect(mockEventStore.batchSet).toHaveBeenCalled();
    });
  });

  describe('saveToCache', () => {
    it('should handle empty timeline', async () => {
      await MemoryTraceHandler.saveToCache('/test/file.json', { timeline: [] });
      expect(mockGetMemoryTraceEventStore().batchSet).not.toHaveBeenCalled();
    });

    it('should process ALLOC_EXEC events', async () => {
      const data = {
        timeline: [
          {
            eventType: 'ALLOC_EXEC',
            clock: 100,
            memId: 1,
            memType: 'UB',
            size: 1024,
            addrStart: 0,
          },
        ],
      };

      await MemoryTraceHandler.saveToCache('/test/file.json', data);
      expect(mockEventStore.batchSet).toHaveBeenCalled();
    });

    it('should process multiple event types', async () => {
      const data = {
        timeline: [
          { eventType: 'ALLOC_EXEC', clock: 100, memId: 1, memType: 'UB', size: 1024, addrStart: 0 },
          { eventType: 'OP_LAUNCH', clock: 101, opMagic: 10, inputMemIds: [1], outputMemIds: [2] },
          { eventType: 'OP_RETIRE', clock: 102, opMagic: 10, freedMemIds: [1] },
        ],
      };

      await MemoryTraceHandler.saveToCache('/test/file.json', data);
      expect(mockEventStore.batchSet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ eventType: 'ALLOC_EXEC' }),
          expect.objectContaining({ eventType: 'OP_LAUNCH' }),
          expect.objectContaining({ eventType: 'OP_RETIRE' }),
        ])
      );
    });

    it('should group events by clock', async () => {
      const data = {
        timeline: [
          { eventType: 'ALLOC_EXEC', clock: 100, memId: 1, memType: 'UB', size: 1024, addrStart: 0 },
          { eventType: 'ALLOC_EXEC', clock: 100, memId: 2, memType: 'UB', size: 2048, addrStart: 1024 },
          { eventType: 'OP_LAUNCH', clock: 101, opMagic: 10, inputMemIds: [1], outputMemIds: [2] },
        ],
      };

      await MemoryTraceHandler.saveToCache('/test/file.json', data);
      expect(mockCacheStore.set).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: '/test/file.json',
          timelineData: expect.any(String),
        })
      );
    });

    it('should process SPILL, INIT_DDR_BUFFER, BUFFER_REARRANGE and ALLOC_FAIL events', async () => {
      const GM_BUFFER_SIZE = 32 * 1024 * 1024;
      const data = {
        timeline: [
          { eventType: 'ALLOC_EXEC', clock: 100, memId: 1, memType: 'UB', size: 512, addrStart: 0 },
          { eventType: 'SPILL', clock: 101, memId: 1, spillDdrMemId: 100 },
          { eventType: 'INIT_DDR_BUFFER', clock: 102, memId: 2 },
          { eventType: 'BUFFER_REARRANGE', clock: 103, changes: [{ memId: 2, newStart: 999 }] },
          { eventType: 'ALLOC_FAIL', clock: 104, memType: 'UB' },
        ],
      };

      await MemoryTraceHandler.saveToCache('/test/file.json', data);

      const saved = mockEventStore.batchSet.mock.calls[0][0];
      expect(saved).toHaveLength(5);

      const spillEvent = saved.find((e: any) => e.eventType === 'SPILL');
      expect(spillEvent.action.targetBufferList).toEqual([
        { memId: 1, memType: 'UB', addrStart: 0, size: 512, status: 0 },
        { memId: 100, memType: 'MEM_GM', addrStart: 0, size: GM_BUFFER_SIZE, status: 2 },
      ]);

      const initDdrEvent = saved.find((e: any) => e.eventType === 'INIT_DDR_BUFFER');
      expect(initDdrEvent.action.targetBufferList).toEqual([
        { memId: 2, memType: 'MEM_GM', addrStart: GM_BUFFER_SIZE, size: GM_BUFFER_SIZE, status: 2 },
      ]);

      const rearrangeEvent = saved.find((e: any) => e.eventType === 'BUFFER_REARRANGE');
      expect(rearrangeEvent.action.targetBufferList).toEqual([{ memId: 2, memType: 'MEM_GM', addrStart: 999, size: GM_BUFFER_SIZE, status: 2 }]);

      const allocFailEvent = saved.find((e: any) => e.eventType === 'ALLOC_FAIL');
      expect(allocFailEvent.action.errorMemType).toEqual(['UB']);
    });
  });

  describe('parse large files via stream', () => {
    it('reads data with stream when file size exceeds 200MB', async () => {
      const fsPromises = await import('fs/promises');
      vi.mocked(fsPromises.stat).mockResolvedValueOnce({ size: 300 * 1024 * 1024, mtimeMs: 1234567890 } as any);

      const timelineData = { timeline: [{ eventType: 'ALLOC_EXEC', clock: 100, memId: 1, memType: 'UB', size: 64, addrStart: 0 }] };
      const valuesStreamer = {
        on: vi.fn(),
        [Symbol.asyncIterator]: async function* () {
          yield { value: timelineData };
        },
      };
      const jsonParser = { on: vi.fn(), pipe: vi.fn() };
      vi.mocked(parser).mockImplementation(() => jsonParser as any);
      vi.mocked(streamValues).mockImplementation(() => valuesStreamer as any);
      vi.mocked(createReadStream).mockImplementation(() => ({ on: vi.fn(), pipe: vi.fn(() => jsonParser) } as any));

      await MemoryTraceHandler.parse('/test/big.json');

      expect(createReadStream).toHaveBeenCalledWith('/test/big.json');
      expect(mockEventStore.batchSet).toHaveBeenCalled();
    });
  });

  describe('getMetadata', () => {
    it('returns null when no cache record exists', async () => {
      await expect(MemoryTraceHandler.getMetadata('/test/file.json')).resolves.toBeNull();
    });

    it('returns cached metadata', async () => {
      mockGetMemoryTraceCacheStore.mockReturnValueOnce({
        query: vi.fn(() => ({
          filter: vi.fn(() => ({
            exec: vi.fn().mockResolvedValue([{ totalCycles: 42, chipArch: 'Ascend910B' }]),
          })),
        })),
        set: vi.fn(),
        find: vi.fn(),
      } as any);

      const result = await MemoryTraceHandler.getMetadata('/test/file.json');

      expect(result).toEqual({ totalCycles: 42, scheduleResult: '', chipArch: 'Ascend910B' });
    });
  });

  describe('getTimelineEvents', () => {
    it('returns empty array when cache misses', async () => {
      await expect(MemoryTraceHandler.getTimelineEvents('/test/file.json')).resolves.toEqual([]);
    });

    it('parses pre-aggregated clock events from cache', async () => {
      mockGetMemoryTraceCacheStore.mockReturnValueOnce({
        query: vi.fn(),
        set: vi.fn(),
        find: vi.fn().mockResolvedValue({
          timelineData: JSON.stringify([
            [100, [{ id: 0, eventType: 'ALLOC_EXEC' }]],
            [200, [{ id: 1, eventType: 'OP_LAUNCH' }]],
          ]),
        }),
      } as any);

      const result = await MemoryTraceHandler.getTimelineEvents('/test/file.json');

      expect(result).toEqual([
        { clock: 100, events: [{ id: 0, eventType: 'ALLOC_EXEC' }] },
        { clock: 200, events: [{ id: 1, eventType: 'OP_LAUNCH' }] },
      ]);
    });
  });
});
