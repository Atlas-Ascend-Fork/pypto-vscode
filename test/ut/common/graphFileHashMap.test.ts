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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
