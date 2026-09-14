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
import * as vscode from 'vscode';
import { getConfigsForRevise, updateConfigsFile, getCustomFileList, delCustomFile, getConfigsTemplate } from '../../../../src/services/schema-config/index';
import * as configdata from '../../../../src/services/schema-config/configdata';
import * as schemadata from '../../../../src/services/schema-config/schemadata';

// Mock configdata 模块
vi.mock('../../../../src/services/schema-config/configdata', () => ({
  readFwkData: vi.fn(),
  writeFileData: vi.fn(),
  getJsonFileList: vi.fn(),
  delFile: vi.fn(),
}));

// Mock schemadata 模块
vi.mock('../../../../src/services/schema-config/schemadata', () => ({
  readSchemaData: vi.fn(),
  formatSchemaToAttributeGroups: vi.fn(),
}));

describe('schema-config/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCustomFileList', () => {
    it('lists json files under the custom configurations directory', async () => {
      const files = [{ name: 'a.json' }, { name: 'b.json' }];
      vi.mocked(configdata.getJsonFileList).mockResolvedValue(files as any);

      const result = await getCustomFileList();

      expect(configdata.getJsonFileList).toHaveBeenCalledTimes(1);
      const requestedUri = vi.mocked(configdata.getJsonFileList).mock.calls[0][0] as { fsPath: string };
      expect(requestedUri.fsPath).toContain('config');
      expect(requestedUri.fsPath).toContain('customConfigurations');
      expect(result).toBe(files);
    });
  });

  describe('delCustomFile', () => {
    it('deletes the file at the given path', async () => {
      vi.mocked(configdata.delFile).mockResolvedValue(undefined);

      await delCustomFile('/home/user/.pypto/config/customConfigurations/a.json');

      expect(configdata.delFile).toHaveBeenCalledTimes(1);
      const deletedUri = vi.mocked(configdata.delFile).mock.calls[0][0] as { fsPath: string };
      expect(deletedUri.fsPath).toBe('/home/user/.pypto/config/customConfigurations/a.json');
    });
  });

  describe('getConfigsTemplate', () => {
    it('returns null when schema data is missing', async () => {
      vi.mocked(schemadata.readSchemaData).mockResolvedValue(null);

      await expect(getConfigsTemplate()).resolves.toBeNull();
    });

    it('builds ordered groups with translated labels and filters empty groups', async () => {
      vi.mocked(schemadata.readSchemaData).mockResolvedValue({ properties: {} } as any);
      vi.mocked(schemadata.formatSchemaToAttributeGroups).mockReturnValue({
        pass: [{ key: 'pass.mode', type: 'string', label: { zh: '模式', en: 'Mode' } }],
        debug: [{ key: 'debug.verbose', type: 'boolean', label: { zh: '详细', en: 'Verbose' } }],
        simulation: [],
        runtime: [],
        others: [{ key: 'misc', type: 'string', label: { zh: '其他', en: 'Other' } }],
      } as any);

      const result = await getConfigsTemplate();

      expect(result).toEqual([
        {
          key: 'pass',
          label: 'PyPTOToolkit.runConfig.group.pass',
          attributes: [{ key: 'pass.mode', type: 'string', label: { zh: '模式', en: 'Mode' } }],
        },
        {
          key: 'debug',
          label: 'PyPTOToolkit.runConfig.group.debug',
          attributes: [{ key: 'debug.verbose', type: 'boolean', label: { zh: '详细', en: 'Verbose' } }],
        },
        {
          key: 'others',
          label: 'PyPTOToolkit.runConfig.group.others',
          attributes: [{ key: 'misc', type: 'string', label: { zh: '其他', en: 'Other' } }],
        },
      ]);
    });

    it('returns empty array when all groups are empty', async () => {
      vi.mocked(schemadata.readSchemaData).mockResolvedValue({ properties: {} } as any);
      vi.mocked(schemadata.formatSchemaToAttributeGroups).mockReturnValue({
        pass: [],
        debug: [],
        simulation: [],
        runtime: [],
        others: [],
      } as any);

      await expect(getConfigsTemplate()).resolves.toEqual([]);
    });
  });

  describe('getConfigsForRevise', () => {
    it('should convert boolean values correctly', async () => {
      const mockConfigData = {
        'debug.enabled': true,
        'debug.disabled': false,
        'debug.one': 1,
        'debug.zero': 0,
        'debug.string_true': '1',
        'debug.string_false': '0',
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(mockConfigData);

      const schema = [
        {
          key: 'debug',
          label: 'Debug',
          attributes: [
            { key: 'debug.enabled', type: 'boolean' as const, label: { zh: '启用', en: 'Enabled' } },
            { key: 'debug.disabled', type: 'boolean' as const, label: { zh: '禁用', en: 'Disabled' } },
            { key: 'debug.one', type: 'boolean' as const, label: { zh: '一', en: 'One' } },
            { key: 'debug.zero', type: 'boolean' as const, label: { zh: '零', en: 'Zero' } },
            { key: 'debug.string_true', type: 'boolean' as const, label: { zh: '字符串真', en: 'String True' } },
            { key: 'debug.string_false', type: 'boolean' as const, label: { zh: '字符串假', en: 'String False' } },
          ],
        },
      ];

      const result = await getConfigsForRevise('/path/to/config.json', schema);

      expect(result['debug.enabled']).toBe(true);
      expect(result['debug.disabled']).toBe(false);
      expect(result['debug.one']).toBe(true);
      expect(result['debug.zero']).toBe(false);
      expect(result['debug.string_true']).toBe(true);
      expect(result['debug.string_false']).toBe(false);
    });

    it('should convert number values correctly', async () => {
      const mockConfigData = {
        'tile.size': 64,
        'tile.count': '128',
        'tile.float': '3.14',
        'tile.invalid': 'not a number',
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(mockConfigData);

      const schema = [
        {
          key: 'tile',
          label: 'Tile',
          attributes: [
            { key: 'tile.size', type: 'number' as const, label: { zh: '大小', en: 'Size' } },
            { key: 'tile.count', type: 'number' as const, label: { zh: '数量', en: 'Count' } },
            { key: 'tile.float', type: 'number' as const, label: { zh: '浮点', en: 'Float' } },
            { key: 'tile.invalid', type: 'number' as const, label: { zh: '无效', en: 'Invalid' } },
          ],
        },
      ];

      const result = await getConfigsForRevise('/path/to/config.json', schema);

      expect(result['tile.size']).toBe(64);
      expect(result['tile.count']).toBe(128);
      expect(result['tile.float']).toBe(3.14);
      expect(result['tile.invalid']).toBeUndefined();
    });

    it('should return string values as-is', async () => {
      const mockConfigData = {
        'runtime.mode': 'production',
        'runtime.path': '/path/to/file',
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(mockConfigData);

      const schema = [
        {
          key: 'runtime',
          label: 'Runtime',
          attributes: [
            { key: 'runtime.mode', type: 'string' as const, label: { zh: '模式', en: 'Mode' } },
            { key: 'runtime.path', type: 'string' as const, label: { zh: '路径', en: 'Path' } },
          ],
        },
      ];

      const result = await getConfigsForRevise('/path/to/config.json', schema);

      expect(result['runtime.mode']).toBe('production');
      expect(result['runtime.path']).toBe('/path/to/file');
    });

    it('should handle nested object paths', async () => {
      const mockConfigData = {
        pass: {
          optimize: {
            enabled: true,
            level: 3,
          },
        },
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(mockConfigData);

      const schema = [
        {
          key: 'pass',
          label: 'Pass',
          attributes: [
            { key: 'pass.optimize.enabled', type: 'boolean' as const, label: { zh: '启用', en: 'Enabled' } },
            { key: 'pass.optimize.level', type: 'number' as const, label: { zh: '级别', en: 'Level' } },
          ],
        },
      ];

      const result = await getConfigsForRevise('/path/to/config.json', schema);

      expect(result['pass.optimize.enabled']).toBe(true);
      expect(result['pass.optimize.level']).toBe(3);
    });

    it('should handle undefined values', async () => {
      const mockConfigData = {
        'debug.enabled': true,
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(mockConfigData);

      const schema = [
        {
          key: 'debug',
          label: 'Debug',
          attributes: [
            { key: 'debug.enabled', type: 'boolean' as const, label: { zh: '启用', en: 'Enabled' } },
            { key: 'debug.missing', type: 'boolean' as const, label: { zh: '缺失', en: 'Missing' } },
          ],
        },
      ];

      const result = await getConfigsForRevise('/path/to/config.json', schema);

      expect(result['debug.enabled']).toBe(true);
      expect(result['debug.missing']).toBeUndefined();
    });
  });

  describe('updateConfigsFile', () => {
    it('should merge form data with existing config', async () => {
      const existingConfig = {
        pass: {
          optimize: {
            enabled: false,
            level: 1,
          },
        },
        debug: {
          verbose: false,
        },
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(existingConfig);
      vi.mocked(configdata.writeFileData).mockResolvedValue(undefined);

      const formData = {
        'pass.optimize.enabled': true,
        'pass.optimize.level': 3,
        'debug.verbose': true,
      };

      const schema = [
        {
          key: 'pass',
          label: 'Pass',
          attributes: [
            { key: 'pass.optimize.enabled', type: 'boolean' as const, label: { zh: '启用', en: 'Enabled' } },
            { key: 'pass.optimize.level', type: 'number' as const, label: { zh: '级别', en: 'Level' } },
          ],
        },
        {
          key: 'debug',
          label: 'Debug',
          attributes: [
            { key: 'debug.verbose', type: 'boolean' as const, label: { zh: '详细', en: 'Verbose' } },
          ],
        },
      ];

      const result = await updateConfigsFile('/path/to/config.json', formData, schema);

      expect(result).toBe(true);
      expect(configdata.writeFileData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          pass: {
            optimize: {
              enabled: true,
              level: 3,
            },
          },
          debug: {
            verbose: true,
          },
        })
      );
    });

    it('should only update attributes defined in schema', async () => {
      const existingConfig = {
        pass: {
          optimize: {
            enabled: false,
            level: 1,
          },
        },
        other: {
          value: 'keep this',
        },
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(existingConfig);
      vi.mocked(configdata.writeFileData).mockResolvedValue(undefined);

      const formData = {
        'pass.optimize.enabled': true,
        'other.value': 'should not update',
      };

      const schema = [
        {
          key: 'pass',
          label: 'Pass',
          attributes: [
            { key: 'pass.optimize.enabled', type: 'boolean' as const, label: { zh: '启用', en: 'Enabled' } },
          ],
        },
      ];

      const result = await updateConfigsFile('/path/to/config.json', formData, schema);

      expect(result).toBe(true);
      expect(configdata.writeFileData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          pass: {
            optimize: {
              enabled: true,
              level: 1, // Should keep original value
            },
          },
          other: {
            value: 'keep this', // Should not be updated
          },
        })
      );
    });

    it('should return false when config file does not exist', async () => {
      vi.mocked(configdata.readFwkData).mockResolvedValue(null);

      const formData = {
        'pass.optimize.enabled': true,
      };

      const schema = [
        {
          key: 'pass',
          label: 'Pass',
          attributes: [
            { key: 'pass.optimize.enabled', type: 'boolean' as const, label: { zh: '启用', en: 'Enabled' } },
          ],
        },
      ];

      const result = await updateConfigsFile('/path/to/config.json', formData, schema);

      expect(result).toBe(false);
      expect(configdata.writeFileData).not.toHaveBeenCalled();
    });

    it('should handle errors and return false', async () => {
      vi.mocked(configdata.readFwkData).mockRejectedValue(new Error('Read error'));

      const formData = {
        'pass.optimize.enabled': true,
      };

      const schema = [
        {
          key: 'pass',
          label: 'Pass',
          attributes: [
            { key: 'pass.optimize.enabled', type: 'boolean' as const, label: { zh: '启用', en: 'Enabled' } },
          ],
        },
      ];

      // Mock vscode.window.showErrorMessage
      const mockShowErrorMessage = vi.fn();
      (vscode.window as any).showErrorMessage = mockShowErrorMessage;

      const result = await updateConfigsFile('/path/to/config.json', formData, schema);

      expect(result).toBe(false);
      expect(mockShowErrorMessage).toHaveBeenCalled();
    });

    it('should handle array values', async () => {
      const existingConfig = {
        pass: {
          filters: ['filter1', 'filter2'],
        },
      };

      vi.mocked(configdata.readFwkData).mockResolvedValue(existingConfig);
      vi.mocked(configdata.writeFileData).mockResolvedValue(undefined);

      const formData = {
        'pass.filters': ['filter3', 'filter4', 'filter5'],
      };

      const schema = [
        {
          key: 'pass',
          label: 'Pass',
          attributes: [
            { key: 'pass.filters', type: 'array:string' as const, label: { zh: '过滤器', en: 'Filters' } },
          ],
        },
      ];

      const result = await updateConfigsFile('/path/to/config.json', formData, schema);

      expect(result).toBe(true);
      expect(configdata.writeFileData).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          pass: {
            filters: ['filter3', 'filter4', 'filter5'],
          },
        })
      );
    });
  });
});
