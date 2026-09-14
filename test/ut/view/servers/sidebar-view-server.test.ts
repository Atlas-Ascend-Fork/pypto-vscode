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

const mockConfigService = {
  scanDirectory: vi.fn(),
  onDidUpdateConfigData: vi.fn(),
};

vi.mock(import('../../../../src/services'), () => ({
  useService: vi.fn(() => mockConfigService),
}));

vi.mock(import('../../../../src/core/view/view-server'), () => {
  class MockViewServer {
    static _viewConfig: any = { apis: ['closeWebview'], refs: [] };
    _refMap = new Map<string, unknown>();
    _disposables: any[] = [];
    constructor(ctx: any) {
      ctx.init.call(this);
    }
    created(_ctx: any) {}
    setRef(key: string, value: unknown) {
      this._refMap.set(key, value);
    }
    getRef(key: string) {
      return this._refMap.get(key);
    }
    closeWebview() {}
    dispose() {}
  }
  return {
    ViewServer: MockViewServer,
    viewApi: () => () => {},
    viewRefs: () => () => {},
  };
});

import { SidebarViewServer } from '../../../../src/view/servers/sidebar-view-server';

function createServer() {
  const ctx = {
    viewType: 'sidebar',
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
  const server = new SidebarViewServer(ctx as any);
  server.created(ctx as any);
  return server;
}

describe('SidebarViewServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can be instantiated', () => {
    const server = createServer();
    expect(server).toBeDefined();
    expect(mockConfigService.onDidUpdateConfigData).toHaveBeenCalled();
  });

  it('refreshConfigList triggers config service scan', () => {
    const server = createServer();

    server.refreshConfigList();

    expect(mockConfigService.scanDirectory).toHaveBeenCalledTimes(1);
  });

  it('updates refs on scanning status change', () => {
    const server = createServer();
    const updateCallback = mockConfigService.onDidUpdateConfigData.mock.calls[0][0] as (e: any) => void;

    updateCallback({ status: 'scanning', files: [{ name: 'a' }] });

    expect(server.getRef('isScanning')).toBe(true);
    expect(server.getRef('configFiles')).toEqual([{ name: 'a' }]);

    updateCallback({ status: 'completed', files: [{ name: 'b' }] });

    expect(server.getRef('isScanning')).toBe(false);
    expect(server.getRef('configFiles')).toEqual([{ name: 'b' }]);
  });
});
