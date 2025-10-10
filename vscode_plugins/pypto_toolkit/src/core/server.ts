import { t } from 'i18next';

import { WebviewConnector } from './connector';

export interface RequestMessage {
  api: string;
  requestId: string;
  data: unknown;
}

export interface ResponseMessage {
  api: string;
  requestId: string;
  statusCode: 200 | 404 | 500;
  message: string;
  data?: unknown;
  error?: Error;
}

interface RequestServer {
  addWebview: WebviewConnector['addWebview'];
}

/**
 * 启动接口服务，监听webview端请求
 * @param apis 接口配置
 */
export function startExtensionRequestServer(apis: Record<string, (params: any) => Promise<unknown> | unknown>): RequestServer {
  const connector = new WebviewConnector<ResponseMessage, RequestMessage>('request');

  connector.receive(async ({ api, requestId, data }, webview) => {
    if (!apis[api]) {
      connector.send(webview, { api, requestId, statusCode: 404, message: t('PyPTOToolkit.request.statusNotFound', { apiName: api }) });
      return;
    }
    try {
      const resData = await apis[api](data);
      connector.send(webview, { api, requestId, statusCode: 200, message: t('PyPTOToolkit.request.statusSuccess'), data: resData });
    } catch (e: unknown) {
      connector.send(webview, {
        api,
        requestId,
        statusCode: 500,
        message: t('PyPTOToolkit.request.statusServerError', { apiName: api }),
        error: e instanceof Error ? e : new Error(String(e)),
      });
    }
  });

  return { addWebview: connector.addWebview.bind(connector) };
}
