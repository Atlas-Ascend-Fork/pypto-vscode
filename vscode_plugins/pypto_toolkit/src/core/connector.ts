import type { Webview } from 'vscode';

/**
 * 通信频道
 * @value request 数据请求
 * @value viewQuery 页面参数
 * @value viewServerApi 页面服务端 - api方法
 * @value viewServerRef 页面服务端 - 响应式对象
 */
export type ConnectChannel = '__connector__' | 'request' | 'editorView' | 'viewServerApi' | 'viewServerRef';

export type ConnectMessage = { channel: ConnectChannel; data: any };

type ExtensionListener<T> = (message: T, webview: Webview) => void;

export const CONNECTOR_READY_CHANNEL: ConnectChannel = '__connector__';

/**
 * 多webview通信器（extension端使用）
 */
export class WebviewConnector<T = unknown, R = T> {
  /**
   * webview端通信器是否激活
   */
  private webviewReady: WeakMap<Webview, boolean> = new WeakMap();

  /**
   * webview端通信器激活前暂存的消息
   */
  private pendingDataList: WeakMap<Webview, T[]> = new WeakMap();

  private listeners: ExtensionListener<R>[] = [];

  constructor(private channel: ConnectChannel) {}

  public send(webview: Webview, data: T): void {
    if (this.webviewReady.get(webview)) {
      webview.postMessage({ channel: this.channel, data });
    } else {
      this.pendingDataList.get(webview)?.push(data);
    }
  }

  public receive(callback: ExtensionListener<R>): void {
    this.listeners.push(callback);
  }

  public addWebview(webview: Webview): void {
    this.pendingDataList.set(webview, []);
    webview.onDidReceiveMessage((res) => {
      // 客户端初始化
      if (isWebviewReadyMessage(res, this.channel)) {
        this.startConnector(webview);
        return;
      }
      if (res.channel !== this.channel) {
        return;
      }
      this.listeners.forEach((callback) => {
        callback(res.data, webview);
      });
    });
  }

  private startConnector(webview: Webview): void {
    this.webviewReady.set(webview, true);
    this.pendingDataList.get(webview)?.forEach((data) => this.send(webview, data));
    this.pendingDataList.delete(webview);
  }
}

/**
 * 单webview通信器
 */
export class SingleWebviewConnector<T = unknown, R = T> {
  /**
   * webview端通信器是否激活
   */
  private webviewReady = false;

  /**
   * webview端通信器激活前暂存的消息
   */
  private pendingDataList: T[] = [];

  constructor(private channel: ConnectChannel, private webview: Webview, callback?: (res: R) => void) {
    webview.onDidReceiveMessage((res) => {
      // 客户端初始化
      if (isWebviewReadyMessage(res, this.channel)) {
        this.startConnector();
        return;
      }
      if (res.channel !== this.channel) {
        return;
      }
      callback?.(res.data);
    });
    this.sendExtensionReady();
  }

  public send(data: T): void {
    if (this.webviewReady) {
      this.webview.postMessage({ channel: this.channel, data });
    } else {
      this.pendingDataList.push(data);
    }
  }

  public reload(): void {
    this.webviewReady = false;
    this.pendingDataList = [];
    this.sendExtensionReady();
  }

  private startConnector(): void {
    this.webviewReady = true;
    this.pendingDataList.forEach((data) => this.send(data));
    this.pendingDataList = [];
  }

  private sendExtensionReady(): void {
    this.webview.postMessage({ channel: CONNECTOR_READY_CHANNEL, data: this.channel });
  }
}

function isWebviewReadyMessage(message: ConnectMessage, channel: ConnectChannel): boolean {
  return message.channel === CONNECTOR_READY_CHANNEL && message.data === channel;
}
