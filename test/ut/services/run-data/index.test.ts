import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

const mockStoreInstance = {
  query: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  find: vi.fn(),
  onClear: vi.fn(),
  dispose: vi.fn(),
};

vi.mock('../../../../src/core/store', () => ({
  SqlStore: class MockSqlStore {
    constructor(..._args: any[]) {
      Object.assign(this, mockStoreInstance);
    }
  },
  defineAttributes: vi.fn((attrs: any) => attrs),
}));

const mockReadRunData = vi.fn();
const mockReadRunDataList = vi.fn().mockResolvedValue([]);
const mockFindVerifyDir = vi.fn();
const mockFindVerifySubDir = vi.fn();

vi.mock('../../../../src/services/run-data/utils/scan-run-data', () => ({
  readRunData: (...args: any[]) => mockReadRunData(...args),
  readRunDataList: (...args: any[]) => mockReadRunDataList(...args),
  RunDataDir: {},
  findVerifyDir: (...args: any[]) => mockFindVerifyDir(...args),
  findVerifySubDir: (...args: any[]) => mockFindVerifySubDir(...args),
  COMPUTE_GRAPH_PATH_LEVER: 2,
}));

const mockGetOutputDirectory = vi.fn();
vi.mock('../../../../src/services/run-data/utils/scan-output', () => ({
  getOutputDirectory: (...args: any[]) => mockGetOutputDirectory(...args),
}));

let lastResolverCallback: ((item: any) => Promise<any>) | undefined;
vi.mock('../../../../src/services/run-data/utils/async-resolving-list', () => ({
  AsyncListResolver: class MockAsyncListResolver {},
  AsyncListResolverImpl: class MockAsyncListResolverImpl {
    start = vi.fn();
    stop = vi.fn().mockResolvedValue([]);
    isResolving = vi.fn().mockReturnValue(false);
    waitFor = vi.fn().mockResolvedValue(undefined);
    constructor(callback: any) {
      lastResolverCallback = callback;
    }
  },
}));

const mockDeleteFile = vi.fn();
vi.mock('../../../../src/utils/file-system', () => ({
  deleteFile: (...args: any[]) => mockDeleteFile(...args),
}));

const mockGetControlFlowStore = vi.fn().mockReturnValue({
  delete: vi.fn(),
});
vi.mock('../../../../src/services/control-flow/store', () => ({
  getControlFlowStore: () => mockGetControlFlowStore(),
}));

const mockAccuracyGet = vi.fn().mockResolvedValue([]);
vi.mock('../../../../src/core/sqliteCache', () => ({
  SQLiteCache: {
    getInstance: () => ({ accuracyToolCompListGetByComputePath: mockAccuracyGet }),
  },
  AccuracyToolCompList: {},
}));

function makeQueryBuilder(execResults: any[] = [[]]) {
  const queue = [...execResults];
  return {
    filter: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    slice: vi.fn().mockReturnThis(),
    exec: vi.fn().mockImplementation(() => Promise.resolve(queue.length > 1 ? queue.shift() : queue[0])),
    count: vi.fn().mockResolvedValue(0),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('run-data/index', () => {
  let RunDataService: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    lastResolverCallback = undefined;
    mockAccuracyGet.mockResolvedValue([]);

    mockStoreInstance.query.mockReturnValue(makeQueryBuilder());
    mockStoreInstance.find.mockResolvedValue(undefined);
    mockStoreInstance.onClear.mockImplementation(() => {});
    mockReadRunDataList.mockResolvedValue([]);

    const mod = await import('../../../../src/services/run-data');
    RunDataService = mod.RunDataService;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('RunDataService', () => {
    it('should create service with name runData', () => {
      const service = new RunDataService();
      expect(service.name).toBe('runData');
      service.dispose();
    });

    it('should call scanDirectory on construction', () => {
      const service = new RunDataService();
      expect(mockReadRunDataList).toHaveBeenCalled();
      service.dispose();
    });

    describe('query', () => {
      it('should return filtered query result', () => {
        const service = new RunDataService();
        const result = service.query();
        expect(result).toBeDefined();
        service.dispose();
      });
    });

    describe('delete', () => {
      it('should call store.delete', () => {
        const service = new RunDataService();
        const output = { title: 'test', directoryPath: '/test' };
        service.delete(output);
        expect(mockStoreInstance.delete).toHaveBeenCalledWith(output);
        service.dispose();
      });
    });

    describe('deleteData', () => {
      it('should delete records and files', async () => {
        const service = new RunDataService();
        const outputList = [
          { title: 'test', directoryPath: '/test/run1', controlFlowFilePath: '/test/cf.json' },
        ];
        await service.deleteData(outputList);
        expect(mockStoreInstance.delete).toHaveBeenCalled();
        expect(mockDeleteFile).toHaveBeenCalled();
        service.dispose();
      });

      it('should also delete compute graph directory files', async () => {
        const service = new RunDataService();
        const outputList = [{ title: 'test', directoryPath: '/test/run1', computeGraphDirPath: '/test/graph' }];
        await service.deleteData(outputList);
        expect(mockDeleteFile).toHaveBeenCalledTimes(2);
        service.dispose();
      });
    });

    describe('getOutputRecord', () => {
      it('should return record from store when found', async () => {
        const mockRecord = { title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: false };
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[mockRecord]]));

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');
        expect(result).toBeDefined();
        service.dispose();
      });

      it('should return record from file when not in store', async () => {
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[]]));
        mockReadRunData.mockResolvedValue({ title: 'run1', hasOpeCheck: false, hasTaskCheck: false });

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');
        expect(result).toBeDefined();
        service.dispose();
      });

      it('should return undefined when not found anywhere', async () => {
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[]]));
        mockReadRunData.mockResolvedValue(null);

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');
        expect(result).toBeUndefined();
        service.dispose();
      });

      it('should attach opeCheckDirPath when ope check list is non-empty', async () => {
        const mockRecord = { title: 'run1', directoryPath: '/test/run1', hasOpeCheck: true, hasTaskCheck: false, flowVerifyPath: '/test/verify' };
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[mockRecord]]));
        mockAccuracyGet.mockResolvedValue([{ cmp: 'cmp1' }]);

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');

        expect(mockAccuracyGet).toHaveBeenCalledWith('/test/verify_opcheck');
        expect(result.opeCheckDirPath).toEqual([{ cmp: 'cmp1' }]);
        service.dispose();
      });

      it('should attach taskCheckDirPath when task check list is non-empty', async () => {
        const mockRecord = { title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: true, flowVerifyPath: '/test/verify' };
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[mockRecord]]));
        mockAccuracyGet.mockResolvedValue([{ task: 'task1' }]);

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');

        expect(mockAccuracyGet).toHaveBeenCalledWith('/test/verify_taskcheck');
        expect(result.taskCheckDirPath).toEqual([{ task: 'task1' }]);
        service.dispose();
      });

      it('should fall back to findVerifySubDir when flowVerifyPath missing', async () => {
        const mockRecord = { title: 'run1', directoryPath: '/test/run1', hasOpeCheck: true, hasTaskCheck: false, computeGraphDirPath: '/test/graph' };
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[mockRecord]]));
        mockFindVerifyDir.mockReturnValue('/test/graph');
        mockFindVerifySubDir.mockResolvedValue('/test/graph/verify');
        mockAccuracyGet.mockResolvedValue([]);

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');

        expect(mockFindVerifyDir).toHaveBeenCalledWith('/test/graph', 2);
        expect(mockFindVerifySubDir).toHaveBeenCalledWith('/test/graph');
        expect(mockAccuracyGet).toHaveBeenCalledWith('/test/graph/verify_opcheck');
        expect(result.opeCheckDirPath).toBeUndefined();
        service.dispose();
      });
    });

    describe('refreshOutputRecord', () => {
      it('re-reads record from file and updates cache', async () => {
        mockReadRunData.mockResolvedValue({ title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: false });

        const service = new RunDataService();
        const result = await service.refreshOutputRecord('/test/run1');

        expect(mockReadRunData).toHaveBeenCalled();
        expect(mockStoreInstance.set).toHaveBeenCalledWith({ noDirectoryTree: false, title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: false });
        expect(result).toBeDefined();
        service.dispose();
      });

      it('deletes cached record when rundata file is invalid', async () => {
        mockReadRunData.mockResolvedValue(null);
        const builder = makeQueryBuilder([[]]);
        mockStoreInstance.query.mockReturnValue(builder);

        const service = new RunDataService();
        const result = await service.refreshOutputRecord('/test/run1');

        expect(result).toBeUndefined();
        expect(builder.filter).toHaveBeenCalledWith({ directoryPath: '/test/run1' });
        expect(builder.delete).toHaveBeenCalled();
        service.dispose();
      });
    });

    describe('getOutputDetail', () => {
      it('should return undefined when record not found', async () => {
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[]]));
        mockReadRunData.mockResolvedValue(null);

        const service = new RunDataService();
        const result = await service.getOutputDetail('/test/run1');
        expect(result).toBeUndefined();
        service.dispose();
      });

      it('renames cached directory tree children with i18n names', async () => {
        const mockRecord = {
          title: 'run1',
          directoryPath: '/test/run1',
          hasOpeCheck: false,
          hasTaskCheck: false,
          directoryTree: {
            children: [
              { type: 'file', fileType: 'controlFlow', name: 'old' },
              { type: 'file', fileType: 'swimlaneGraph', name: 'old' },
              { type: 'dir', directoryType: 'compute', name: 'old', children: [] },
            ],
          },
        };
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[mockRecord]]));

        const service = new RunDataService();
        const result = await service.getOutputDetail('/test/run1');

        expect(result).toBeDefined();
        expect(result.directoryTree.children[0].name).toBe('PyPTOToolkit.workspace.controlFlowName');
        expect(result.directoryTree.children[1].name).toBe('PyPTOToolkit.workspace.swimlaneGraphName');
        expect(result.directoryTree.children[2].name).toBe('PyPTOToolkit.workspace.computeGraphName');
        expect(mockGetOutputDirectory).not.toHaveBeenCalled();
        service.dispose();
      });

      it('scans output directory and caches detail when not loaded', async () => {
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[]]));
        mockReadRunData.mockResolvedValue({ title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: false });
        const tree = { type: 'dir', children: [] };
        mockGetOutputDirectory.mockResolvedValue(tree);
        mockStoreInstance.find.mockResolvedValue(true);

        const service = new RunDataService();
        const result = await service.getOutputDetail('/test/run1');

        expect(mockGetOutputDirectory).toHaveBeenCalled();
        expect(mockStoreInstance.set).toHaveBeenCalledWith(expect.objectContaining({ noDirectoryTree: false, directoryTree: tree }));
        expect(result).toMatchObject({ noDirectoryTree: false, directoryTree: tree });
        service.dispose();
      });

      it('does not write cache when record is not in store', async () => {
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[]]));
        mockReadRunData.mockResolvedValue({ title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: false });
        mockGetOutputDirectory.mockResolvedValue({ type: 'dir', children: [] });
        mockStoreInstance.find.mockResolvedValue(false);

        const service = new RunDataService();
        const result = await service.getOutputDetail('/test/run1');

        expect(mockStoreInstance.set).not.toHaveBeenCalled();
        expect(result).toBeDefined();
        service.dispose();
      });

      it('returns undefined when output scan yields nothing', async () => {
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[]]));
        mockReadRunData.mockResolvedValue({ title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: false });
        mockGetOutputDirectory.mockResolvedValue(null);

        const service = new RunDataService();
        const result = await service.getOutputDetail('/test/run1');

        expect(result).toBeUndefined();
        service.dispose();
      });
    });

    describe('scanDirectory', () => {
      it('should scan run data directory', async () => {
        const service = new RunDataService();
        await service.scanDirectory();
        expect(mockReadRunDataList).toHaveBeenCalled();
        service.dispose();
      });

      it('processes new directory when executeTime is newer than latest', async () => {
        mockReadRunDataList.mockResolvedValue([{ dirname: 'run1', executeTime: '2024-07-01' }]);
        mockStoreInstance.query.mockReturnValue(makeQueryBuilder([[]]));
        mockReadRunData.mockResolvedValue({ title: 'run1', hasOpeCheck: false, hasTaskCheck: false });

        const service = new RunDataService();
        await vi.waitFor(() => expect(lastResolverCallback).toBeDefined());

        const result = await lastResolverCallback!({ dirname: 'run1', executeTime: '2024-07-01' });

        expect(result).toEqual({ data: null });
        expect(mockReadRunData).toHaveBeenCalled();
        expect(mockStoreInstance.set).toHaveBeenCalledWith({ noDirectoryTree: false, title: 'run1', hasOpeCheck: false, hasTaskCheck: false });
        service.dispose();
      });

      it('delays rescan of old directories via 5s timer', async () => {
        vi.useFakeTimers();
        mockReadRunDataList.mockResolvedValue([{ dirname: 'old1', executeTime: '2024-01-01' }]);
        const builder = makeQueryBuilder([[{ executeTime: '2024-06-01' }], []]);
        mockStoreInstance.query.mockReturnValue(builder);
        mockReadRunData.mockResolvedValue({ title: 'old1', hasOpeCheck: false, hasTaskCheck: false });

        const service = new RunDataService();
        await vi.advanceTimersByTimeAsync(0);
        expect(lastResolverCallback).toBeDefined();

        const result = await lastResolverCallback!({ dirname: 'old1', executeTime: '2024-01-01' });

        expect(result).toEqual({ skip: true });
        expect(mockReadRunData).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(5000);

        expect(mockReadRunData).toHaveBeenCalled();
        expect(mockStoreInstance.set).toHaveBeenCalled();
        service.dispose();
      });

      it('updates or deletes existing records when delayed rescan runs', async () => {
        vi.useFakeTimers();
        mockReadRunDataList.mockResolvedValue([
          { dirname: 'd1', executeTime: '2024-01-01' },
          { dirname: 'd2', executeTime: '2024-01-01' },
        ]);
        const builder = makeQueryBuilder([
          [{ executeTime: '2024-06-01' }],
          [{ title: 'stored1', directoryPath: '/d1' }],
          [{ title: 'stored2', directoryPath: '/d2' }],
        ]);
        mockStoreInstance.query.mockReturnValue(builder);
        mockReadRunData.mockResolvedValueOnce({ title: 'fresh1', hasOpeCheck: false, hasTaskCheck: false }).mockResolvedValueOnce(null);

        const service = new RunDataService();
        await vi.advanceTimersByTimeAsync(0);

        await lastResolverCallback!({ dirname: 'd1', executeTime: '2024-01-01' });
        await vi.advanceTimersByTimeAsync(5000);

        expect(mockStoreInstance.set).toHaveBeenCalledWith({
          title: 'fresh1',
          directoryPath: '/d1',
          hasOpeCheck: false,
          hasTaskCheck: false,
        });
        expect(builder.delete).toHaveBeenCalled();
        service.dispose();
      });
    });

    describe('waitForScanning', () => {
      it('should resolve immediately when no listResolver', async () => {
        const service = new RunDataService();
        service.listResolver = undefined;
        await service.waitForScanning();
        service.dispose();
      });

      it('waits via listResolver when available', async () => {
        const service = new RunDataService();
        await vi.waitFor(() => expect(service.listResolver).toBeDefined());

        await service.waitForScanning(5);

        expect(service.listResolver.waitFor).toHaveBeenCalledWith(5);
        service.dispose();
      });
    });
  });
});
