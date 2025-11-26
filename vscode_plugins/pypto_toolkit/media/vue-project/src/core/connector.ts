import type { ConnectChannel } from 'ext:/core/connector';
import { CONNECTOR_READY_CHANNEL } from 'ext:/core/connector';

import { vscode } from './vscode';

type WebviewListener<T> = (message: T) => void;

/**
 * extension通信器（webview端使用）
 */
export class ExtensionConnector<T = unknown, R = T> {
  private listeners: WebviewListener<R>[] = [];

  constructor(private channel: ConnectChannel) {
    window.addEventListener('message', (event) => {
      const res = event.data;
      if (res.channel !== channel) {
        return;
      }
      this.listeners.forEach((callback) => {
        callback(res.data);
      });
    });
    vscode.value.postMessage({ channel: CONNECTOR_READY_CHANNEL, data: this.channel });
  }

  public send(message: T): void {
    vscode.value.postMessage({ channel: this.channel, data: message });
  }

  public receive(callback: WebviewListener<R>): void {
    this.listeners.push(callback);
  }
}
