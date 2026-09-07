/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software: you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
