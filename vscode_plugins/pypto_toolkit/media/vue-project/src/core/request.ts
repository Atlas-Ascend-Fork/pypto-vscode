import { ExtensionConnector } from './connector';
import type { RequestMessage, ResponseMessage } from '../../../../src/core/server';
import { vscode } from './vscode';

interface RequestOptions {
  /** 超时时间（单位：ms），默认10000 */
  timeout?: number;

  /**
   * 使用自定义异常处理
   * - true 屏蔽全局异常处理（弹窗提示），异常时执行 Promise.reject
   * - false(默认) 使用全局异常处理，不执行 Promise.reject
   */
  useCustomErrorHandler?: boolean;
}

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
      const requestId = `${api}-${Date.now()}`;
      connector.send({ api, requestId, data: params });

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
      return;
    }
  };
}

function getOptionsWithDefault(options?: RequestOptions): Required<RequestOptions> {
  return {
    timeout: 10000,
    useCustomErrorHandler: false,
    ...options,
  };
}
