import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockPlatform = vi.fn();
const mockExec = vi.fn();

const mockQueryResult = {
  sort: vi.fn().mockReturnThis(),
  search: vi.fn().mockReturnThis(),
  notNull: vi.fn().mockReturnThis(),
  count: vi.fn().mockResolvedValue(5),
  slice: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([{ title: 'run1', directoryTree: { children: [] } }]),
  filter: vi.fn().mockReturnThis(),
};

const mockRunDataService = {
  scanDirectory: vi.fn(),
  waitForScanning: vi.fn(),
  query: vi.fn(() => mockQueryResult),
  getOutputRecord: vi.fn(),
  getOutputDetail: vi.fn(),
  refreshOutputRecord: vi.fn(),
  deleteData: vi.fn(),
};

vi.mock('../../../../src/services', () => ({
  useService: vi.fn((name: string) => {
    if (name === 'runData') return mockRunDataService;
    return null;
  }),
}));

vi.mock('fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
}));

vi.mock('os', () => ({
  platform: (...args: any[]) => mockPlatform(...args),
  default: { platform: (...args: any[]) => mockPlatform(...args) },
}));

vi.mock('child_process', () => ({
  exec: (...args: any[]) => mockExec(...args),
}));

import { getRunDataList, getOutputDetail, getRunDataBySwimlaneGraphPath, deleteRunData, syncRunDataFiles } from '../../../../src/services/run-data/api';

describe('run-data/api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform.mockReturnValue('win32');
    mockExistsSync.mockReturnValue(false);
    mockExec.mockImplementation((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') cb(null, '', '');
    });
    mockQueryResult.sort.mockReturnThis();
    mockQueryResult.search.mockReturnThis();
    mockQueryResult.notNull.mockReturnThis();
    mockQueryResult.slice.mockReturnThis();
    mockQueryResult.filter.mockReturnThis();
  });

  describe('getRunDataList', () => {
    it('should return paginated run data list', async () => {
      const result = await getRunDataList({ page: 1, pageSize: 20 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result.total).toBe(5);
      expect(mockRunDataService.query).toHaveBeenCalled();
    });

    it('should force reload when forceReloadFromFiles is true', async () => {
      mockQueryResult.exec.mockResolvedValue([{ title: 'run1', directoryPath: '/test/run1', sourceFilePath: '/test/run1/source.json', directoryTree: { children: [] } }]);
      await getRunDataList({ page: 1, forceReloadFromFiles: true });

      expect(mockRunDataService.scanDirectory).toHaveBeenCalled();
    });

    it('should apply search filter when titleKeyword is provided', async () => {
      await getRunDataList({ page: 1, titleKeyword: 'test' });

      expect(mockQueryResult.search).toHaveBeenCalledWith('title', 'test', false);
    });

    it('should apply notNull filter for three column view', async () => {
      await getRunDataList({ page: 1, isThreeColumnNotNull: true });

      expect(mockQueryResult.notNull).toHaveBeenCalledWith(['swimlaneGraphFilePath', 'controlFlowFilePath']);
    });

    it('should strip directoryTree from records', async () => {
      const result = await getRunDataList({ page: 1 });

      expect(result.data[0].directoryTree).toBeUndefined();
    });

    it('should sync first record files when forceReload on linux with rundata.json', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');
      const noFileRecord = { title: 'run1', directoryPath: '/test/run1', directoryTree: { children: [] } };
      const refreshedRecord = { title: 'run1', directoryPath: '/test/run1', sourceFilePath: '/test/run1/source.json', directoryTree: { children: [] } };
      mockQueryResult.exec.mockResolvedValue([noFileRecord]);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(refreshedRecord);

      await getRunDataList({ page: 1, forceReloadFromFiles: true });

      expect(mockRunDataService.refreshOutputRecord).toHaveBeenCalledWith('/test/run1');
    });
  });

  describe('getOutputDetail', () => {
    it('should return output detail when record has files', async () => {
      const mockRecord = { title: 'run1', sourceFilePath: '/test/run1/source.json' };
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputRecord.mockResolvedValue(mockRecord);
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);

      const result = await getOutputDetail({ outputDirPath: '/test/run1' });

      expect(result.data).toBe(mockDetail);
    });

    it('should refresh and return detail when files initially missing but refresh succeeds', async () => {
      const noFileRecord = { title: 'run1' };
      const refreshedRecord = { title: 'run1', sourceFilePath: '/test/run1/source.json' };
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputRecord.mockResolvedValue(noFileRecord);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(refreshedRecord);
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);

      const result = await getOutputDetail({ outputDirPath: '/test/run1' });

      expect(mockRunDataService.refreshOutputRecord).toHaveBeenCalledWith('/test/run1');
      expect(result.data).toBe(mockDetail);
    });

    it('should return null and show filesNotFound on Windows when files still missing after refresh', async () => {
      const noFileRecord = { title: 'run1' };
      mockRunDataService.getOutputRecord.mockResolvedValue(noFileRecord);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(noFileRecord);

      const result = await getOutputDetail({ outputDirPath: '/test/run1' });

      expect(result.data).toBeNull();
      expect(vi.mocked(await import('vscode')).window.showWarningMessage).toHaveBeenCalled();
    });

    it('should return null when record is undefined and refresh is also undefined', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue(undefined);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(undefined);

      const result = await getOutputDetail({ outputDirPath: '/test/run1' });

      expect(result.data).toBeNull();
    });

    it('should sync on linux when files missing and rundata.json exists', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{}');
      const noFileRecord = { title: 'run1' };
      mockRunDataService.getOutputRecord.mockResolvedValue(noFileRecord);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(noFileRecord);

      const result = await getOutputDetail({ outputDirPath: '/test/run1' });

      expect(result.data).toBeNull();
    });
  });

  describe('getRunDataBySwimlaneGraphPath', () => {
    it('should return record matching swimlane graph path', async () => {
      const mockRecord = { title: 'run1', swimlaneGraphFilePath: '/test/swim.json' };
      mockQueryResult.exec.mockResolvedValue([mockRecord]);

      const result = await getRunDataBySwimlaneGraphPath({ swimlaneGraphPath: '/test/swim.json' });

      expect(result).toEqual(mockRecord);
    });

    it('should return null when no record found', async () => {
      mockQueryResult.exec.mockResolvedValue([]);

      const result = await getRunDataBySwimlaneGraphPath({ swimlaneGraphPath: '/test/swim.json' });

      expect(result).toBeNull();
    });
  });

  describe('deleteRunData', () => {
    it('should delete valid records', async () => {
      const mockRecord = { title: 'run1', directoryPath: '/test/run1' };
      mockRunDataService.getOutputRecord.mockResolvedValue(mockRecord);

      await deleteRunData({ directoryPaths: ['/test/run1'] });

      expect(mockRunDataService.deleteData).toHaveBeenCalledWith([mockRecord]);
    });

    it('should skip undefined records', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue(undefined);

      await deleteRunData({ directoryPaths: ['/test/nonexistent'] });

      expect(mockRunDataService.deleteData).not.toHaveBeenCalled();
    });
  });

  describe('syncRunDataFiles', () => {
    it('should return early on non-linux platform', async () => {
      await syncRunDataFiles('/test/rundata.json');

      expect(mockExec).not.toHaveBeenCalled();
    });

    it('should return early when rundata.json does not exist', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(false);

      await syncRunDataFiles('/test/rundata.json');

      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should show noFilesToSync when rundata has no file paths', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ runtype: 'test' }));
      const vscode = await import('vscode');

      await syncRunDataFiles('/test/rundata.json');

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should sync files and show success when all files exist', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/source.json' }));
      const vscode = await import('vscode');

      await syncRunDataFiles('/test/rundata.json');

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should show partial warning when some files do not exist', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockImplementation((p: string) => p.endsWith('rundata.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/source.json', controlFlowFilePath: '/test/control.json' }));
      const vscode = await import('vscode');

      await syncRunDataFiles('/test/rundata.json');

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    it('should show error message when sync throws', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockImplementation((p: string) => {
        if (p.endsWith('rundata.json')) return true;
        throw new Error('fs error');
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/source.json' }));
      const vscode = await import('vscode');

      await syncRunDataFiles('/test/rundata.json');

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });
});
