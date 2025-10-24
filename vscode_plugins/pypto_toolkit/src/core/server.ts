import { t } from 'i18next';
import * as vscode from 'vscode';

import { WebviewConnector } from './connector';

export interface RequestMessage {
  api: string;
  requestId: string;
  data: unknown;
}

export interface ResponseMessage {
  api: string;
  requestId: string;
  statusCode: 200 | 404 | 500 | null;
  message: string;
  data?: unknown;
  error?: { name: string; message: string; stack: string };
}

type Api = (params: any) => unknown;

type ApiGroup = {
  [key: string]: ApiGroup | Api;
};

let server: ExtensionApiServer;

export function initServer(apis: ApiGroup): ExtensionApiServer {
  server = new ExtensionApiServer(apis);
  return server;
}

export function useServer(): ExtensionApiServer {
  return server;
}

/**
 * 接口服务，监听webview端请求
 */
class ExtensionApiServer {
  private connector: WebviewConnector<ResponseMessage, RequestMessage>;

  /**
   * @param apis 接口配置
   */
  constructor(private apis: ApiGroup) {
    this.initRequestConnector();
  }

  public addWebview(webview: vscode.Webview): void {
    this.connector.addWebview(webview);
  }

  private initRequestConnector(): void {
    this.connector = new WebviewConnector('request');
    this.connector.receive(async (requestMessage, webview) => {
      const { api: apiPath, requestId, data } = requestMessage;
      const currentApi = this.getApi(apiPath);
      if (!currentApi) {
        this.resNotFoundError(webview, requestMessage);
        return;
      }
      try {
        const resData = await currentApi(data);
        this.resSuccess(webview, requestMessage, resData);
      } catch (e: unknown) {
        this.resServerError(webview, requestMessage, e);
        throw e;
      }
    });
  }

  private getApi(apiPath: string): Api | undefined {
    const apiKeys = apiPath.split('/');
    let apiOrGroup: ApiGroup | Api | undefined = this.apis;
    for (const apiKey of apiKeys) {
      apiOrGroup = apiOrGroup[apiKey];
      if (!apiOrGroup) {
        return undefined;
      }
    }
    return apiOrGroup instanceof Function ? apiOrGroup : undefined;
  }

  private resSuccess(webview: vscode.Webview, { api, requestId }: RequestMessage, resData: unknown): void {
    this.connector.send(webview, {
      api,
      requestId,
      statusCode: 200,
      message: t('PyPTOToolkit.request.statusSuccess'),
      data: resData,
    });
  }

  private resNotFoundError(webview: vscode.Webview, { api, requestId }: RequestMessage): void {
    this.connector.send(webview, {
      api,
      requestId,
      statusCode: 404,
      message: t('PyPTOToolkit.request.statusNotFound', { apiName: api }),
    });
  }

  private resServerError(webview: vscode.Webview, { api, requestId }: RequestMessage, error: unknown): void {
    this.connector.send(webview, {
      api,
      requestId,
      statusCode: 500,
      message: t('PyPTOToolkit.request.statusServerError', { apiName: api }),
      error: this.makeSendableError(error),
    });
  }

  /**
   * sendMessage无法发送error对象，转换成普通对象
   * @param error
   * @returns
   */
  private makeSendableError(error: unknown): { name: string; message: string; stack: string } {
    return {
      name: error instanceof Error ? error.name : 'CustomError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack ?? '' : '',
    };
  }
}
