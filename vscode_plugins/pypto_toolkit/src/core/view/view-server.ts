import { Disposable } from 'vscode';

import { ViewServerContext } from './view-server-context';

/**
 * 视图服务端，用来提供数据、同vscode交互
 */
export class ViewServer<Apis extends string, Refs extends string> implements Disposable {
  /** 客户端可以访问的方法名 */
  static _apis: string[] = [];

  /** 客户端可以使用的响应式对象名 */
  static _refs: string[] = [];

  // static属性无法使用泛型，此处用于解析Apis和Refs，运行代码无作用
  public _allowedApi: Apis;
  public _allowedRef: Refs;

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
  apis: (typeof ViewServer)['_apis'];

  /** 客户端可以使用的响应式对象名 */
  refs: (typeof ViewServer)['_refs'];
}

/**
 * 生成视图服务端配置
 * @param serverPrototype ViewServer类原型
 */
export function makeViewServerConfig(serverPrototype: typeof ViewServer<string, string> | undefined): ViewServerConfig | undefined {
  return serverPrototype ? { apis: serverPrototype._apis, refs: serverPrototype._refs } : undefined;
}
