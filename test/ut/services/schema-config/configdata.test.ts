import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { readFwkData, writeFileData, getJsonFileList, delFile, CONFIG_FILE_NAME } from '../../../../src/services/schema-config/configdata';

describe('schema-config/configdata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CONFIG_FILE_NAME', () => {
    it('should be tile_fwk_config.json', () => {
      expect(CONFIG_FILE_NAME).toBe('tile_fwk_config.json');
    });
  });

  describe('readFwkData', () => {
    it('should read and parse JSON file', async () => {
      const mockData = { key: 'value' };
      vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
        Buffer.from(JSON.stringify(mockData), 'utf-8') as any
      );

      const result = await readFwkData(vscode.Uri.file('/test/config.json'));
      expect(result).toEqual(mockData);
    });

    it('should show error message on failure', async () => {
      vi.mocked(vscode.workspace.fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await readFwkData(vscode.Uri.file('/test/config.json'));
      expect(result).toBe('');
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('writeFileData', () => {
    it('should write JSON data to file', async () => {
      vi.mocked(vscode.workspace.fs.writeFile).mockResolvedValue(undefined);

      await writeFileData(vscode.Uri.file('/test/config.json'), { key: 'value' });
      expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
    });

    it('should show error message on write failure', async () => {
      vi.mocked(vscode.workspace.fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      await writeFileData(vscode.Uri.file('/test/config.json'), { key: 'value' });
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('getJsonFileList', () => {
    it('should return list of JSON files sorted by number suffix', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ type: vscode.FileType.Directory } as any);
      vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
        ['config2.json', vscode.FileType.File],
        ['config1.json', vscode.FileType.File],
        ['config10.json', vscode.FileType.File],
        ['readme.txt', vscode.FileType.File],
      ] as any);

      const result = await getJsonFileList(vscode.Uri.file('/test/configs'));
      expect(result).toHaveLength(3);
      expect(result[0].configName).toBe('config1.json');
      expect(result[1].configName).toBe('config2.json');
      expect(result[2].configName).toBe('config10.json');
    });

    it('should return empty array when path is not a directory', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ type: vscode.FileType.File } as any);

      const result = await getJsonFileList(vscode.Uri.file('/test/file.json'));
      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Not found'));

      const result = await getJsonFileList(vscode.Uri.file('/test/configs'));
      expect(result).toEqual([]);
    });

    it('should handle files without number suffix', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ type: vscode.FileType.Directory } as any);
      vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([
        ['config.json', vscode.FileType.File],
        ['config1.json', vscode.FileType.File],
      ] as any);

      const result = await getJsonFileList(vscode.Uri.file('/test/configs'));
      expect(result).toHaveLength(2);
      expect(result[0].configName).toBe('config.json');
      expect(result[1].configName).toBe('config1.json');
    });
  });

  describe('delFile', () => {
    it('should delete file successfully', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ type: vscode.FileType.File } as any);
      vi.mocked(vscode.workspace.fs.delete).mockResolvedValue(undefined);

      await delFile(vscode.Uri.file('/test/config.json'));
      expect(vscode.workspace.fs.delete).toHaveBeenCalled();
    });

    it('should show error when target is not a file', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ type: vscode.FileType.Directory } as any);

      await delFile(vscode.Uri.file('/test/dir'));
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should show error on delete failure', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockResolvedValue({ type: vscode.FileType.File } as any);
      vi.mocked(vscode.workspace.fs.delete).mockRejectedValue(new Error('Permission denied'));

      await delFile(vscode.Uri.file('/test/config.json'));
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    it('should show error when stat fails', async () => {
      vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('Not found'));

      await delFile(vscode.Uri.file('/test/config.json'));
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('ConfigDataService', () => {
    it('should create service with name configData', async () => {
      vi.resetModules();
      vi.mocked(vscode.workspace).workspaceFolders = undefined;
      const { ConfigDataService } = await import('../../../../src/services/schema-config/configdata');
      const service = new ConfigDataService();
      expect(service.name).toBe('configData');
      service.dispose();
    });

    it('should return initial config data', async () => {
      vi.resetModules();
      vi.mocked(vscode.workspace).workspaceFolders = undefined;
      const { ConfigDataService } = await import('../../../../src/services/schema-config/configdata');
      const service = new ConfigDataService();
      const data = service.getConfigData();
      expect(data).toHaveProperty('files');
      expect(data).toHaveProperty('status');
      service.dispose();
    });

    it('should set status to completed when no workspace folders', async () => {
      vi.resetModules();
      vi.mocked(vscode.workspace).workspaceFolders = undefined;
      const { ConfigDataService } = await import('../../../../src/services/schema-config/configdata');
      const service = new ConfigDataService();
      await service.scanDirectory();
      const data = service.getConfigData();
      expect(data.status).toBe('completed');
      service.dispose();
    });

    it('should subscribe to config data updates', async () => {
      vi.resetModules();
      vi.mocked(vscode.workspace).workspaceFolders = undefined;
      const { ConfigDataService } = await import('../../../../src/services/schema-config/configdata');
      const service = new ConfigDataService();
      const callback = vi.fn();
      const disposable = service.onDidUpdateConfigData(callback);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        files: expect.any(Array),
        status: expect.any(String),
      }));
      disposable.dispose();
      service.dispose();
    });

    it('should reset status on dispose', async () => {
      vi.resetModules();
      vi.mocked(vscode.workspace).workspaceFolders = undefined;
      const { ConfigDataService } = await import('../../../../src/services/schema-config/configdata');
      const service = new ConfigDataService();
      service.dispose();
      expect(service.getConfigData().status).toBe('idle');
    });
  });
});
