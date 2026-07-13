/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import type { Uri, Webview, WebviewPanel } from 'vscode';

import { SingleWebviewConnector, WebviewConnector } from '../connector';

import { serverHasApi, serverHasRef, ViewServer } from './view-server';

/**
 * 视图服务运行环境
 */
export interface ViewServerContext {
  /**
   * 视图类型
   */
  viewType: string;
  /**
   * 文件地址
   */
  fileUri?: Uri;
  /**
   * 初始化
   */
  init(this: ViewServer<never, {}>): void;

  /**
   * 更新响应式变量
   */
  setRef(this: ViewServer<never, {}>, key: string, value: unknown): void;

  /**
   * 关闭webview
   */
  closeWebview(): void;
}

/**
 * 生成视图服务运行环境
 * @param webviewPanel
 * @returns
 */
export function makeViewServerContext(
  webviewPanel: Pick<WebviewPanel, 'webview' | 'dispose'>,
  viewType: string,
  uri?: Uri,
): ViewServerContext {
  const { webview, dispose } = webviewPanel;
  refConnector.addWebview(webview);
  let apiConnector: SingleWebviewConnector;
  return {
    viewType,
    fileUri: uri,
    init() {
      if (!apiConnector) {
        apiConnector = initApiConnector(webview, this);
      } else {
        apiConnector.reload();
      }
    },
    setRef(key, value) {
      if (!serverHasRef(this, key)) {
        throw new Error(`视图类${this.constructor.name}中未声明变量${key}，请使用 @viewRefs() 补充声明`);
      }
      refConnector.send(webview, { key, value });
    },
    closeWebview() {
      dispose.call(webviewPanel);
    },
  };
}

/**
 * 【消息】视图服务API响应
 */
export type ViewServerApiResponse = ViewServerApiCommonResponse | ViewServerApiStreamResponse;

/**
 * 视图服务API响应（一般）
 */
interface ViewServerApiCommonResponse {
  requestId: string;
  response: unknown;
}

/**
 * 视图服务API响应（流传输）
 */
export interface ViewServerApiStreamResponse extends Omit<ViewServerApiCommonResponse, 'response'> {
  /** 流传输是否完成 */
  streamDone: boolean;

  /** 流传输返回值 */
  streamResponse: unknown;
}

/**
 * 【消息】视图服务API请求
 */
export interface ViewServerApiMessage {
  api: string;
  requestId: string;
  params: unknown[];
}

/**
 * 初始化视图服务API
 * @param webview
 * @param instance
 */
function initApiConnector(webview: Webview, instance: ViewServer<never, {}>): SingleWebviewConnector {
  const apiConnector = new SingleWebviewConnector<ViewServerApiResponse, ViewServerApiMessage>('viewServerApi', webview, receive);
  async function receive({ api, requestId, params }): Promise<void> {
    if (!serverHasApi(instance, api)) {
      throw new Error(`视图类${instance.constructor.name}中未声明接口${api}，请使用 @viewApi 补充声明`);
    }
    const response = await instance[api].call(instance, ...params);
    sendResponse(requestId, response);
  }

  /**
   * API响应
   */
  function sendResponse(requestId: string, response: unknown): void {
    if (response instanceof ReadableStream) {
      readFromStream(response, ({ done, value }) => {
        apiConnector.send({ requestId, streamDone: done, streamResponse: value });
      });
    } else {
      apiConnector.send({ requestId, response });
    }
  }
  return apiConnector;
}

/**
 * 遍历数据流
 * @param steam
 * @param callback
 * @returns
 */
function readFromStream(steam: ReadableStream, callback: (res: ReadableStreamReadResult<unknown>) => void): void {
  const reader = steam.getReader();
  function readByChunk() {
    reader.read().then(({ done, value }) => {
      callback({ done, value });
      if (!done) {
        readByChunk();
      }
    });
  }
  return readByChunk();
}

/**
 * 【消息】更新响应式对象
 */
export interface ViewServerUpdateRefMessage {
  key: string;
  value: unknown;
}
const refConnector = new WebviewConnector<ViewServerUpdateRefMessage>('viewServerRef');
