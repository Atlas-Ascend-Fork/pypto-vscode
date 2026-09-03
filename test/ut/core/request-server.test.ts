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
import * as vscode from 'vscode';
import { initRequestServer, useRequestServer } from '../../../src/core/request-server';

describe('request-server', () => {
  let mockWebview: any;
  let callbacks: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    callbacks = [];
    mockWebview = {
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((callback) => {
        callbacks.push(callback);
        (mockWebview as any)._callbacks = callbacks;
        return { dispose: vi.fn() };
      }),
    };
  });

  describe('initRequestServer', () => {
    it('should create ExtensionApiServer instance', () => {
      const apis = {
        testApi: vi.fn(),
      };
      const server = initRequestServer(apis);

      expect(server).toBeDefined();
    });
  });

  describe('useRequestServer', () => {
    it('should return the server instance', () => {
      const apis = {
        testApi: vi.fn(),
      };
      const server = initRequestServer(apis);
      const retrievedServer = useRequestServer();

      expect(retrievedServer).toBe(server);
    });
  });

  describe('ExtensionApiServer', () => {
    describe('addWebview', () => {
      it('should add webview to connector', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);

        server.addWebview(mockWebview as vscode.Webview);

        expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
      });
    });

    describe('getApi', () => {
      it('should resolve simple API path', () => {
        const testApi = vi.fn();
        const apis = {
          testApi,
        };
        const server = initRequestServer(apis);

        // Access private method through any
        const api = (server as any).getApi('testApi');

        expect(api).toBe(testApi);
      });

      it('should resolve nested API path', () => {
        const testApi = vi.fn();
        const apis = {
          group1: {
            group2: {
              testApi,
            },
          },
        };
        const server = initRequestServer(apis);

        const api = (server as any).getApi('group1/group2/testApi');

        expect(api).toBe(testApi);
      });

      it('should return undefined for non-existent API path', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);

        const api = (server as any).getApi('nonExistentApi');

        expect(api).toBeUndefined();
      });

      it('should return undefined for non-existent nested API path', () => {
        const apis = {
          group1: {
            testApi: vi.fn(),
          },
        };
        const server = initRequestServer(apis);

        const api = (server as any).getApi('group1/nonExistentApi');

        expect(api).toBeUndefined();
      });

      it('should return undefined for API group instead of API', () => {
        const apis = {
          group1: {
            testApi: vi.fn(),
          },
        };
        const server = initRequestServer(apis);

        const api = (server as any).getApi('group1');

        expect(api).toBeUndefined();
      });
    });

    describe('resSuccess', () => {
      it('should send success response', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);
        server.addWebview(mockWebview as vscode.Webview);

        // Simulate webview ready message
        callbacks.forEach((cb) => cb({ channel: '__connector__', data: 'request' }, mockWebview));

        const requestMessage = {
          api: 'testApi',
          requestId: 'req1',
          data: {},
          options: { timeout: 5000, useCustomErrorHandler: false },
        };

        (server as any).resSuccess(mockWebview, requestMessage, { result: 'success' });

        expect(mockWebview.postMessage).toHaveBeenCalledWith({
          channel: 'request',
          data: {
            api: 'testApi',
            requestId: 'req1',
            statusCode: 200,
            message: expect.any(String),
            data: { result: 'success' },
          },
        });
      });
    });

    describe('resNotFoundError', () => {
      it('should send 404 response', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);
        server.addWebview(mockWebview as vscode.Webview);

        // Simulate webview ready message
        callbacks.forEach((cb) => cb({ channel: '__connector__', data: 'request' }, mockWebview));

        const requestMessage = {
          api: 'nonExistentApi',
          requestId: 'req1',
          data: {},
          options: { timeout: 5000, useCustomErrorHandler: false },
        };

        (server as any).resNotFoundError(mockWebview, requestMessage);

        expect(mockWebview.postMessage).toHaveBeenCalledWith({
          channel: 'request',
          data: {
            api: 'nonExistentApi',
            requestId: 'req1',
            statusCode: 404,
            message: expect.any(String),
          },
        });
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      });
    });

    describe('resServerError', () => {
      it('should send 500 response with error object', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);
        server.addWebview(mockWebview as vscode.Webview);

        // Simulate webview ready message
        callbacks.forEach((cb) => cb({ channel: '__connector__', data: 'request' }, mockWebview));

        const requestMessage = {
          api: 'testApi',
          requestId: 'req1',
          data: {},
          options: { timeout: 5000, useCustomErrorHandler: false },
        };
        const error = new Error('Test error');

        (server as any).resServerError(mockWebview, requestMessage, error);

        expect(mockWebview.postMessage).toHaveBeenCalledWith({
          channel: 'request',
          data: {
            api: 'testApi',
            requestId: 'req1',
            statusCode: 500,
            message: expect.any(String),
            error: {
              name: 'Error',
              message: 'Test error',
              stack: expect.any(String),
            },
          },
        });
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();
      });

      it('should not show error message when useCustomErrorHandler is true', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);
        server.addWebview(mockWebview as vscode.Webview);

        // Simulate webview ready message
        callbacks.forEach((cb) => cb({ channel: '__connector__', data: 'request' }, mockWebview));

        const requestMessage = {
          api: 'testApi',
          requestId: 'req1',
          data: {},
          options: { timeout: 5000, useCustomErrorHandler: true },
        };
        const error = new Error('Test error');

        (server as any).resServerError(mockWebview, requestMessage, error);

        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
      });
    });

    describe('makeSendableError', () => {
      it('should convert Error to sendable object', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);

        const error = new Error('Test error');
        const result = (server as any).makeSendableError(error);

        expect(result).toEqual({
          name: 'Error',
          message: 'Test error',
          stack: expect.any(String),
        });
      });

      it('should convert non-Error to sendable object', () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);

        const result = (server as any).makeSendableError('Custom error');

        expect(result).toEqual({
          name: 'CustomError',
          message: 'Custom error',
          stack: '',
        });
      });
    });

    describe('request handling', () => {
      it('should handle successful API request', async () => {
        const testApi = vi.fn().mockResolvedValue({ result: 'success' });
        const apis = {
          testApi,
        };
        const server = initRequestServer(apis);
        server.addWebview(mockWebview as vscode.Webview);

        // Simulate webview ready message
        callbacks.forEach((cb) => cb({ channel: '__connector__', data: 'request' }, mockWebview));

        const requestMessage = {
          channel: 'request',
          data: {
            api: 'testApi',
            requestId: 'req1',
            data: { param: 'value' },
            options: { timeout: 5000, useCustomErrorHandler: false },
          },
        };

        // Simulate request
        callbacks.forEach((cb) => cb(requestMessage, mockWebview));

        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(testApi).toHaveBeenCalledWith({ param: 'value' });
        expect(mockWebview.postMessage).toHaveBeenCalledWith({
          channel: 'request',
          data: {
            api: 'testApi',
            requestId: 'req1',
            statusCode: 200,
            message: expect.any(String),
            data: { result: 'success' },
          },
        });
      });

      it('should handle non-existent API request', async () => {
        const apis = {
          testApi: vi.fn(),
        };
        const server = initRequestServer(apis);
        server.addWebview(mockWebview as vscode.Webview);

        // Simulate webview ready message
        callbacks.forEach((cb) => cb({ channel: '__connector__', data: 'request' }, mockWebview));

        const requestMessage = {
          channel: 'request',
          data: {
            api: 'nonExistentApi',
            requestId: 'req1',
            data: {},
            options: { timeout: 5000, useCustomErrorHandler: false },
          },
        };

        // Simulate request
        callbacks.forEach((cb) => cb(requestMessage, mockWebview));

        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockWebview.postMessage).toHaveBeenCalledWith({
          channel: 'request',
          data: {
            api: 'nonExistentApi',
            requestId: 'req1',
            statusCode: 404,
            message: expect.any(String),
          },
        });
      });

      it('should handle API error', async () => {
        const testApi = vi.fn().mockRejectedValue(new Error('API error'));
        const apis = {
          testApi,
        };
        const server = initRequestServer(apis);
        server.addWebview(mockWebview as vscode.Webview);

        // Simulate webview ready message
        callbacks.forEach((cb) => cb({ channel: '__connector__', data: 'request' }, mockWebview));

        const requestMessage = {
          channel: 'request',
          data: {
            api: 'testApi',
            requestId: 'req1',
            data: {},
            options: { timeout: 5000, useCustomErrorHandler: false },
          },
        };

        // Simulate request
        callbacks.forEach((cb) => cb(requestMessage, mockWebview));

        // Wait for async operations
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockWebview.postMessage).toHaveBeenCalledWith({
          channel: 'request',
          data: {
            api: 'testApi',
            requestId: 'req1',
            statusCode: 500,
            message: expect.any(String),
            error: {
              name: 'Error',
              message: 'API error',
              stack: expect.any(String),
            },
          },
        });
      });
    });
  });
});
