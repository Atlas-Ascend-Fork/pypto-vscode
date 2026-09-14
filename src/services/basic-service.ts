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
import * as vscode from 'vscode';

const startedServices = new Set<string>();

export class BasicService extends vscode.Disposable {
  protected _disposables: vscode.Disposable[] = [];

  constructor(public name: string) {
    super(() =>
      this._disposables.forEach((item) => {
        return item.dispose();
      }),
    );
    if (this.isStartedService()) {
      this.multiInstantiateError();
    }
    this.recordStartedService();
  }

  protected isStartedService(): boolean {
    return startedServices.has(this.name);
  }

  private multiInstantiateError() {
    throw new Error(`进程中只允许实例化一次service，${this.name} 已存在`);
  }

  private recordStartedService() {
    startedServices.add(this.name);
  }
}
