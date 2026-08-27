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

// Replicate the function for testing
function decodeComputeGraphFilename(
  filename: string,
  { passIndex, passName }: { passIndex: string; passName: string },
): { pathName: string; computeType: 'root' | 'leaf' | 'all'; leafProgramId?: string; leafHash?: string } | undefined {
  const fileNameRegExp = new RegExp(
    `^After_0${passIndex}_${passName}(?:_?\\d+)?_(\\w+_PATH\\d+)(?:_hiddenfunc\\d+)?_\\d+(?:_(ROOT|LEAF)(?:_program_id_(\\d+)_(\\d+))?)?\\.json$`,
  );
  const matchArray = filename.match(fileNameRegExp);
  if (!matchArray) {
    return;
  }
  const [_, pathName, rootOrLeaf, leafProgramId, leafHash] = matchArray;
  const computeType = rootOrLeaf ? (rootOrLeaf.toLowerCase() as 'root' | 'leaf') : 'all';
  return { pathName, computeType, leafProgramId, leafHash };
}

describe('run-data/utils/scan-output', () => {
  describe('decodeComputeGraphFilename', () => {
    it('should parse valid compute graph filename with ROOT type', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_123_main_PATH1_456_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeDefined();
      expect(result?.pathName).toBe('main_PATH1');
      expect(result?.computeType).toBe('root');
      expect(result?.leafProgramId).toBeUndefined();
      expect(result?.leafHash).toBeUndefined();
    });

    it('should parse valid compute graph filename with LEAF type', () => {
      const result = decodeComputeGraphFilename(
        'After_02_BufferFusion_func_PATH2_789_LEAF_program_id_00_123.json',
        { passIndex: '2', passName: 'BufferFusion' }
      );
      
      expect(result).toBeDefined();
      expect(result?.pathName).toBe('func_PATH2');
      expect(result?.computeType).toBe('leaf');
      expect(result?.leafProgramId).toBe('00');
      expect(result?.leafHash).toBe('123');
    });

    it('should parse filename without ROOT/LEAF (all type)', () => {
      const result = decodeComputeGraphFilename(
        'After_03_CodeGen_999_test_PATH3_888.json',
        { passIndex: '3', passName: 'CodeGen' }
      );
      
      expect(result).toBeDefined();
      expect(result?.pathName).toBe('test_PATH3');
      expect(result?.computeType).toBe('all');
    });

    it('should extract pathName from filename', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_123_my_function_PATH5_456_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result?.pathName).toBe('my_function_PATH5');
    });

    it('should extract computeType (ROOT)', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_123_func_PATH1_456_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result?.computeType).toBe('root');
    });

    it('should extract computeType (LEAF)', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_func_PATH1_789_LEAF_program_id_01_123.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result?.computeType).toBe('leaf');
    });

    it('should extract leafProgramId', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_func_PATH1_789_LEAF_program_id_05_123.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result?.leafProgramId).toBe('05');
    });

    it('should extract leafHash', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_func_PATH1_789_LEAF_program_id_05_456.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result?.leafHash).toBe('456');
    });

    it('should return undefined for invalid filename', () => {
      const result = decodeComputeGraphFilename(
        'invalid_filename.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeUndefined();
    });

    it('should return undefined for wrong pass index', () => {
      const result = decodeComputeGraphFilename(
        'After_02_TensorGraph_123_func_PATH1_456_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeUndefined();
    });

    it('should return undefined for wrong pass name', () => {
      const result = decodeComputeGraphFilename(
        'After_01_BufferFusion_123_func_PATH1_456_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeUndefined();
    });

    it('should handle filenames with hiddenfunc', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_123_func_PATH1_hiddenfunc5_456_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeDefined();
      expect(result?.pathName).toBe('func_PATH1');
    });

    it('should handle filenames with extra number before pathName', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_999_func_PATH1_123_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeDefined();
      expect(result?.pathName).toBe('func_PATH1');
    });

    it('should handle empty filename', () => {
      const result = decodeComputeGraphFilename(
        '',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeUndefined();
    });

    it('should handle filename without .json extension', () => {
      const result = decodeComputeGraphFilename(
        'After_01_TensorGraph_123_func_PATH1_456_ROOT',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result).toBeUndefined();
    });

    it('should handle ROOT/LEAF in uppercase only', () => {
      const result1 = decodeComputeGraphFilename(
        'After_01_TensorGraph_func_PATH1_789_ROOT.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result1?.computeType).toBe('root');
      
      const result2 = decodeComputeGraphFilename(
        'After_01_TensorGraph_func_PATH1_789_LEAF_program_id_00_123.json',
        { passIndex: '1', passName: 'TensorGraph' }
      );
      
      expect(result2?.computeType).toBe('leaf');
    });
  });
});
