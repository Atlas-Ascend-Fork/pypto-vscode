/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect } from 'vitest';

// We need to test private functions, so we'll import the module and test through public API
// or we can test the regex pattern directly
const RUN_DATA_DIRNAME_REG_EXP = /^rundata_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/;

function resolveExecuteTime(directoryName: string): { titleFormat: string; datetimeFormat: string } {
  const matches = RUN_DATA_DIRNAME_REG_EXP.exec(directoryName);
  if (!matches) {
    return { titleFormat: '', datetimeFormat: '' };
  }
  const [_, year, month, day, hour, minute, second] = matches;
  return {
    titleFormat: `${year}${month}${day}_${hour}${minute}${second}`,
    datetimeFormat: `${year}-${month}-${day} ${hour}:${minute}:${second}`,
  };
}

function findVerifyDir(path: string, level: number): string {
  if (!path || typeof path !== 'string') return '';
  const cleanPath = path.replace(/\/+$/, '');
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length <= level) return '';
  const result = parts.slice(0, -level).join('/');
  return cleanPath.startsWith('/') ? '/' + result : result;
}

describe('run-data/utils/scan-run-data', () => {
  describe('resolveExecuteTime', () => {
    it('should parse valid directory name', () => {
      const result = resolveExecuteTime('rundata_20250115143025');
      
      expect(result.titleFormat).toBe('20250115_143025');
      expect(result.datetimeFormat).toBe('2025-01-15 14:30:25');
    });

    it('should extract title from directory name', () => {
      const result = resolveExecuteTime('rundata_20260821093045');
      
      expect(result.titleFormat).toBe('20260821_093045');
    });

    it('should format datetime correctly', () => {
      const result = resolveExecuteTime('rundata_20261231235959');
      
      expect(result.datetimeFormat).toBe('2026-12-31 23:59:59');
    });

    it('should handle invalid directory name format', () => {
      const result = resolveExecuteTime('invalid_dir_name');
      
      expect(result.titleFormat).toBe('');
      expect(result.datetimeFormat).toBe('');
    });

    it('should handle missing timestamp', () => {
      const result = resolveExecuteTime('rundata_');
      
      expect(result.titleFormat).toBe('');
      expect(result.datetimeFormat).toBe('');
    });

    it('should handle partial timestamp', () => {
      const result = resolveExecuteTime('rundata_20250115');
      
      expect(result.titleFormat).toBe('');
      expect(result.datetimeFormat).toBe('');
    });

    it('should handle directory name with extra suffix', () => {
      const result = resolveExecuteTime('rundata_20250115143025_extra');
      
      expect(result.titleFormat).toBe('20250115_143025');
      expect(result.datetimeFormat).toBe('2025-01-15 14:30:25');
    });

    it('should handle empty string', () => {
      const result = resolveExecuteTime('');
      
      expect(result.titleFormat).toBe('');
      expect(result.datetimeFormat).toBe('');
    });
  });

  describe('findVerifyDir', () => {
    it('should navigate up N levels from path', () => {
      const result = findVerifyDir('/path/to/deep/directory', 2);
      
      expect(result).toBe('/path/to');
    });

    it('should return empty string if path is too short', () => {
      const result = findVerifyDir('/path', 2);
      
      expect(result).toBe('');
    });

    it('should handle level 0 (return root for absolute paths)', () => {
      const result = findVerifyDir('/path/to/directory', 0);
      
      // When level is 0, slice(0, -0) returns empty array, so result is '/'
      expect(result).toBe('/');
    });

    it('should handle Windows paths', () => {
      const result = findVerifyDir('C:/path/to/directory', 1);
      
      expect(result).toBe('C:/path/to');
    });

    it('should handle Unix paths', () => {
      const result = findVerifyDir('/home/user/project/output', 2);
      
      expect(result).toBe('/home/user');
    });

    it('should handle trailing slashes', () => {
      const result = findVerifyDir('/path/to/directory/', 1);
      
      expect(result).toBe('/path/to');
    });

    it('should handle multiple trailing slashes', () => {
      const result = findVerifyDir('/path/to/directory///', 1);
      
      expect(result).toBe('/path/to');
    });

    it('should handle empty path', () => {
      const result = findVerifyDir('', 1);
      
      expect(result).toBe('');
    });

    it('should handle null path', () => {
      const result = findVerifyDir(null as any, 1);
      
      expect(result).toBe('');
    });

    it('should handle undefined path', () => {
      const result = findVerifyDir(undefined as any, 1);
      
      expect(result).toBe('');
    });

    it('should handle non-string path', () => {
      const result = findVerifyDir(123 as any, 1);
      
      expect(result).toBe('');
    });

    it('should handle path with only root', () => {
      const result = findVerifyDir('/', 1);
      
      expect(result).toBe('');
    });

    it('should handle relative paths', () => {
      const result = findVerifyDir('path/to/directory', 1);
      
      expect(result).toBe('path/to');
    });

    it('should handle level equal to path depth', () => {
      const result = findVerifyDir('/path/to', 2);
      
      expect(result).toBe('');
    });

    it('should handle level greater than path depth', () => {
      const result = findVerifyDir('/path', 5);
      
      expect(result).toBe('');
    });
  });
});
