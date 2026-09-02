/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
