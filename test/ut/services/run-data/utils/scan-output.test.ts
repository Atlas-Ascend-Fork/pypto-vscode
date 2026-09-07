/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockIsFileUriExists = vi.fn();
const mockHasHealthReport = vi.fn();

vi.mock('../../../../../src/utils/file-system', () => ({
  isFileUriExists: (...args: unknown[]) => mockIsFileUriExists(...args),
}));

vi.mock('../../../../../src/utils/health-report', () => ({
  hasHealthReport: (...args: unknown[]) => mockHasHealthReport(...args),
}));

import { workspace, Uri, FileType } from 'vscode';
import { getOutputDirectory } from '../../../../../src/services/run-data/utils/scan-output';
import type { OutputRecord } from '../../../../../src/types/workspace';

const readDirectory = vi.mocked(workspace.fs.readDirectory);

function makeRecord(overrides: Partial<OutputRecord> = {}): OutputRecord {
  return { title: 'run1', directoryPath: '/test/run1', ...overrides } as OutputRecord;
}

describe('run-data/utils/scan-output', () => {
  beforeEach(() => {
    mockIsFileUriExists.mockResolvedValue(false);
    mockHasHealthReport.mockReturnValue(false);
    readDirectory.mockResolvedValue([]);
  });

  describe('getOutputDirectory', () => {
    it('should return null when record has no data file paths', async () => {
      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord());

      expect(result).toBeNull();
    });

    it('should return null when paths are not absolute', async () => {
      const record = makeRecord({
        controlFlowFilePath: 'relative/flow.json',
        swimlaneGraphFilePath: 'relative/swim.json',
        computeGraphDirPath: 'relative/graph',
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result).toBeNull();
      expect(mockIsFileUriExists).not.toHaveBeenCalled();
      expect(readDirectory).not.toHaveBeenCalled();
    });

    it('should include control flow file when it exists', async () => {
      mockIsFileUriExists.mockResolvedValue(true);
      const record = makeRecord({ controlFlowFilePath: '/test/run1/control_flow.json' });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result).not.toBeNull();
      expect(result?.children).toHaveLength(1);
      expect(result?.children[0]).toMatchObject({
        type: 'file',
        fileType: 'controlFlow',
        absolutePath: '/test/run1/control_flow.json',
        extname: 'json',
        outputPath: '/test/run1',
      });
    });

    it('should exclude control flow file when it does not exist', async () => {
      mockIsFileUriExists.mockResolvedValue(false);
      const record = makeRecord({ controlFlowFilePath: '/test/run1/control_flow.json' });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result).toBeNull();
    });

    it('should include swimlane graph file when it exists', async () => {
      mockIsFileUriExists.mockResolvedValue(true);
      const record = makeRecord({ swimlaneGraphFilePath: '/test/run1/swim.json' });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result?.children).toHaveLength(1);
      expect(result?.children[0]).toMatchObject({
        type: 'file',
        fileType: 'swimlaneGraph',
        absolutePath: '/test/run1/swim.json',
      });
    });

    it('should exclude swimlane graph file when it does not exist', async () => {
      mockIsFileUriExists.mockResolvedValue(false);
      const record = makeRecord({ swimlaneGraphFilePath: '/test/run1/swim.json' });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result).toBeNull();
    });

    it('should return output directory metadata', async () => {
      mockIsFileUriExists.mockResolvedValue(true);
      const record = makeRecord({ controlFlowFilePath: '/test/run1/control_flow.json' });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result).toMatchObject({
        type: 'dir',
        directoryType: 'output',
        name: 'run1',
        absolutePath: '/test/run1',
      });
    });
  });

  describe('compute graph directory', () => {
    const graphDir = '/test/run1/graph';

    function mockGraphDirListing(listing: Record<string, [string, number][]>) {
      readDirectory.mockImplementation(async (uri: { fsPath: string }) => {
        const entry = listing[uri.fsPath];
        if (!entry) {
          throw new Error('ENOENT');
        }
        return entry as [string, vscode.FileType][];
      });
    }

    it('should build compute directory with pass and graph files', async () => {
      mockGraphDirListing({
        [graphDir]: [
          ['Pass_1_TensorGraph', FileType.Directory],
          ['README.md', FileType.File],
          ['not_a_pass', FileType.Directory],
        ],
        [`${graphDir}/Pass_1_TensorGraph`]: [
          ['After_01_TensorGraph_123_main_PATH1_456_ROOT.json', FileType.File],
          ['invalid_name.json', FileType.File],
          ['subdir', FileType.Directory],
        ],
      });
      const record = makeRecord({ computeGraphDirPath: graphDir });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result?.children).toHaveLength(1);
      const computeDir = result?.children[0];
      expect(computeDir).toMatchObject({ type: 'dir', directoryType: 'compute', absolutePath: graphDir });
      expect(computeDir?.children).toHaveLength(1);
      const pass = computeDir?.children[0];
      expect(pass).toMatchObject({
        directoryType: 'pass',
        name: 'Pass_1_TensorGraph',
        passStage: 'tensor',
        passIndex: '1',
        absolutePath: `${graphDir}/Pass_1_TensorGraph`,
      });
      expect(pass?.children).toHaveLength(1);
      expect(pass?.children[0]).toMatchObject({
        fileType: 'computeGraph',
        pathName: 'main_PATH1',
        computeType: 'root',
        name: 'After_01_TensorGraph_123_main_PATH1_456_ROOT.json',
        passIndex: '1',
        hasHealthReport: false,
      });
    });

    it('should parse LEAF type with program id and leaf hash', async () => {
      mockGraphDirListing({
        [graphDir]: [['Pass_1_TensorGraph', FileType.Directory]],
        [`${graphDir}/Pass_1_TensorGraph`]: [
          ['After_01_TensorGraph_123_func_PATH1_789_LEAF_program_id_05_456.json', FileType.File],
        ],
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord({ computeGraphDirPath: graphDir }));

      const graph = (result?.children[0] as { children: { children: unknown[] }[] })?.children[0]?.children[0] as Record<string, unknown>;
      expect(graph).toMatchObject({ computeType: 'leaf', leafProgramId: '05', leafHash: '456' });
    });

    it('should parse all type when no ROOT/LEAF suffix', async () => {
      mockGraphDirListing({
        [graphDir]: [['Pass_1_TensorGraph', FileType.Directory]],
        [`${graphDir}/Pass_1_TensorGraph`]: [['After_01_TensorGraph_999_test_PATH3_888.json', FileType.File]],
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord({ computeGraphDirPath: graphDir }));

      const graph = (result?.children[0] as { children: { children: unknown[] }[] })?.children[0]?.children[0] as Record<string, unknown>;
      expect(graph).toMatchObject({ computeType: 'all', pathName: 'test_PATH3' });
    });

    it('should parse filename with hiddenfunc segment', async () => {
      mockGraphDirListing({
        [graphDir]: [['Pass_1_TensorGraph', FileType.Directory]],
        [`${graphDir}/Pass_1_TensorGraph`]: [
          ['After_01_TensorGraph_123_func_PATH1_hiddenfunc5_456_ROOT.json', FileType.File],
        ],
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord({ computeGraphDirPath: graphDir }));

      const graph = (result?.children[0] as { children: { children: unknown[] }[] })?.children[0]?.children[0] as Record<string, unknown>;
      expect(graph).toMatchObject({ pathName: 'func_PATH1', computeType: 'root' });
    });

    it('should skip graph files not matching pass index or pattern', async () => {
      mockGraphDirListing({
        [graphDir]: [['Pass_1_TensorGraph', FileType.Directory]],
        [`${graphDir}/Pass_1_TensorGraph`]: [
          ['After_02_TensorGraph_123_main_PATH1_456_ROOT.json', FileType.File],
          ['After_01_BufferFusion_123_main_PATH1_456_ROOT.json', FileType.File],
          ['After_01_TensorGraph_123_main_PATH1_456_ROOT', FileType.File],
        ],
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord({ computeGraphDirPath: graphDir }));

      expect(result).toBeNull();
    });

    it('should advance passStage after stage-end pass', async () => {
      mockGraphDirListing({
        [graphDir]: [
          ['Pass_1_TensorGraph', FileType.Directory],
          ['Pass_2_ExpandFunction', FileType.Directory],
          ['Pass_3_BufferFusion', FileType.Directory],
        ],
        [`${graphDir}/Pass_1_TensorGraph`]: [['After_01_TensorGraph_123_main_PATH1_456_ROOT.json', FileType.File]],
        [`${graphDir}/Pass_2_ExpandFunction`]: [['After_02_ExpandFunction_123_main_PATH1_456_ROOT.json', FileType.File]],
        [`${graphDir}/Pass_3_BufferFusion`]: [['After_03_BufferFusion_123_main_PATH1_456_ROOT.json', FileType.File]],
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord({ computeGraphDirPath: graphDir }));

      const passes = (result?.children[0] as { children: { passStage: string }[] })?.children;
      expect(passes).toHaveLength(3);
      expect(passes?.[0].passStage).toBe('tensor');
      expect(passes?.[1].passStage).toBe('tensor');
      expect(passes?.[2].passStage).toBe('tile');
    });

    it('should skip pass directories without valid graph files', async () => {
      mockGraphDirListing({
        [graphDir]: [
          ['Pass_1_TensorGraph', FileType.Directory],
          ['Pass_2_EmptyPass', FileType.Directory],
        ],
        [`${graphDir}/Pass_1_TensorGraph`]: [['After_01_TensorGraph_123_main_PATH1_456_ROOT.json', FileType.File]],
        [`${graphDir}/Pass_2_EmptyPass`]: [['not_a_graph.txt', FileType.File]],
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord({ computeGraphDirPath: graphDir }));

      const passes = (result?.children[0] as { children: unknown[] })?.children;
      expect(passes).toHaveLength(1);
      expect((passes?.[0] as { name: string }).name).toBe('Pass_1_TensorGraph');
    });

    it('should return empty (null) when compute dir read fails', async () => {
      readDirectory.mockRejectedValue(new Error('ENOENT'));
      const record = makeRecord({ computeGraphDirPath: graphDir });

      const result = await getOutputDirectory(Uri.file('/test/run1'), record);

      expect(result).toBeNull();
    });

    it('should attach hasHealthReport flag from health-report util', async () => {
      mockHasHealthReport.mockReturnValue(true);
      mockGraphDirListing({
        [graphDir]: [['Pass_1_TensorGraph', FileType.Directory]],
        [`${graphDir}/Pass_1_TensorGraph`]: [['After_01_TensorGraph_123_main_PATH1_456_ROOT.json', FileType.File]],
      });

      const result = await getOutputDirectory(Uri.file('/test/run1'), makeRecord({ computeGraphDirPath: graphDir }));

      const graph = (result?.children[0] as { children: { children: unknown[] }[] })?.children[0]?.children[0] as Record<string, unknown>;
      expect(graph?.hasHealthReport).toBe(true);
    });
  });
});
