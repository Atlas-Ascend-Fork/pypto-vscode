import { Disposable } from 'vscode';

import { ViewServerContext } from './view-server-context';

/**
 * 【装饰器】客户端可以访问的方法
 */
export function viewApi<Apis extends string>() {
  return (target: ViewServer<Apis, {}>, targetKey: Apis): void => {
    if (!(target.constructor as any)._viewConfig) {
      (target.constructor as any)._viewConfig = { apis: [], refs: [] };
    }
    (target.constructor as any)._viewConfig.apis.push(targetKey);
  };
}

/**
 * 【装饰器】客户端可以访问的属性（一次定义全部属性）
 * @param refKeys
 * @returns
 */
export function viewRefs<Refs extends object>(refKeys: (keyof Refs)[]) {
  return (target: new (...args: any[]) => ViewServer<never, Refs>): void => {
    if (!(target as any)._viewConfig) {
      (target as any)._viewConfig = { apis: [], refs: [] };
    }
    (target as any)._viewConfig.refs.push(...refKeys);
  };
}

// static属性无法使用泛型，此处用于解析Apis和Refs，运行代码不包含下列属性
export interface ViewServer<Apis extends string, Refs extends object> {
  _allowedApis: Record<Apis, unknown>;
  _allowedRefs: Refs;
}

/**
 * 视图服务端，用来提供数据、同vscode交互
 */
export class ViewServer<Apis extends string, Refs extends object> implements Disposable {
  static _viewConfig: ViewServerConfig;

  private _refMap = new Map<string, unknown>();

  /**
   * @param ctx 运行环境
   */
  constructor(private _ctx: ViewServerContext) {
    _ctx.init.call(this);
  }

  /**
   * 销毁
   */
  public dispose() {
    this._ctx.closeWebview();
  }

  /**
   * 创建视图hook（继承类覆盖）
   */
  public created(ctx: ViewServerContext) {}

  /**
   * 销毁视图hook（继承类覆盖）
   */
  public disposed() {}

  /**
   * 设置响应式对象的值
   */
  protected setRef(key: string, value: unknown): void {
    this._ctx.setRef.call(this, key, value);
    this._refMap.set(key, value);
  }

  /**
   * 读取响应式对象的值
   */
  protected getRef(key: string): any {
    return this._refMap.get(key);
  }
}

/** 传给webview的视图服务端配置 */
export interface ViewServerConfig {
  /** 客户端可以访问的方法名 */
  apis: string[];

  /** 客户端可以使用的响应式对象名 */
  refs: string[];
}

/**
 * 生成视图服务端配置
 * @param serverPrototype ViewServer类原型
 */
export function makeViewServerConfig(serverPrototype: typeof ViewServer<never, {}> | undefined): ViewServerConfig | undefined {
  return serverPrototype ? serverPrototype._viewConfig : undefined;
}

export function serverHasApi(instance: ViewServer<never, {}>, api: string): boolean {
  return getStaticClass(instance)._viewConfig.apis.includes(api);
}

export function serverHasRef(instance: ViewServer<never, {}>, ref: string): boolean {
  return getStaticClass(instance)._viewConfig.refs.includes(ref);
}

function getStaticClass(instance: ViewServer<never, {}>): typeof ViewServer<never, {}> {
  return Object.getPrototypeOf(instance).constructor;
}
