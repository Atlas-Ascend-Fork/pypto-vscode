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

import type { Data } from '../types';

import { SqlStoreManager } from './sql-store-manager';
import { isFileUriExists } from '../../../utils/file-system';

export class DataFileController<Item extends Data> {
  private _storeDirUri: vscode.Uri;

  constructor(storeName: string) {
    this._storeDirUri = SqlStoreManager.getInstance().toUri(storeName);
    vscode.workspace.fs.createDirectory(this._storeDirUri);
  }

  public async read(fileName: string): Promise<Item | undefined> {
    const fileUri = vscode.Uri.joinPath(this._storeDirUri, fileName);
    if (!(await isFileUriExists(fileUri))) {
      return;
    }
    const fileContent = (await vscode.workspace.fs.readFile(fileUri)).toString();
    try {
      return JSON.parse(fileContent, reviveDateInJson);
    } catch {
      return;
    }
  }

  public async write(item: Item, fileName: string): Promise<void> {
    const fileUri = vscode.Uri.joinPath(this._storeDirUri, fileName);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(item), 'utf8'));
    return;
  }

  public async delete(fileName: string): Promise<void> {
    const fileUri = vscode.Uri.joinPath(this._storeDirUri, fileName);
    await vscode.workspace.fs.delete(fileUri);
    return;
  }

  public async clear(): Promise<void> {
    await vscode.workspace.fs.delete(this._storeDirUri, { recursive: true });
    return;
  }
}

const DATE_STR_REG_EXP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

function reviveDateInJson(_: string, value: unknown) {
  if (typeof value === 'string') {
    const matches = DATE_STR_REG_EXP.exec(value);
    if (matches) {
      return new Date(
        Number(matches[1]),
        Number(matches[2]) - 1,
        Number(matches[3]),
        Number(matches[4]),
        Number(matches[5]),
        Number(matches[6]),
      );
    }
  }
  return value;
}
