import { readonly, Ref, ref } from 'vue';

import type { ViewServer, ViewServerConfig } from 'ext:/core/view/view-server';
import type {
  ViewServerApiMessage,
  ViewServerApiResponse,
  ViewServerApiStreamResponse,
  ViewServerUpdateRefMessage,
} from 'ext:/core/view/view-server-context';

import { deepToRaw } from '@/utils/reactive';

import { ExtensionConnector } from './connector';
import { getQuery } from './query';

/**
 * 视图服务配置
 */
let serverConfig: ViewServerConfig;

getQuery().then(({ _server }) => {
  serverConfig = _server;
});

/**
 * 视图服务内的Api方法
 */
type ViewServerApi<Server extends ViewServer<never, {}>, ApiKey> = ApiKey extends keyof Server
  ? Server[ApiKey] extends (...args: any[]) => any
    ? Server[ApiKey]
    : never
  : never;

/** 转为异步函数 */
type Async<T extends (...args: any[]) => any> = ReturnType<T> extends Promise<unknown>
  ? T
  : (...args: Parameters<T>) => Promise<ReturnType<T>>;

/**
 * 视图服务暴露给UI层的api和ref
 */
type ExposeViewServer<Server extends ViewServer<never, {}>> = {
  [apiKey in keyof Server['_allowedApis']]: Server[apiKey] extends (...args: any[]) => any ? Async<Server[apiKey]> : never;
} & {
  [refKey in keyof Server['_allowedRefs']]: Readonly<Ref<Server['_allowedRefs'][refKey]>>;
};

export function useViewServer<ServerInstance extends ViewServer<never, {}> = ViewServer<never, {}>>() {
  const server: ExposeViewServer<ServerInstance> = new Proxy<any>(
    {},
    {
      get(_, p: string) {
        if (serverConfig?.apis.includes(p)) {
          return getViewServerApi(p);
        } else if (serverConfig?.refs.includes(p)) {
          return getViewServerRef(p);
        } else {
          return undefined;
        }
      },
    },
  );

  return { server };
}

/** api */
const serverApiConnector = new ExtensionConnector<ViewServerApiMessage, ViewServerApiResponse>('viewServerApi');
const pendingApis = new Map<string, (value: unknown) => void>();
serverApiConnector.receive((message) => {
  const { requestId } = message;
  if (!pendingApis.has(requestId)) {
    return;
  }
  if (isStreamResponse(message)) {
    handleStreamResponse(requestId, message);
  } else {
    pendingApis.get(requestId)(message.response);
    pendingApis.delete(requestId);
  }
});

/**
 * 是否为流式传输
 */
function isStreamResponse(message: ViewServerApiResponse): message is ViewServerApiStreamResponse {
  return Reflect.has(message, 'streamDone');
}

const pendingStreams = new Map<string, ReadableStreamDefaultController<any>>();
/**
 * 流式传输返回
 * @description 先返回一个ReadableStream，后续消息写入ReadableStream
 */
function handleStreamResponse(requestId: string, message: ViewServerApiStreamResponse): void {
  if (!pendingStreams.has(requestId)) {
    const stream = new ReadableStream({
      start(controller) {
        pendingStreams.set(requestId, controller);
      },
    });
    pendingApis.get(requestId)(stream);
  }
  if (message.streamDone) {
    pendingStreams.get(requestId).close();
    pendingStreams.delete(requestId);
    pendingApis.delete(requestId);
  } else {
    pendingStreams.get(requestId).enqueue(message.streamResponse);
  }
}

/**
 * 获取api属性
 * @param api
 * @returns
 */
function getViewServerApi(api: string): (...params: unknown[]) => Promise<unknown> {
  return (...params) => {
    const requestId = `${api}-${window.crypto.randomUUID()}`;
    const requestTimestamp = Date.now();
    serverApiConnector.send({ api: api, requestId, params: deepToRaw(params) });
    return new Promise((resolve) => {
      pendingApis.set(requestId, (res) => {
        if (import.meta.env.DEV) {
          console.debug('ViewServer - API:', api, '开始时间:', requestTimestamp, '响应时间:', Date.now() - requestTimestamp, '内容:', {
            request: params,
            response: res,
          });
        }
        resolve(res);
      });
    });
  };
}

/** ref */
const serverRefConnector = new ExtensionConnector<ViewServerUpdateRefMessage>('viewServerRef');
const serverRefs = new Map<string, Ref>();
serverRefConnector.receive(({ key, value }) => {
  if (!serverRefs.has(key)) {
    makeServerRef(key, value);
  } else {
    serverRefs.get(key).value = value;
  }
});

function makeServerRef(key: string, value?: unknown) {
  const serverRef = ref(value);
  serverRefs.set(key, serverRef);
}

/**
 * 获取ref属性
 * @param key
 * @returns
 */
function getViewServerRef(key: string): Readonly<Ref<unknown>> {
  if (!serverRefs.has(key)) {
    makeServerRef(key);
  }
  return readonly(serverRefs.get(key));
}
