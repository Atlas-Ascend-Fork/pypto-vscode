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

import { buildLayoutCacheKey } from '../../../src/handler/graph-cache-key';

describe('buildLayoutCacheKey', () => {
  it('builds basic key with empty options', () => {
    const result = buildLayoutCacheKey('abc123', {});
    expect(result).toBe('abc123_notshowtensor');
  });

  it('appends _hasParent when hasParent is true', () => {
    const result = buildLayoutCacheKey('abc123', { hasParent: true });
    expect(result).toBe('abc123_hasParent_notshowtensor');
  });

  it('appends _down when direction is DOWN', () => {
    const result = buildLayoutCacheKey('abc123', { direction: 'DOWN' });
    expect(result).toBe('abc123_down_notshowtensor');
  });

  it('does not append _notshowtensor when showTensor is true', () => {
    const result = buildLayoutCacheKey('abc123', { showTensor: true });
    expect(result).toBe('abc123');
  });

  it('appends filePath when provided', () => {
    const result = buildLayoutCacheKey('abc123', { filePath: '/path/to/file.json', showTensor: true });
    expect(result).toBe('abc123/path/to/file.json');
  });

  it('appends _threeMode when threeMode is true', () => {
    const result = buildLayoutCacheKey('abc123', { threeMode: true, showTensor: true });
    expect(result).toBe('abc123_threeMode');
  });

  it('combines multiple options in correct order', () => {
    const result = buildLayoutCacheKey('abc123', {
      hasParent: true,
      direction: 'DOWN',
      showTensor: false,
      filePath: '/test.json',
      threeMode: true,
    });
    expect(result).toBe('abc123_hasParent_down_notshowtensor/test.json_threeMode');
  });

  it('handles undefined filePath gracefully', () => {
    const result = buildLayoutCacheKey('abc123', { showTensor: true });
    expect(result).toBe('abc123');
  });

  it('handles all options false/undefined', () => {
    const result = buildLayoutCacheKey('xyz789', {
      hasParent: false,
      direction: 'UP',
      showTensor: false,
    });
    expect(result).toBe('xyz789_notshowtensor');
  });
});
