import { Uri, Webview, WebviewPanel } from 'vscode';

import { SingleWebviewConnector, WebviewConnector } from '../connector';

import { ViewServer } from './view-server';

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
export function makeViewServerContext(webviewPanel: WebviewPanel, viewType: string, uri?: Uri): ViewServerContext {
  const { webview, dispose } = webviewPanel;
  return {
    viewType,
    fileUri: uri,
    init() {
      initApiConnector(webview, this);
    },
    setRef(key, value) {
      const staticThis = getStaticClass(this);
      if (!staticThis._viewConfig.refs.includes(key)) {
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
export interface ViewServerApiResponse {
  api: string;
  requestId: string;
  response: unknown;
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
function initApiConnector(webview: Webview, instance: ViewServer<never, {}>) {
  const apiConnector = new SingleWebviewConnector<ViewServerApiResponse, ViewServerApiMessage>('viewServerApi', webview, receive);
  async function receive({ api, requestId, params }) {
    const staticThis = getStaticClass(instance);
    if (!staticThis._viewConfig.apis.includes(api)) {
      throw new Error(`视图类${instance.constructor.name}中未声明接口${api}，请使用 @viewApi 补充声明`);
    }
    const response = await instance[api].call(instance, ...params);
    apiConnector.send({ api, requestId, response });
  }
}

function getStaticClass(instance: ViewServer<never, {}>): typeof ViewServer<never, {}> {
  return Object.getPrototypeOf(instance).constructor;
}

/**
 * 【消息】更新响应式对象
 */
export interface ViewServerUpdateRefMessage {
  key: string;
  value: unknown;
}
const refConnector = new WebviewConnector<ViewServerUpdateRefMessage>('viewServerRef');
