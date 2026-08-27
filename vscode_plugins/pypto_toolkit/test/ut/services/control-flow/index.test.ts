import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

const mockControlFlowStore = {
  find: vi.fn(),
  set: vi.fn(),
};

vi.mock('../../../../src/services/control-flow/store', () => ({
  getControlFlowStore: vi.fn(() => mockControlFlowStore),
}));

const mockGetOutputDetail = vi.fn();
vi.mock('../../../../src/services/run-data/api', () => ({
  getOutputDetail: (...args: any[]) => mockGetOutputDetail(...args),
}));

vi.mock('../../../../src/services/control-flow/flow-tree', () => ({
  FlowTreeAnalyzer: class MockFlowTreeAnalyzer {
    constructor(..._args: any[]) {}
    getControlFlow() {
      return [{ type: 'path', children: [] }];
    }
  },
}));

const mockReadLinesByTextDocument = vi.fn();
const mockOpenTargetFileInSplit = vi.fn();
vi.mock('../../../../src/services/control-flow/source-code', () => ({
  readLinesByTextDocument: (...args: any[]) => mockReadLinesByTextDocument(...args),
  openTargetFileInSplit: (...args: any[]) => mockOpenTargetFileInSplit(...args),
}));

const mockReadRunData = vi.fn();
vi.mock('../../../../src/services/run-data/utils/scan-run-data', () => ({
  readRunData: (...args: any[]) => mockReadRunData(...args),
}));

import { getControlFlow, getSnippetCodeText, openControlFlowTargetFile, readProgramPath } from '../../../../src/services/control-flow';

describe('control-flow/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getControlFlow', () => {
    it('should return cached control flow if available', async () => {
      const cachedFlow = { sourceFilePath: '/test/program.json', runDataPath: '/test', flow: [{ type: 'path' }] };
      mockControlFlowStore.find.mockResolvedValue(cachedFlow);

      const result = await getControlFlow({ outputDirPath: '/test', controlFlowFilePath: '/test/program.json' });

      expect(result.data).toEqual([{ type: 'path' }]);
    });

    it('should parse program.json and build flow tree when not cached', async () => {
      mockControlFlowStore.find.mockResolvedValue(null);
      const programJson = JSON.stringify({ entry: '123' });
      const buf = Buffer.from(programJson, 'utf-8');
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(buf as any);
      mockGetOutputDetail.mockResolvedValue({ data: null });

      const result = await getControlFlow({ outputDirPath: '/test', controlFlowFilePath: '/test/program.json' });

      expect(result.data).toBeDefined();
      expect(mockControlFlowStore.set).toHaveBeenCalled();
    });

    it('should throw error when program.json is invalid JSON', async () => {
      mockControlFlowStore.find.mockResolvedValue(null);
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(new TextEncoder().encode('invalid json') as any);

      await expect(getControlFlow({ outputDirPath: '/test', controlFlowFilePath: '/test/program.json' })).rejects.toThrow('无法解析program.json');
    });
  });

  describe('getSnippetCodeText', () => {
    it('should call readLinesByTextDocument with correct params', async () => {
      const mockResult = { isSuccessful: 1, document: 'code' };
      mockReadLinesByTextDocument.mockResolvedValue(mockResult);

      const result = await getSnippetCodeText({ filePath: '/test/file.py', startLine: 1, endLine: 10 } as any);

      expect(result).toBe(mockResult);
      expect(mockReadLinesByTextDocument).toHaveBeenCalled();
    });
  });

  describe('openControlFlowTargetFile', () => {
    it('should call openTargetFileInSplit with correct params', async () => {
      await openControlFlowTargetFile({ filePath: '/test/file.py', line: 5 } as any);

      expect(mockOpenTargetFileInSplit).toHaveBeenCalled();
    });
  });

  describe('readProgramPath', () => {
    it('should return controlFlowFilePath from run data', async () => {
      mockReadRunData.mockResolvedValue({ controlFlowFilePath: '/test/program.json' });

      const result = await readProgramPath({ outputPath: '/test/output' });

      expect(result).toBe('/test/program.json');
    });

    it('should return undefined when run data is null', async () => {
      mockReadRunData.mockResolvedValue(null);

      const result = await readProgramPath({ outputPath: '/test/output' });

      expect(result).toBeUndefined();
    });
  });
});
