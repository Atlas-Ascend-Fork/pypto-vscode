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
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../../src/extension'), () => ({
  extensionContext: {
    globalState: {
      get: vi.fn((key: string, defaultValue: unknown) => defaultValue),
      update: vi.fn(),
    },
  },
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

import { WelcomeViewServer } from '../../../../src/view/servers/welcom-server';
import { extensionContext } from '../../../../src/extension';

function createServer() {
  const ctx = {
    viewType: 'welcome',
    fileUri: { fsPath: '/test/welcome.json' },
    init: vi.fn(),
    setRef: vi.fn(),
    closeWebview: vi.fn(),
  };
  const server = new WelcomeViewServer(ctx as any);
  server.created(ctx as any);
  return server;
}

describe('WelcomeViewServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extensionContext.globalState.get).mockImplementation((key: string, defaultValue: unknown) => defaultValue);
  });

  it('can be instantiated', () => {
    const server = createServer();
    expect(server).toBeDefined();
  });

  it('created initializes refs with persisted values', () => {
    vi.mocked(extensionContext.globalState.get).mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'welcomeView.skipAllStep2') {
        return true;
      }
      return defaultValue;
    });

    const server = createServer();

    expect(server.getRef('skipAllStep2')).toBe(true);
    expect(server.getRef('skipAllStep3')).toBe(false);
  });

  it('created initializes refs to false when nothing persisted', () => {
    const server = createServer();

    expect(server.getRef('skipAllStep2')).toBe(false);
    expect(server.getRef('skipAllStep3')).toBe(false);
  });

  it('completeResultsStep sets ref true and persists', () => {
    const server = createServer();

    WelcomeViewServer.completeResultsStep();

    expect(server.getRef('skipAllStep2')).toBe(true);
    expect(extensionContext.globalState.update).toHaveBeenCalledWith('welcomeView.skipAllStep2', true);
  });

  it('reductionResultsStep sets ref false and persists', () => {
    const server = createServer();

    WelcomeViewServer.reductionResultsStep();

    expect(server.getRef('skipAllStep2')).toBe(false);
    expect(extensionContext.globalState.update).toHaveBeenCalledWith('welcomeView.skipAllStep2', false);
  });

  it('completeTreeColumnStep sets ref true and persists', () => {
    const server = createServer();

    WelcomeViewServer.completeTreeColumnStep();

    expect(server.getRef('skipAllStep3')).toBe(true);
    expect(extensionContext.globalState.update).toHaveBeenCalledWith('welcomeView.skipAllStep3', true);
  });

  it('reductionTreeColumnStep sets ref false and persists', () => {
    const server = createServer();

    WelcomeViewServer.reductionTreeColumnStep();

    expect(server.getRef('skipAllStep3')).toBe(false);
    expect(extensionContext.globalState.update).toHaveBeenCalledWith('welcomeView.skipAllStep3', false);
  });
});
