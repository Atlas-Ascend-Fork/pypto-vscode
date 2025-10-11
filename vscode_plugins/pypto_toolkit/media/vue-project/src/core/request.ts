import { ExtensionConnector } from './connector';
import type { RequestMessage, ResponseMessage } from '../../../../src/core/server';

interface RequestOptions {
  /** 超时时间（单位：ms），默认10000 */
  timeout?: number;
}

interface ExtensionRequest {
  post: <Data, Res>(api: string, params: Data, options?: RequestOptions) => Promise<Res>;
}

interface PendingRequest {
  success: (value: any) => void;
  error: (error: Error) => void;
  options: Required<RequestOptions>;
}

export const request = creatExtensionRequest();

/**
 * 创建扩展端请求服务，webview使用
 * @returns { ExtensionRequest }
 */
function creatExtensionRequest(): ExtensionRequest {
  const connector = new ExtensionConnector<RequestMessage, ResponseMessage>('request');

  const pendingRequests = new Map<string, PendingRequest>();

  connector.receive(({ requestId, statusCode, data, error }) => {
    if (!pendingRequests.has(requestId)) {
      return;
    }
    if (statusCode === 200) {
      pendingRequests.get(requestId)?.success(data);
    } else {
      pendingRequests.get(requestId)?.error(error ?? new Error('unknown error'));
    }
    pendingRequests.delete(requestId);
  });

  return {
    post: <Data, Res>(api: string, params: Data, options?: RequestOptions): Promise<Res> => {
      const optionsWithDefault = getOptionsWithDefault(options);
      const requestId = `${api}-${Date.now()}`;
      connector.send({ api, requestId, data: params });

      return new Promise((resolve, reject) => {
        pendingRequests.set(requestId, { success: resolve, error: reject, options: optionsWithDefault });
        // 请求超时
        setTimeout(() => {
          pendingRequests.get(requestId)?.error(new Error(`request:${requestId} timeout`));
          pendingRequests.delete(requestId);
        }, optionsWithDefault.timeout);
      });
    },
  };
}

function getOptionsWithDefault(options?: RequestOptions): Required<RequestOptions> {
  return {
    timeout: 10000,
    ...options,
  };
}
