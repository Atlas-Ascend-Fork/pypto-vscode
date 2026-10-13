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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

describe('extension-config', () => {
  let ExtensionConfig: any;
  let BasicService: any;

  beforeEach(async () => {
    // 重置模块以清理 BasicService 的单例注册
    vi.resetModules();
    
    // 重新导入模块
    const extensionConfigModule = await import('../../../src/services/extension-config');
    const basicServiceModule = await import('../../../src/services/basic-service');
    
    ExtensionConfig = extensionConfigModule.ExtensionConfig;
    BasicService = basicServiceModule.BasicService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ExtensionConfig', () => {
    it('should create ExtensionConfig with context', () => {
      const mockContext = {
        extensionUri: vscode.Uri.file('/test/extension'),
        extensionPath: '/test/extension',
      } as vscode.ExtensionContext;

      const config = new ExtensionConfig(mockContext);
      
      expect(config).toBeInstanceOf(ExtensionConfig);
      expect(config).toBeInstanceOf(BasicService);
      
      config.dispose();
    });

    it('should return extensionUri from context', () => {
      const mockUri = vscode.Uri.file('/test/extension/path');
      const mockContext = {
        extensionUri: mockUri,
        extensionPath: '/test/extension/path',
      } as vscode.ExtensionContext;

      const config = new ExtensionConfig(mockContext);
      
      expect(config.extensionUri).toBe(mockUri);
      
      config.dispose();
    });

    it('should return extensionPath from context', () => {
      const mockContext = {
        extensionUri: vscode.Uri.file('/test/extension'),
        extensionPath: '/test/extension/path',
      } as vscode.ExtensionContext;

      const config = new ExtensionConfig(mockContext);
      
      expect(config.extensionPath).toBe('/test/extension/path');
      
      config.dispose();
    });

    it('should have name "extension" as BasicService', () => {
      const mockContext = {
        extensionUri: vscode.Uri.file('/test/extension'),
        extensionPath: '/test/extension',
      } as vscode.ExtensionContext;

      const config = new ExtensionConfig(mockContext);
      
      expect(config.name).toBe('extension');
      
      config.dispose();
    });

    it('should throw error when creating duplicate ExtensionConfig', () => {
      const mockContext = {
        extensionUri: vscode.Uri.file('/test/extension'),
        extensionPath: '/test/extension',
      } as vscode.ExtensionContext;

      const config1 = new ExtensionConfig(mockContext);
      
      expect(() => {
        new ExtensionConfig(mockContext);
      }).toThrow('进程中只允许实例化一次service，extension 已存在');
      
      config1.dispose();
    });

    it('should be disposable', () => {
      const mockContext = {
        extensionUri: vscode.Uri.file('/test/extension'),
        extensionPath: '/test/extension',
      } as vscode.ExtensionContext;

      const config = new ExtensionConfig(mockContext);
      
      expect(() => config.dispose()).not.toThrow();
    });

    it('should manage disposables from BasicService', () => {
      const mockContext = {
        extensionUri: vscode.Uri.file('/test/extension'),
        extensionPath: '/test/extension',
      } as vscode.ExtensionContext;

      const config = new ExtensionConfig(mockContext);
      const mockDisposable = { dispose: vi.fn() };
      
      (config as any)._disposables.push(mockDisposable);
      
      config.dispose();
      
      expect(mockDisposable.dispose).toHaveBeenCalled();
    });
  });
});
