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
