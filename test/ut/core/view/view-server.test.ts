/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ViewServer,
  viewApi,
  viewRefs,
  makeViewServerConfig,
  serverHasApi,
  serverHasRef,
} from '../../../../src/core/view/view-server';
import type { ViewServerContext } from '../../../../src/core/view/view-server-context';

describe('view-server', () => {
  describe('viewApi decorator', () => {
    it('should add method to apis list', () => {
      class TestServer extends ViewServer<any, any> {
        @viewApi()
        testMethod() {}
      }

      const config = (TestServer as any)._viewConfig;
      expect(config.apis).toContain('testMethod');
      expect(config.apis).toContain('closeWebview');
    });

    it('should handle multiple decorators', () => {
      class TestServer extends ViewServer<any, any> {
        @viewApi()
        method1() {}

        @viewApi()
        method2() {}
      }

      const config = (TestServer as any)._viewConfig;
      expect(config.apis).toContain('method1');
      expect(config.apis).toContain('method2');
      expect(config.apis).toContain('closeWebview');
    });

    it('should initialize config if not exists', () => {
      class TestServer extends ViewServer<any, any> {
        @viewApi()
        testMethod() {}
      }

      const config = (TestServer as any)._viewConfig;
      expect(config).toBeDefined();
      expect(config.apis).toBeDefined();
      expect(config.refs).toBeDefined();
    });
  });

  describe('viewRefs decorator', () => {
    it('should add refs to refs list', () => {
      @viewRefs(['ref1', 'ref2'])
      class TestServer extends ViewServer<any, any> {}

      const config = (TestServer as any)._viewConfig;
      expect(config.refs).toContain('ref1');
      expect(config.refs).toContain('ref2');
    });

    it('should handle empty refs', () => {
      @viewRefs([])
      class TestServer extends ViewServer<any, any> {}

      const config = (TestServer as any)._viewConfig;
      expect(config.refs).toEqual([]);
    });

    it('should initialize config if not exists', () => {
      @viewRefs(['ref1'])
      class TestServer extends ViewServer<any, any> {}

      const config = (TestServer as any)._viewConfig;
      expect(config).toBeDefined();
      expect(config.apis).toBeDefined();
      expect(config.refs).toBeDefined();
    });
  });

  describe('ViewServer class', () => {
    let mockCtx: ViewServerContext;

    beforeEach(() => {
      mockCtx = {
        init: vi.fn(),
        setRef: vi.fn(),
        closeWebview: vi.fn(),
      };
    });

    it('should call ctx.init on construction', () => {
      class TestServer extends ViewServer<any, any> {}
      new TestServer(mockCtx);
      expect(mockCtx.init).toHaveBeenCalled();
    });

    it('should set ref via ctx.setRef', () => {
      class TestServer extends ViewServer<any, any> {
        testSetRef(key: string, value: any) {
          this.setRef(key, value);
        }
      }

      const server = new TestServer(mockCtx);
      server.testSetRef('testRef', 'testValue');
      expect(mockCtx.setRef).toHaveBeenCalledWith('testRef', 'testValue');
    });

    it('should get ref from internal map', () => {
      class TestServer extends ViewServer<any, any> {
        testSetRef(key: string, value: any) {
          this.setRef(key, value);
        }
        testGetRef(key: string) {
          return this.getRef(key);
        }
      }

      const server = new TestServer(mockCtx);
      server.testSetRef('testRef', 'testValue');
      const value = server.testGetRef('testRef');
      expect(value).toBe('testValue');
    });

    it('should return undefined for non-existent ref', () => {
      class TestServer extends ViewServer<any, any> {
        testGetRef(key: string) {
          return this.getRef(key);
        }
      }

      const server = new TestServer(mockCtx);
      const value = server.testGetRef('nonExistent');
      expect(value).toBeUndefined();
    });

    it('should call ctx.closeWebview on closeWebview', () => {
      class TestServer extends ViewServer<any, any> {}
      const server = new TestServer(mockCtx);
      server.closeWebview();
      expect(mockCtx.closeWebview).toHaveBeenCalled();
    });

    it('should call onDisposed on dispose', () => {
      class TestServer extends ViewServer<any, any> {
        onDisposedCalled = false;
        protected onDisposed() {
          this.onDisposedCalled = true;
        }
      }

      const server = new TestServer(mockCtx);
      server.dispose();
      expect(server.onDisposedCalled).toBe(true);
    });
  });

  describe('makeViewServerConfig', () => {
    it('should return config from server prototype', () => {
      @viewRefs(['ref1'])
      class TestServer extends ViewServer<any, any> {
        @viewApi()
        testMethod() {}
      }

      const config = makeViewServerConfig(TestServer as any);
      expect(config).toBeDefined();
      expect(config?.apis).toContain('testMethod');
      expect(config?.refs).toContain('ref1');
    });

    it('should return undefined for undefined prototype', () => {
      const config = makeViewServerConfig(undefined);
      expect(config).toBeUndefined();
    });
  });

  describe('serverHasApi', () => {
    it('should return true if server has api', () => {
      class TestServer extends ViewServer<any, any> {
        @viewApi()
        testMethod() {}
      }

      const server = new TestServer({
        init: vi.fn(),
        setRef: vi.fn(),
        closeWebview: vi.fn(),
      });

      expect(serverHasApi(server, 'testMethod')).toBe(true);
      expect(serverHasApi(server, 'closeWebview')).toBe(true);
    });

    it('should return false if server does not have api', () => {
      class TestServer extends ViewServer<any, any> {
        @viewApi()
        testMethod() {}
      }

      const server = new TestServer({
        init: vi.fn(),
        setRef: vi.fn(),
        closeWebview: vi.fn(),
      });

      expect(serverHasApi(server, 'nonExistentMethod')).toBe(false);
    });
  });

  describe('serverHasRef', () => {
    it('should return true if server has ref', () => {
      @viewRefs(['ref1', 'ref2'])
      class TestServer extends ViewServer<any, any> {}

      const server = new TestServer({
        init: vi.fn(),
        setRef: vi.fn(),
        closeWebview: vi.fn(),
      });

      expect(serverHasRef(server, 'ref1')).toBe(true);
      expect(serverHasRef(server, 'ref2')).toBe(true);
    });

    it('should return false if server does not have ref', () => {
      @viewRefs(['ref1'])
      class TestServer extends ViewServer<any, any> {}

      const server = new TestServer({
        init: vi.fn(),
        setRef: vi.fn(),
        closeWebview: vi.fn(),
      });

      expect(serverHasRef(server, 'nonExistentRef')).toBe(false);
    });
  });
});
