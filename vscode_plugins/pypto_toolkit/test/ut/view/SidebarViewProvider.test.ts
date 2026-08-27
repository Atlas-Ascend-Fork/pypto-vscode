/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock(import('../../../src/core/request-server'), () => ({
  useRequestServer: vi.fn(() => ({ addWebview: vi.fn() })),
}));

vi.mock(import('../../../src/core/editorView'), () => ({
  getWebviewEntryCode: vi.fn(() => '<html>sidebar</html>'),
}));

vi.mock(import('../../../src/core/view/view-server-context'), () => ({
  makeViewServerContext: vi.fn(() => ({
    viewType: 'sidebar',
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  })),
}));

vi.mock(import('../../../src/core/view/view-server'), () => ({
  makeViewServerConfig: vi.fn(() => ({ apis: [], refs: [] })),
  ViewServer: class {},
  viewApi: () => () => {},
  viewRefs: () => () => {},
}));

vi.mock(import('../../../src/theme'), () => ({
  getIDETheme: vi.fn(() => 'dark'),
}));

vi.mock(import('../../../src/view/servers/sidebar-view-server'), () => {
  class MockSidebarViewServer {
    created = vi.fn();
  }
  return { SidebarViewServer: MockSidebarViewServer };
});

vi.mock(import('../../../src/services'), () => ({
  useService: vi.fn(() => ({
    scanDirectory: vi.fn(),
    onDidUpdateConfigData: vi.fn(),
  })),
}));

import { SidebarViewProvider } from '../../../src/view/SidebarViewProvider';

describe('SidebarViewProvider', () => {
  it('resolveWebviewView sets enableScripts and HTML', () => {
    const provider = new SidebarViewProvider();
    const mockWebviewView = {
      webview: {
        options: {},
        html: '',
        postMessage: vi.fn(),
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
        asWebviewUri: vi.fn((uri: any) => uri),
      },
      visible: true,
      onDidChangeVisibility: vi.fn(() => ({ dispose: vi.fn() })),
    };

    provider.resolveWebviewView(mockWebviewView as any);
    expect(mockWebviewView.webview.options).toEqual({ enableScripts: true });
    expect(mockWebviewView.webview.html).toBe('<html>sidebar</html>');
  });
});
