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

import { getRunDataList, fetchRunDataDetail, getRunDataBySwimlaneGraphPath, deleteRunData, syncRunDataFiles } from '../../../../src/services/run-data/api';

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

    it('should sync and refresh first record when rundata has missing files on linux', async () => {
      mockPlatform.mockReturnValue('linux');
      // rundata.json 存在，但其中声明的文件缺失
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/run1/source.json' }));
      const noFileRecord = { title: 'run1', directoryPath: '/test/run1', directoryTree: { children: [] } };
      const refreshedRecord = { title: 'run1', directoryPath: '/test/run1', sourceFilePath: '/test/run1/source.json', directoryTree: { children: [] } };
      mockQueryResult.exec.mockResolvedValue([noFileRecord]);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(refreshedRecord);

      await getRunDataList({ page: 1, forceReloadFromFiles: true });

      expect(mockRunDataService.refreshOutputRecord).toHaveBeenCalledWith('/test/run1');
    });

    it('syncs partial-missing latest record on linux refresh', async () => {
      mockPlatform.mockReturnValue('linux');
      // 最新记录已有部分本地数据，但 rundata.json 仍有缺失路径 → 刷新时同步补齐
      const partialRecord = { title: 'run1', directoryPath: '/test/run1', controlFlowFilePath: '/local/program.json', directoryTree: { children: [] } };
      mockQueryResult.exec.mockResolvedValue([partialRecord]);
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json') || String(p).endsWith('program.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ pto_src_file: '/remote/source.py', program_file: '/local/program.json' }));

      await getRunDataList({ page: 1, forceReloadFromFiles: true });

      expect(mockExec).toHaveBeenCalled();
      expect(mockRunDataService.refreshOutputRecord).toHaveBeenCalledWith('/test/run1');
    });

    it('does not sync or re-read latest record on windows refresh', async () => {
      const partialRecord = { title: 'run1', directoryPath: '/test/run1', controlFlowFilePath: '/local/program.json', directoryTree: { children: [] } };
      mockQueryResult.exec.mockResolvedValue([partialRecord]);
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json') || String(p).endsWith('program.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ pto_src_file: '/remote/source.py', program_file: '/local/program.json' }));

      await getRunDataList({ page: 1, forceReloadFromFiles: true });

      // Windows：刷新列表完全不触发同步与重读
      expect(mockExec).not.toHaveBeenCalled();
      expect(mockRunDataService.refreshOutputRecord).not.toHaveBeenCalled();
    });
  });

  describe('fetchRunDataDetail', () => {
    it('should return cached detail when rundata.json is absent', async () => {
      const mockRecord = { title: 'run1', sourceFilePath: '/test/run1/source.json' };
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputRecord.mockResolvedValue(mockRecord);
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);

      const result = await fetchRunDataDetail({ outputDirPath: '/test/run1' });

      expect(mockRunDataService.refreshOutputRecord).not.toHaveBeenCalled();
      expect(result.data).toBe(mockDetail);
    });

    it('opens with partial data when some rundata paths are remote-only (windows regression)', async () => {
      // 回归场景：pto_src_file 为远端源码路径（本地不存在），但控制流文件已同步到本地
      // 旧逻辑（rundata.json 原始路径判断）会误报"未找到对应数据文件"，应按记录字段判断
      const mockRecord = { title: 'run1', controlFlowFilePath: '/local/program.json' };
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputRecord.mockResolvedValue(mockRecord);
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json') || String(p).endsWith('program.json'));
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ pto_src_file: '/remote/source.py', program_file: '/local/program.json' }),
      );

      const result = await fetchRunDataDetail({ outputDirPath: '/test/run1' });

      expect(mockExec).not.toHaveBeenCalled();
      expect(mockRunDataService.refreshOutputRecord).not.toHaveBeenCalled();
      expect(result.data).toBe(mockDetail);
    });

    it('syncs missing files on linux but opens with local data even when sync cannot complete', async () => {
      // Linux：部分数据本地可用 + 部分路径缺失 → 先尝试同步；同步后文件仍未到位 → 仍按本地已有文件展示
      mockPlatform.mockReturnValue('linux');
      const partialRecord = { title: 'run1', controlFlowFilePath: '/local/program.json' };
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputRecord.mockResolvedValue(partialRecord);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(partialRecord);
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json') || String(p).endsWith('program.json'));
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ pto_src_file: '/remote/source.py', program_file: '/local/program.json' }),
      );

      const result = await fetchRunDataDetail({ outputDirPath: '/test/run1' });

      expect(mockExec).toHaveBeenCalled();
      expect(mockRunDataService.refreshOutputRecord).toHaveBeenCalledWith('/test/run1');
      expect(result.data).toBe(mockDetail);
    });

    it('should sync missing files on linux, refresh and return detail', async () => {
      mockPlatform.mockReturnValue('linux');
      let filesPresent = false;
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json') || filesPresent);
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/run-sync/source.json' }));
      mockExec.mockImplementation((cmd: string, ...rest: any[]) => {
        if (String(cmd).includes('remote_tool.sh exec')) {
          filesPresent = true;
        }
        const cb = rest[rest.length - 1];
        if (typeof cb === 'function') cb(null, '', '');
      });
      const mockRecord = { title: 'run1' };
      const refreshedRecord = { title: 'run1', sourceFilePath: '/test/run-sync/source.json' };
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputRecord.mockResolvedValue(mockRecord);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(refreshedRecord);
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);

      const result = await fetchRunDataDetail({ outputDirPath: '/test/run-sync' });

      expect(mockExec).toHaveBeenCalled();
      expect(mockRunDataService.refreshOutputRecord).toHaveBeenCalledWith('/test/run-sync');
      expect(result.data).toBe(mockDetail);
    });

    it('should re-read and return detail when cache is stale but files now exist (windows)', async () => {
      // 缓存记录无数据文件，但文件现已存在（如手动拷贝到位）→ 强制重读后应正常打开
      const staleRecord = { title: 'run1' };
      const refreshedRecord = { title: 'run1', sourceFilePath: '/local/now-exists.json' };
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputRecord.mockResolvedValue(staleRecord);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(refreshedRecord);
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/local/now-exists.json' }));

      const result = await fetchRunDataDetail({ outputDirPath: '/test/run-stale' });

      expect(mockRunDataService.refreshOutputRecord).toHaveBeenCalledWith('/test/run-stale');
      expect(result.data).toBe(mockDetail);
    });

    it('should return null with filesNotFound when no data files exist on windows without any sync attempt', async () => {
      const mockRecord = { title: 'run1' };
      mockRunDataService.getOutputRecord.mockResolvedValue(mockRecord);
      mockRunDataService.refreshOutputRecord.mockResolvedValue(mockRecord);
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/run-miss/source.json' }));

      const result = await fetchRunDataDetail({ outputDirPath: '/test/run-miss' });

      // Windows 完全不涉及同步：连 remote_tool.sh 环境探测都不应执行
      expect(mockExec).not.toHaveBeenCalled();
      expect(result.data).toBeNull();
      expect(vi.mocked(await import('vscode')).window.showWarningMessage).toHaveBeenCalled();
    });

    it('should return null when record is undefined and no rundata.json exists', async () => {
      mockRunDataService.getOutputRecord.mockResolvedValue(undefined);
      mockRunDataService.getOutputDetail.mockResolvedValue(undefined);

      const result = await fetchRunDataDetail({ outputDirPath: '/test/run-none' });

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
      const result = await syncRunDataFiles('/test/rundata.json');

      expect(result).toEqual({ allSynced: false });
      expect(mockExec).not.toHaveBeenCalled();
    });

    it('should return early when rundata.json does not exist', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(false);

      const result = await syncRunDataFiles('/test/rundata.json');

      expect(result).toEqual({ allSynced: false });
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it('should show noFilesToSync when rundata has no file paths', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ runtype: 'test' }));
      const vscode = await import('vscode');

      const result = await syncRunDataFiles('/test/rundata.json');

      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      expect(result).toEqual({ allSynced: false });
    });

    it('should skip syncing and report allSynced when all files already exist', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/source.json' }));

      const result = await syncRunDataFiles('/test/rundata.json');

      const syncCommands = mockExec.mock.calls.filter(([cmd]: [string]) => String(cmd).includes('--pull-dir'));
      expect(syncCommands).toHaveLength(0);
      expect(result).toEqual({ allSynced: true });
    });

    it('should sync missing files and show success when sync completes', async () => {
      mockPlatform.mockReturnValue('linux');
      let filesPresent = false;
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json') || filesPresent);
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/source.json' }));
      mockExec.mockImplementation((cmd: string, ...rest: any[]) => {
        if (String(cmd).includes('remote_tool.sh exec')) {
          filesPresent = true;
        }
        const cb = rest[rest.length - 1];
        if (typeof cb === 'function') cb(null, '', '');
      });
      const vscode = await import('vscode');

      const result = await syncRunDataFiles('/test/rundata.json');

      const syncCommands = mockExec.mock.calls.filter(([cmd]: [string]) => String(cmd).includes('--pull-dir'));
      expect(syncCommands).toHaveLength(1);
      expect(syncCommands[0][0]).toContain('/test/source.json');
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      expect(result).toEqual({ allSynced: true });
    });

    it('should classify folder paths without extension and include them in the sync command', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ computeGraphDirPath: '/data/graph_folder' }));

      await syncRunDataFiles('/test/rundata.json');

      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('/data/graph_folder'),
        expect.anything(),
        expect.any(Function),
      );
    });

    it('should show partial warning when only some missing files are synced', async () => {
      mockPlatform.mockReturnValue('linux');
      let fileASynced = false;
      mockExistsSync.mockImplementation((p: string) => {
        if (String(p).endsWith('rundata.json')) return true;
        return String(p).endsWith('a.json') && fileASynced;
      });
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/a.json', controlFlowFilePath: '/test/b.json' }));
      mockExec.mockImplementation((cmd: string, ...rest: any[]) => {
        if (String(cmd).includes('remote_tool.sh exec')) {
          fileASynced = true;
        }
        const cb = rest[rest.length - 1];
        if (typeof cb === 'function') cb(null, '', '');
      });
      const vscode = await import('vscode');

      const result = await syncRunDataFiles('/test/rundata.json');

      expect(vscode.window.showWarningMessage).toHaveBeenCalled();
      expect(result).toEqual({ allSynced: false });
    });

    it('should show error message when all missing file syncs fail', async () => {
      mockPlatform.mockReturnValue('linux');
      mockExistsSync.mockImplementation((p: string) => String(p).endsWith('rundata.json'));
      mockReadFileSync.mockReturnValue(JSON.stringify({ sourceFilePath: '/test/a.json', controlFlowFilePath: '/test/b.json' }));
      const vscode = await import('vscode');

      const result = await syncRunDataFiles('/test/rundata.json');

      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      expect(result).toEqual({ allSynced: false });
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
