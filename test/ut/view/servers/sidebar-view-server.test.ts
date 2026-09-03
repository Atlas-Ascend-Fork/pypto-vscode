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

vi.mock(import('../../../../src/services'), () => ({
  useService: vi.fn(() => ({
    scanDirectory: vi.fn(),
    onDidUpdateConfigData: vi.fn(),
  })),
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

describe('SidebarViewServer', () => {
  it('can be instantiated', () => {
    const ctx = {
      viewType: 'sidebar',
      init: vi.fn(),
      setRef: vi.fn(),
      closeWebview: vi.fn(),
    };
    const server = new SidebarViewServer(ctx as any);
    expect(server).toBeDefined();
  });
});
