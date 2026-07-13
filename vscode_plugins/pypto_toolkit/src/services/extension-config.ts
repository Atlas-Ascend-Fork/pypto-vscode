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

import { BasicService } from './basic-service';

/**
 * VS Code 扩展配置
 */
export class ExtensionConfig extends BasicService {
  constructor(private context: vscode.ExtensionContext) {
    super('extension');
  }

  /** 扩展路径Uri */
  public get extensionUri(): vscode.Uri {
    return this.context.extensionUri;
  }

  /** 扩展路径 */
  public get extensionPath(): string {
    return this.context.extensionPath;
  }
}
