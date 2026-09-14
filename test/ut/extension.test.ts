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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

const mockSQLiteCacheInstance = {
  comGraphDataDelete: vi.fn(),
  deleteForCommand: vi.fn(),
  clearCache: vi.fn(),
};

const {
  mockGlobalConfig,
  mockSQLiteCache,
  mockInitStores,
  mockClearAllStores,
  mockStartAllServices,
  mockCloseAllServices,
  mockInitRequestServer,
  mockInitView,
  mockLoadMaterialColorUtilities,
  mockOpenPyPTOWelcome,
  preparedInstances,
} = vi.hoisted(() => {
  const preparedInstances: unknown[] = [];
  return {
    mockGlobalConfig: { IS_USE_DB: true },
    mockSQLiteCache: {
      init: vi.fn().mockResolvedValue(undefined),
      getInstance: vi.fn(),
    },
    mockInitStores: vi.fn(),
    mockClearAllStores: vi.fn().mockResolvedValue(undefined),
    mockStartAllServices: vi.fn(),
    mockCloseAllServices: vi.fn(),
    mockInitRequestServer: vi.fn(() => ({ addWebview: vi.fn() })),
    mockInitView: vi.fn(() => ({ open: vi.fn(), closeAll: vi.fn() })),
    mockLoadMaterialColorUtilities: vi.fn().mockResolvedValue(null),
    mockOpenPyPTOWelcome: vi.fn(),
    preparedInstances,
  };
});

mockSQLiteCache.getInstance.mockReturnValue(mockSQLiteCacheInstance);

// 注意：extension.ts 通过 require('i18next') 获取实例，vitest 的 vi.mock 无法拦截
// require 调用（rolldown 环境下 require 走原生解析），因此 i18next.init/t 为真实调用。
// 相关断言已与 t 的返回值解耦（见 showWarningMessage 的按钮参数回传法）。

vi.mock('../../src/config/config', () => ({
  globalConfig: mockGlobalConfig,
}));

vi.mock('../../src/core/request-server', () => ({
  initRequestServer: mockInitRequestServer,
}));

vi.mock('../../src/core/sqliteCache', () => ({
  SQLiteCache: mockSQLiteCache,
}));

vi.mock('../../src/core/store', () => ({
  initStores: mockInitStores,
  clearAllStores: mockClearAllStores,
}));

vi.mock('../../src/services', () => ({
  startAllServices: mockStartAllServices,
  closeAllServices: mockCloseAllServices,
  serviceApis: {},
}));

vi.mock('../../src/view', () => ({
  initView: mockInitView,
}));

vi.mock('../../src/color-list', () => ({
  loadMaterialColorUtilities: mockLoadMaterialColorUtilities,
}));

vi.mock('../../src/view/SidebarViewProvider', () => ({
  SidebarViewProvider: class MockSidebarViewProvider {
    static viewType = 'pypto-results-sidebar';
  },
}));

vi.mock('../../src/services/tmp-view-opener', () => ({
  openPyPTOWelcome: mockOpenPyPTOWelcome,
}));

vi.mock('../../src/view/pyptoJitCodeLensProvider', () => ({
  PyptoJitCodeLensProvider: class MockPyptoJitCodeLensProvider {},
}));

vi.mock('../../src/services/pyptoJitService', () => ({
  PyptoJitService: {
    setDebugOptions: vi.fn(),
    unsetDebugOptions: vi.fn(),
    setAllDebugMode: vi.fn(),
    unsetAllDebugMode: vi.fn(),
  },
}));

vi.mock('../../src/services/welcome/sample', () => ({
  SampleManager: class MockSampleManager {
    prepared = false;
    prepare() {
      this.prepared = true;
      preparedInstances.push(this);
    }
  },
}));

vi.mock('../../src/command/registerCommand', () => ({
  RegisterCommand: class MockRegisterCommand {
    register = vi.fn();
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: { ...actual, existsSync: vi.fn().mockReturnValue(false), chmodSync: vi.fn() },
    existsSync: vi.fn().mockReturnValue(false),
    chmodSync: vi.fn(),
  };
});

import { activate, deactivate, extensionContext, sampleManager } from '../../src/extension';
import * as fs from 'fs';

function makeContext() {
  return {
    subscriptions: [] as { dispose(): void }[],
    globalState: {
      get: vi.fn().mockReturnValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    extensionPath: '/ext/pypto-toolkit',
  } as any;
}

function stubExtensionLookup(oldExt?: { isActive: boolean }, version = '2.0.21') {
  vi.mocked(vscode.extensions.getExtension).mockImplementation((id: string) => {
    if (id === 'hismartliteopen.pypto-toolkit') {
      return oldExt as any;
    }
    if (id === 'cann-pub.pypto-toolkit') {
      return { packageJSON: { version } } as any;
    }
    return undefined;
  });
}

async function runActivate(context = makeContext(), useFakeTimers = true) {
  if (useFakeTimers) {
    vi.useFakeTimers();
  }
  await activate(context);
  if (useFakeTimers) {
    await vi.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
    await Promise.resolve();
  }
  return context;
}

function getCommandHandler(id: string) {
  const call = vi.mocked(vscode.commands.registerCommand).mock.calls.find(([cmd]) => cmd === id);
  return call![1] as (...args: unknown[]) => any;
}

describe('extension.ts', () => {
  let context: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.chmodSync).mockImplementation(() => {});
    mockGlobalConfig.IS_USE_DB = true;
    stubExtensionLookup();
    context = makeContext();
  });

  afterEach(() => {
    vi.useRealTimers();
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    if (originalPlatformDescriptor && originalPlatformDescriptor.value !== 'win32') {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    }
  });

  describe('activate smoke', () => {
    it('orchestrates startup with DB enabled', async () => {
      await runActivate(context);

      expect(mockSQLiteCache.init).toHaveBeenCalledWith(context);
      expect(mockInitStores).toHaveBeenCalledWith(context);
      expect(mockStartAllServices).toHaveBeenCalledWith(context);
      expect(mockInitView).toHaveBeenCalled();
      expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith(
        'pypto-results-sidebar',
        expect.anything(),
        { webviewOptions: { retainContextWhenHidden: true } },
      );
      expect(vscode.languages.registerCodeLensProvider).toHaveBeenCalledWith({ language: 'python' }, expect.anything());
      expect(context.subscriptions.length).toBeGreaterThan(0);
      expect(extensionContext).toBe(context);
      expect((sampleManager as unknown as { prepared: boolean }).prepared).toBe(true);
      expect(mockLoadMaterialColorUtilities).toHaveBeenCalled();
    });

    it('skips initDB when database is disabled', async () => {
      mockGlobalConfig.IS_USE_DB = false;

      await runActivate(context);

      expect(mockSQLiteCache.init).not.toHaveBeenCalled();
      expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();
      expect(mockStartAllServices).toHaveBeenCalled();
    });

    it('registers welcome guide and pyptoJit commands', async () => {
      await runActivate(context);

      expect(getCommandHandler('PyPTO.Open.OpenWelcomeGuide')).toBeTypeOf('function');
      expect(getCommandHandler('pypto.setDebugOptions')).toBeTypeOf('function');
      expect(getCommandHandler('pypto.unsetAllDebugMode')).toBeTypeOf('function');

      await getCommandHandler('PyPTO.Open.OpenWelcomeGuide')();
      expect(mockOpenPyPTOWelcome).toHaveBeenCalled();
    });

    it('dispatches pyptoJit commands to PyptoJitService', async () => {
      await runActivate(context);
      const { PyptoJitService } = await import('../../src/services/pyptoJitService');
      const uri = vscode.Uri.file('/test/file.py');

      await getCommandHandler('pypto.setDebugOptions')(uri, 10);
      await getCommandHandler('pypto.unsetDebugOptions')(uri, 11);
      getCommandHandler('pypto.setAllDebugMode')(uri);
      getCommandHandler('pypto.unsetAllDebugMode')(uri);

      expect(PyptoJitService.setDebugOptions).toHaveBeenCalledWith(uri, 10);
      expect(PyptoJitService.unsetDebugOptions).toHaveBeenCalledWith(uri, 11);
      expect(PyptoJitService.setAllDebugMode).toHaveBeenCalledWith(uri);
      expect(PyptoJitService.unsetAllDebugMode).toHaveBeenCalledWith(uri);
    });

    it('wires activated webview panels into the request server', async () => {
      await runActivate(context);

      const onActivated = mockInitView.mock.calls[0][0] as (viewPanel: unknown) => void;
      const viewPanel = { webview: {} };
      onActivated(viewPanel);

      const requestServer = mockInitRequestServer.mock.results[0].value;
      expect(requestServer.addWebview).toHaveBeenCalledWith(viewPanel.webview);
    });
  });

  describe('old version auto uninstall (5s delayed check)', () => {
    it('does nothing when the old extension is not installed', async () => {
      stubExtensionLookup(undefined);

      await runActivate(context);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'workbench.extensions.uninstallExtension',
        'hismartliteopen.pypto-toolkit',
      );
    });

    it('does nothing when the old extension is installed but inactive', async () => {
      stubExtensionLookup({ isActive: false });

      await runActivate(context);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith(
        'workbench.extensions.uninstallExtension',
        'hismartliteopen.pypto-toolkit',
      );
    });

    it('prompts reload after successful uninstall when confirmed', async () => {
      stubExtensionLookup({ isActive: true });
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
      vi.mocked(vscode.window.showWarningMessage).mockImplementation((...args: unknown[]) =>
        Promise.resolve(args[args.length - 1] as any),
      );

      await runActivate(context);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
        'workbench.extensions.uninstallExtension',
        'hismartliteopen.pypto-toolkit',
      );
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.action.reloadWindow');
    });

    it('does not reload when the prompt is dismissed', async () => {
      stubExtensionLookup({ isActive: true });
      vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined as any);

      await runActivate(context);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('workbench.action.reloadWindow');
    });

    it('prompts manual uninstall when uninstall fails and confirmed', async () => {
      stubExtensionLookup({ isActive: true });
      vi.mocked(vscode.commands.executeCommand).mockRejectedValueOnce(new Error('uninstall failed'));
      vi.mocked(vscode.window.showErrorMessage).mockImplementation((...args: unknown[]) =>
        Promise.resolve(args[args.length - 1] as any),
      );

      await runActivate(context);

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('workbench.extensions.search', '@installed pypto');
    });

    it('does not search extensions when the error prompt is dismissed', async () => {
      stubExtensionLookup({ isActive: true });
      vi.mocked(vscode.commands.executeCommand).mockRejectedValueOnce(new Error('uninstall failed'));
      vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined as any);

      await runActivate(context);

      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('workbench.extensions.search', '@installed pypto');
    });
  });

  describe('initDB behaviour', () => {
    it('watches json files and clears com graph cache on change/delete', async () => {
      await runActivate(context);

      const watcher = vi.mocked(vscode.workspace.createFileSystemWatcher).mock.results[0].value as any;
      watcher.onDidChange.mock.calls[0][0](vscode.Uri.file('/a.json'));
      watcher.onDidDelete.mock.calls[0][0](vscode.Uri.file('/b.json'));

      expect(mockSQLiteCacheInstance.comGraphDataDelete).toHaveBeenCalledWith('/a.json');
      expect(mockSQLiteCacheInstance.comGraphDataDelete).toHaveBeenCalledWith('/b.json');
    });

    it('clears all caches when deletePersistFile is confirmed', async () => {
      await runActivate(context);
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Clear' as any);

      await getCommandHandler('PyPTO.Open.deletePersistFile')();

      expect(mockSQLiteCacheInstance.deleteForCommand).toHaveBeenCalled();
      expect(mockClearAllStores).toHaveBeenCalled();
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('pypto.cacheAlreadyCleared');
    });

    it('keeps caches when deletePersistFile is cancelled', async () => {
      await runActivate(context);
      vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined as any);

      await getCommandHandler('PyPTO.Open.deletePersistFile')();

      expect(mockSQLiteCacheInstance.deleteForCommand).not.toHaveBeenCalled();
      expect(mockClearAllStores).not.toHaveBeenCalled();
    });

    it('re-runs the clear command when the native layout setting changes', async () => {
      await runActivate(context);

      const configListener = vi.mocked(vscode.workspace.onDidChangeConfiguration).mock.calls.at(-1)![0];
      configListener({ affectsConfiguration: vi.fn(() => true) });

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('PyPTO.Open.deletePersistFile');
    });

    it('ignores unrelated configuration changes', async () => {
      await runActivate(context);

      const configListener = vi.mocked(vscode.workspace.onDidChangeConfiguration).mock.calls.at(-1)![0];
      configListener({ affectsConfiguration: vi.fn(() => false) });

      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('PyPTO.Open.deletePersistFile');
    });

    it('clears the sqlite cache on first install of a new version', async () => {
      context.globalState.get.mockReturnValue(undefined);

      await runActivate(context);

      expect(mockSQLiteCacheInstance.clearCache).toHaveBeenCalledTimes(1);
      expect(context.globalState.update).toHaveBeenCalledWith('SqlDataVersions', '2.0.21');
    });

    it('clears the sqlite cache when the persisted version differs', async () => {
      context.globalState.get.mockReturnValue('1.0.0');

      await runActivate(context);

      expect(mockSQLiteCacheInstance.clearCache).toHaveBeenCalledTimes(1);
    });

    it('keeps the sqlite cache when the version is unchanged', async () => {
      context.globalState.get.mockReturnValue('2.0.21');

      await runActivate(context);

      expect(mockSQLiteCacheInstance.clearCache).not.toHaveBeenCalled();
      expect(context.globalState.update).toHaveBeenCalledWith('SqlDataVersions', '2.0.21');
    });

    it('clears the sqlite cache when subscriptions are disposed', async () => {
      await runActivate(context);

      const clearCacheEntry = context.subscriptions.find(
        (item: any) => typeof item.dispose === 'function' && !('onDidChange' in item),
      );
      clearCacheEntry.dispose();

      expect(mockSQLiteCacheInstance.clearCache).toHaveBeenCalled();
    });
  });

  describe('fixExecutablePermissions', () => {
    it('restores executable permissions on non-windows platforms', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      vi.mocked(fs.existsSync).mockImplementation((p: any) => String(p).endsWith('swimlane-parser-linux'));

      await runActivate(context);

      const chmodCalls = vi.mocked(fs.chmodSync).mock.calls;
      expect(chmodCalls).toHaveLength(1);
      expect(chmodCalls[0][0]).toContain('swimlane-parser-linux');
      expect(chmodCalls[0][1]).toBe(0o755);
    });

    it('skips missing executables', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await runActivate(context);

      expect(fs.chmodSync).not.toHaveBeenCalled();
    });

    it('warns instead of throwing when chmod fails', async () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.chmodSync).mockImplementation(() => {
        throw new Error('EACCES');
      });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(runActivate(context)).resolves.toBeDefined();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('deactivate', () => {
    it('closes all services', async () => {
      await deactivate();

      expect(mockCloseAllServices).toHaveBeenCalledTimes(1);
    });
  });
});
