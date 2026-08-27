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
import { WebviewConnector, SingleWebviewConnector, CONNECTOR_READY_CHANNEL } from '../../../src/core/connector';
import type { Webview } from 'vscode';

describe('WebviewConnector', () => {
  let connector: WebviewConnector<any, any>;
  let mockWebview: any;

  beforeEach(() => {
    connector = new WebviewConnector('testChannel');
    mockWebview = {
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((callback) => {
        (mockWebview as any)._callback = callback;
        return { dispose: vi.fn() };
      }),
    };
  });

  describe('send', () => {
    it('should send message immediately when webview is ready', () => {
      connector.addWebview(mockWebview as Webview);
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });

      connector.send(mockWebview as Webview, { test: 'data' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: 'testChannel',
        data: { test: 'data' },
      });
    });

    it('should buffer message when webview is not ready', () => {
      connector.addWebview(mockWebview as Webview);

      connector.send(mockWebview as Webview, { test: 'data' });

      expect(mockWebview.postMessage).not.toHaveBeenCalled();
    });

    it('should send buffered messages when webview becomes ready', () => {
      connector.addWebview(mockWebview as Webview);

      connector.send(mockWebview as Webview, { test: 'data1' });
      connector.send(mockWebview as Webview, { test: 'data2' });

      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });

      expect(mockWebview.postMessage).toHaveBeenCalledTimes(2);
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: 'testChannel',
        data: { test: 'data1' },
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: 'testChannel',
        data: { test: 'data2' },
      });
    });
  });

  describe('receive', () => {
    it('should register listener', () => {
      const callback = vi.fn();
      connector.receive(callback);

      connector.addWebview(mockWebview as Webview);
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });
      // Simulate message from webview
      (mockWebview as any)._callback({ channel: 'testChannel', data: { test: 'data' } });

      expect(callback).toHaveBeenCalledWith({ test: 'data' }, mockWebview);
    });

    it('should call all listeners', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      connector.receive(callback1);
      connector.receive(callback2);

      connector.addWebview(mockWebview as Webview);
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });
      // Simulate message from webview
      (mockWebview as any)._callback({ channel: 'testChannel', data: { test: 'data' } });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should ignore messages from other channels', () => {
      const callback = vi.fn();
      connector.receive(callback);

      connector.addWebview(mockWebview as Webview);
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });
      // Simulate message from other channel
      (mockWebview as any)._callback({ channel: 'otherChannel', data: { test: 'data' } });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('addWebview', () => {
    it('should register webview and listen to messages', () => {
      connector.addWebview(mockWebview as Webview);

      expect(mockWebview.onDidReceiveMessage).toHaveBeenCalled();
    });
  });
});

describe('SingleWebviewConnector', () => {
  let connector: SingleWebviewConnector<any, any>;
  let mockWebview: any;
  let callback: any;

  beforeEach(() => {
    callback = vi.fn();
    mockWebview = {
      postMessage: vi.fn(),
      onDidReceiveMessage: vi.fn((cb) => {
        (mockWebview as any)._callback = cb;
        return { dispose: vi.fn() };
      }),
    };
    connector = new SingleWebviewConnector('testChannel', mockWebview as Webview, callback);
  });

  describe('constructor', () => {
    it('should send extension ready message', () => {
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: CONNECTOR_READY_CHANNEL,
        data: 'testChannel',
      });
    });
  });

  describe('send', () => {
    it('should send message immediately when webview is ready', () => {
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });

      connector.send({ test: 'data' });

      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: 'testChannel',
        data: { test: 'data' },
      });
    });

    it('should buffer message when webview is not ready', () => {
      connector.send({ test: 'data' });

      // Should only have the extension ready message
      expect(mockWebview.postMessage).toHaveBeenCalledTimes(1);
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: CONNECTOR_READY_CHANNEL,
        data: 'testChannel',
      });
    });

    it('should send buffered messages when webview becomes ready', () => {
      connector.send({ test: 'data1' });
      connector.send({ test: 'data2' });

      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });

      expect(mockWebview.postMessage).toHaveBeenCalledTimes(3); // 1 ready + 2 data
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: 'testChannel',
        data: { test: 'data1' },
      });
      expect(mockWebview.postMessage).toHaveBeenCalledWith({
        channel: 'testChannel',
        data: { test: 'data2' },
      });
    });
  });

  describe('reload', () => {
    it('should reset webview ready state and clear pending data', () => {
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });

      connector.send({ test: 'data' });

      connector.reload();

      // Should send extension ready message again
      expect(mockWebview.postMessage).toHaveBeenCalledTimes(3); // 1 ready + 1 data + 1 ready again
    });

    it('should clear pending data on reload', () => {
      connector.send({ test: 'data1' });

      connector.reload();

      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });

      // Should only send the extension ready message, not the buffered data
      expect(mockWebview.postMessage).toHaveBeenCalledTimes(2); // 1 ready + 1 ready again
    });
  });

  describe('message handling', () => {
    it('should call callback when message is received', () => {
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });
      // Simulate message from webview
      (mockWebview as any)._callback({ channel: 'testChannel', data: { test: 'data' } });

      expect(callback).toHaveBeenCalledWith({ test: 'data' });
    });

    it('should ignore messages from other channels', () => {
      // Simulate webview ready message
      (mockWebview as any)._callback({ channel: CONNECTOR_READY_CHANNEL, data: 'testChannel' });
      // Simulate message from other channel
      (mockWebview as any)._callback({ channel: 'otherChannel', data: { test: 'data' } });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
