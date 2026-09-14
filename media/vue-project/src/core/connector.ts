/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 */
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
      if (this.isExtensionReadyMessage(res)) {
        this.sendReadyMessage();
        return;
      }
      if (res.channel !== channel) {
        return;
      }
      this.listeners.forEach((callback) => {
        callback(res.data);
      });
    });
    this.sendReadyMessage();
  }

  public send(message: T): void {
    vscode.value.postMessage({ channel: this.channel, data: message });
  }

  public receive(callback: WebviewListener<R>): void {
    this.listeners.push(callback);
  }

  private isExtensionReadyMessage(message: { channel: ConnectChannel; data: unknown }): boolean {
    return message.channel === CONNECTOR_READY_CHANNEL && message.data === this.channel;
  }

  private sendReadyMessage(): void {
    vscode.value.postMessage({ channel: CONNECTOR_READY_CHANNEL, data: this.channel });
  }
}
