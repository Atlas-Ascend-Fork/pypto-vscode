/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
