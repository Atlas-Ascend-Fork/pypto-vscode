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
