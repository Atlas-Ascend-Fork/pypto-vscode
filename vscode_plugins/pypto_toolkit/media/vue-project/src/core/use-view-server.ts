import { readonly, Ref, ref } from 'vue';

import type { ViewServer, ViewServerConfig } from 'ext:/core/view/view-server';
import type { ViewServerApiMessage, ViewServerApiResponse, ViewServerUpdateRefMessage } from 'ext:/core/view/view-server-context';

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

type Promised<T> = T extends Promise<unknown> ? T : Promise<T>;

/** 转为异步函数 */
type Async<T extends (...args: any[]) => any> = (...args: Parameters<T>) => Promised<ReturnType<T>>;

/**
 * 视图服务暴露给UI层的api和ref
 */
type ExposeViewServer<Server extends ViewServer<never, {}>> = {
  [apiKey in keyof Server['_allowedApis']]: Async<ViewServerApi<Server, apiKey>>;
} & {
  [refKey in keyof Server['_allowedRefs']]: Readonly<Ref<Server['_allowedRefs'][refKey]>>;
};

export function useViewServer<ServerInstance extends ViewServer<never, {}>>() {
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
const pendingApis = new Map();
serverApiConnector.receive(({ requestId, response }) => {
  if (!pendingApis.has(requestId)) {
    return;
  }
  pendingApis.get(requestId)(response);
});

/**
 * 获取api属性
 * @param api
 * @returns
 */
function getViewServerApi(api: string): (...args: unknown[]) => Promise<unknown> {
  return (...params) => {
    const requestId = `${api}-${window.crypto.randomUUID()}`;
    serverApiConnector.send({ api: api, requestId, params: deepToRaw(params) });
    return new Promise((resolve) => {
      pendingApis.set(requestId, resolve);
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
