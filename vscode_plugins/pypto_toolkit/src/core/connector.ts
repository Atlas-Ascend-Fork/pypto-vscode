import type { Webview } from 'vscode';

/**
 * 通信频道
 * @value request 数据请求
 * @value viewQuery 页面参数
 * @value viewServerApi 页面服务端 - api方法
 * @value viewServerRef 页面服务端 - 响应式对象
 */
export type ConnectChannel = 'request' | 'viewQuery' | 'viewServerApi' | 'viewServerRef';

type ExtensionListener<T> = (message: T, webview: Webview) => void;

/**
 * 多webview通信器（extension端使用）
 */
export class WebviewConnector<T = unknown, R = T> {
  private listeners: ExtensionListener<R>[] = [];

  constructor(private channel: ConnectChannel) {}

  public send(webview: Webview, message: T): void {
    webview.postMessage({ channel: this.channel, data: message });
  }

  public receive(callback: ExtensionListener<R>): void {
    this.listeners.push(callback);
  }

  public addWebview(webview: Webview): void {
    webview.onDidReceiveMessage((res) => {
      if (res.channel !== this.channel) {
        return;
      }
      this.listeners.forEach((callback) => {
        callback(res.data, webview);
      });
    });
  }
}

/**
 * 单webview通信器
 */
export class SingleWebviewConnector<T = unknown, R = T> {
  constructor(private channel: ConnectChannel, private webview: Webview, callback?: (res: R) => void) {
    webview.onDidReceiveMessage((res) => {
      if (res.channel !== this.channel) {
        return;
      }
      callback?.(res.data);
    });
  }

  public send(message: T): void {
    this.webview.postMessage({ channel: this.channel, data: message });
  }
}
