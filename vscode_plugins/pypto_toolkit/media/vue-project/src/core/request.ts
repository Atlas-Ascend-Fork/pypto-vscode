import type { RequestOptions, RequestMessage, ResponseMessage } from 'ext:/core/request-server';

import { deepToRaw } from '@/utils/reactive';

import { ExtensionConnector } from './connector';

export type { RequestOptions };

interface ExtensionRequest {
  post: <Data, Res>(api: string, params: Data, options?: RequestOptions) => Promise<Res>;
}

interface PendingRequest {
  success: (value: any) => void;
  error: (statusCode: ResponseMessage['statusCode'], error: Error) => void;
  options: Required<RequestOptions>;
}

export const request = createExtensionRequest();

/**
 * 创建扩展端请求服务，webview使用
 * @returns { ExtensionRequest }
 */
function createExtensionRequest(): ExtensionRequest {
  const connector = new ExtensionConnector<RequestMessage, ResponseMessage>('request');

  const pendingRequests = new Map<string, PendingRequest>();

  connector.receive(({ requestId, statusCode, data, error }) => {
    if (!pendingRequests.has(requestId)) {
      return;
    }
    if (statusCode === 200) {
      pendingRequests.get(requestId)?.success(data);
    } else {
      pendingRequests.get(requestId)?.error(statusCode, error ? recoverFromMessageError(error) : new Error('unknown error'));
    }
    pendingRequests.delete(requestId);
  });

  return {
    post: <Data, Res>(api: string, params: Data, options?: RequestOptions): Promise<Res> => {
      const optionsWithDefault = getOptionsWithDefault(options);
      const requestId = `${api}-${window.crypto.randomUUID()}`;
      connector.send({ api, requestId, data: deepToRaw(params), options: optionsWithDefault });

      return new Promise((resolve, reject) => {
        // 请求超时
        const requestTimeout = setTimeout(() => {
          reject(new Error(`request:${requestId} timeout`));
          pendingRequests.delete(requestId);
        }, optionsWithDefault.timeout);

        pendingRequests.set(requestId, {
          success: makeSuccessHandler(resolve, requestTimeout),
          error: makeErrorHandler(reject, requestTimeout, optionsWithDefault),
          options: optionsWithDefault,
        });
      });
    },
  };
}

function recoverFromMessageError(messageError: NonNullable<ResponseMessage['error']>): Error {
  const error = new Error(messageError.message);
  error.name = messageError.name;
  error.stack = messageError.stack;
  return error;
}

function makeSuccessHandler<T extends (value: any) => void>(resolve: T, requestTimeout: ReturnType<typeof setTimeout>): T {
  return ((...args) => {
    clearTimeout(requestTimeout);
    resolve(...args);
  }) as T;
}

function makeErrorHandler(
  reject: (reason: unknown) => void,
  requestTimeout: ReturnType<typeof setTimeout>,
  options: Required<RequestOptions>,
): PendingRequest['error'] {
  return (statusCode, error) => {
    clearTimeout(requestTimeout);
    if (options.useCustomErrorHandler) {
      reject(error);
    } else {
      // server端唤起vscode错误提示
    }
  };
}

function getOptionsWithDefault(options?: RequestOptions): Required<RequestOptions> {
  return {
    timeout: 60000, // 默认60秒
    useCustomErrorHandler: false,
    ...options,
  };
}
