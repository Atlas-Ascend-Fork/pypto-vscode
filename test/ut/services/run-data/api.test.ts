import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  deleteData: vi.fn(),
};

vi.mock('../../../../src/services', () => ({
  useService: vi.fn((name: string) => {
    if (name === 'runData') return mockRunDataService;
    return null;
  }),
}));

import { getRunDataList, getOutputDetail, getRunDataBySwimlaneGraphPath, deleteRunData } from '../../../../src/services/run-data/api';

describe('run-data/api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  describe('getOutputDetail', () => {
    it('should return output detail', async () => {
      const mockDetail = { title: 'run1', directoryTree: { children: [] } };
      mockRunDataService.getOutputDetail.mockResolvedValue(mockDetail);

      const result = await getOutputDetail({ outputDirPath: '/test/run1' });

      expect(result.data).toBe(mockDetail);
    });

    it('should return null when detail is undefined', async () => {
      mockRunDataService.getOutputDetail.mockResolvedValue(undefined);

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
});
