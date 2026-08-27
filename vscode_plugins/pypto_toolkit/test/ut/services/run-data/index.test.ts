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

vi.mock('../../../../src/services/run-data/utils/async-resolving-list', () => ({
  AsyncListResolver: class MockAsyncListResolver {},
  AsyncListResolverImpl: class MockAsyncListResolverImpl {
    start = vi.fn();
    stop = vi.fn().mockResolvedValue([]);
    isResolving = vi.fn().mockReturnValue(false);
    waitFor = vi.fn().mockResolvedValue(undefined);
    constructor(..._args: any[]) {}
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

const mockSQLiteCache = {
  getInstance: vi.fn().mockReturnValue({
    accuracyToolCompListGetByComputePath: vi.fn().mockResolvedValue([]),
  }),
};
vi.mock('../../../../src/core/sqliteCache', () => ({
  SQLiteCache: mockSQLiteCache,
  AccuracyToolCompList: {},
}));

describe('run-data/index', () => {
  let RunDataService: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const mockQueryBuilder = {
      filter: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      slice: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn().mockResolvedValue(undefined),
    };
    mockStoreInstance.query.mockReturnValue(mockQueryBuilder);
    mockStoreInstance.find.mockResolvedValue(undefined);
    mockStoreInstance.onClear.mockImplementation(() => {});

    const mod = await import('../../../../src/services/run-data');
    RunDataService = mod.RunDataService;
  });

  afterEach(() => {
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
    });

    describe('getOutputRecord', () => {
      it('should return record from store when found', async () => {
        const mockRecord = { title: 'run1', directoryPath: '/test/run1', hasOpeCheck: false, hasTaskCheck: false };
        const mockQueryBuilder = {
          filter: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([mockRecord]),
          sort: vi.fn().mockReturnThis(),
          slice: vi.fn().mockReturnThis(),
          count: vi.fn().mockResolvedValue(0),
          delete: vi.fn(),
        };
        mockStoreInstance.query.mockReturnValue(mockQueryBuilder);

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');
        expect(result).toBeDefined();
        service.dispose();
      });

      it('should return record from file when not in store', async () => {
        const mockQueryBuilder = {
          filter: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([]),
          sort: vi.fn().mockReturnThis(),
          slice: vi.fn().mockReturnThis(),
          count: vi.fn().mockResolvedValue(0),
          delete: vi.fn(),
        };
        mockStoreInstance.query.mockReturnValue(mockQueryBuilder);
        mockReadRunData.mockResolvedValue({ title: 'run1', hasOpeCheck: false, hasTaskCheck: false });

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');
        expect(result).toBeDefined();
        service.dispose();
      });

      it('should return undefined when not found anywhere', async () => {
        const mockQueryBuilder = {
          filter: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([]),
          sort: vi.fn().mockReturnThis(),
          slice: vi.fn().mockReturnThis(),
          count: vi.fn().mockResolvedValue(0),
          delete: vi.fn(),
        };
        mockStoreInstance.query.mockReturnValue(mockQueryBuilder);
        mockReadRunData.mockResolvedValue(null);

        const service = new RunDataService();
        const result = await service.getOutputRecord('/test/run1');
        expect(result).toBeUndefined();
        service.dispose();
      });
    });

    describe('getOutputDetail', () => {
      it('should return undefined when record not found', async () => {
        const mockQueryBuilder = {
          filter: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([]),
          sort: vi.fn().mockReturnThis(),
          slice: vi.fn().mockReturnThis(),
          count: vi.fn().mockResolvedValue(0),
          delete: vi.fn(),
        };
        mockStoreInstance.query.mockReturnValue(mockQueryBuilder);
        mockReadRunData.mockResolvedValue(null);

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
    });

    describe('waitForScanning', () => {
      it('should resolve immediately when no listResolver', async () => {
        const service = new RunDataService();
        service.listResolver = undefined;
        await service.waitForScanning();
        service.dispose();
      });
    });
  });
});
