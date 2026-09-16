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
import { describe, it, expect } from 'vitest';
import { FORMAT_MAP, MEMTYPE_MAP, DATATYPE_MAP } from '../../../../src/core/json-graph/jsonGraph.types';

describe('jsonGraph.types', () => {
  describe('FORMAT_MAP', () => {
    it('maps format enum 0 to ND', () => {
      expect(FORMAT_MAP[0]).toBe('ND');
    });

    it('maps format enum 1 to NZ', () => {
      expect(FORMAT_MAP[1]).toBe('NZ');
    });
  });

  describe('MEMTYPE_MAP', () => {
    it('maps MEM_UB', () => {
      expect(MEMTYPE_MAP[0]).toBe('MEM_UB');
    });

    it('maps MEM_L1', () => {
      expect(MEMTYPE_MAP[1]).toBe('MEM_L1');
    });

    it('maps MEM_L0C', () => {
      expect(MEMTYPE_MAP[4]).toBe('MEM_L0C');
    });

    it('maps MEM_UNKNOW', () => {
      expect(MEMTYPE_MAP[21]).toBe('MEM_UNKNOW');
    });

    it('has 22 entries', () => {
      expect(Object.keys(MEMTYPE_MAP)).toHaveLength(22);
    });
  });

  describe('DATATYPE_MAP', () => {
    it('maps int8', () => {
      expect(DATATYPE_MAP[1]).toBe('int8');
    });

    it('maps fp32', () => {
      expect(DATATYPE_MAP[7]).toBe('fp32');
    });

    it('maps bf16', () => {
      expect(DATATYPE_MAP[8]).toBe('bf16');
    });

    it('maps bool', () => {
      expect(DATATYPE_MAP[15]).toBe('bool');
    });

    it('maps double', () => {
      expect(DATATYPE_MAP[16]).toBe('double');
    });

    it('has 17 entries', () => {
      expect(Object.keys(DATATYPE_MAP)).toHaveLength(17);
    });
  });
});
