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
import { graphFileHashMap } from '../../../src/common/graphFileHashMap';

describe('graphFileHashMap', () => {
  it('should export an empty object', () => {
    expect(graphFileHashMap).toEqual({});
  });

  it('should be able to store and retrieve data', () => {
    const testKey = 'test-key';
    const testData = { value: 'test-value' };
    
    graphFileHashMap[testKey] = testData;
    
    expect(graphFileHashMap[testKey]).toEqual(testData);
    
    // Clean up
    delete graphFileHashMap[testKey];
  });

  it('should be able to store multiple entries', () => {
    const testData = {
      'key1': { value: 'value1' },
      'key2': { value: 'value2' },
      'key3': { value: 'value3' },
    };

    Object.entries(testData).forEach(([key, value]) => {
      graphFileHashMap[key] = value;
    });

    expect(Object.keys(graphFileHashMap)).toHaveLength(3);
    expect(graphFileHashMap['key1']).toEqual({ value: 'value1' });
    expect(graphFileHashMap['key2']).toEqual({ value: 'value2' });
    expect(graphFileHashMap['key3']).toEqual({ value: 'value3' });

    // Clean up
    Object.keys(testData).forEach(key => {
      delete graphFileHashMap[key];
    });
  });

  it('should be able to delete entries', () => {
    graphFileHashMap['test-key'] = { value: 'test' };
    expect(graphFileHashMap['test-key']).toBeDefined();

    delete graphFileHashMap['test-key'];
    expect(graphFileHashMap['test-key']).toBeUndefined();
  });

  it('should handle complex data structures', () => {
    const complexData = {
      nodes: [
        { id: 'node1', type: 'tensor' },
        { id: 'node2', type: 'operation' },
      ],
      edges: [
        { source: 'node1', target: 'node2' },
      ],
      metadata: {
        version: '1.0',
        timestamp: Date.now(),
      },
    };

    graphFileHashMap['complex-key'] = complexData;
    expect(graphFileHashMap['complex-key']).toEqual(complexData);

    // Clean up
    delete graphFileHashMap['complex-key'];
  });
});
