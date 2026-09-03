/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logWithTimestamp } from '../../../src/utils/logger';

describe('logger', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('logWithTimestamp', () => {
    it('should print log with timestamp when no baseTime provided', () => {
      const label = 'test label';
      const result = logWithTimestamp(label);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logMessage = consoleLogSpy.mock.calls[0][0];
      expect(logMessage).toMatch(/^\[LOG\]\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\|\s+test label$/);
      expect(typeof result).toBe('number');
    });

    it('should print log with timestamp and elapsed time when baseTime provided', () => {
      const label = 'test label';
      const baseTime = Date.now() - 100;
      const result = logWithTimestamp(label, baseTime);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logMessage = consoleLogSpy.mock.calls[0][0];
      expect(logMessage).toMatch(/^\[LOG\]\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\|\s+test label\s+\|\s+耗时:\s+\d+ms$/);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(baseTime);
    });

    it('should return timestamp without printing when label is empty', () => {
      const result = logWithTimestamp('');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(typeof result).toBe('number');
    });

    it('should calculate elapsed time correctly', () => {
      const label = 'test';
      const baseTime = Date.now() - 500;
      const result = logWithTimestamp(label, baseTime);

      const logMessage = consoleLogSpy.mock.calls[0][0];
      const elapsedMatch = logMessage.match(/耗时:\s+(\d+)ms/);
      expect(elapsedMatch).not.toBeNull();
      const elapsed = parseInt(elapsedMatch![1], 10);
      expect(elapsed).toBeGreaterThanOrEqual(500);
      expect(result).toBeGreaterThan(baseTime);
    });

    it('should return current timestamp', () => {
      const before = Date.now();
      const result = logWithTimestamp('test');
      const after = Date.now();

      expect(result).toBeGreaterThanOrEqual(before);
      expect(result).toBeLessThanOrEqual(after);
    });

    it('should format timestamp in HH:mm:ss.SSS format', () => {
      const label = 'test';
      logWithTimestamp(label);

      const logMessage = consoleLogSpy.mock.calls[0][0];
      // Should match pattern: [LOG]  HH:mm:ss.SSS | label
      expect(logMessage).toMatch(/^\[LOG\]\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\|\s+test$/);
    });
  });
});
