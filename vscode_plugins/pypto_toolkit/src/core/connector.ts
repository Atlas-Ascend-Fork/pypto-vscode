import type { Webview } from 'vscode';

/**
 * 通信频道
 * @value request 数据请求
 * @value viewQuery 页面参数
 */
export type ConnectChannel = 'request' | 'viewQuery';

type ExtensionListener<T> = (message: T, webview: Webview) => void;

/**
 * webview通信器（extension端使用）
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
