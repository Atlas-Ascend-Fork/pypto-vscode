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
  /** 服务端执行异常时的错误信息（前端可据此时完成挂起的请求，而非等待至超时） */
  error?: string;
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
    try {
      if (!serverHasApi(instance, api)) {
        throw new Error(`视图类${instance.constructor.name}中未声明接口${api}，请使用 @viewApi 补充声明`);
      }
      const response = await instance[api].call(instance, ...params);
      sendResponse(requestId, response);
    } catch (error) {
      // 派发侧为 fire-and-forget，此处必须兜底：回传错误响应让前端挂起的请求得以完成，
      // 同时避免 unhandled rejection（与 request-server 的错误处理方式保持一致）
      console.error(`[ViewServer] API ${api} 执行失败：`, error);
      apiConnector.send({ requestId, response: undefined, error: (error as Error)?.message ?? String(error) });
    }
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
