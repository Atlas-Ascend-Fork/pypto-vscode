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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import type { Data } from '../types';

import { SqlStoreManager } from './sql-store-manager';

export class DataFileController<Item extends Data> {
  private _storeDirUri: vscode.Uri;
  private _storeDirPath: string;

  constructor(storeName: string) {
    this._storeDirUri = SqlStoreManager.getInstance().toUri(storeName);
    this._storeDirPath = this._storeDirUri.fsPath;
    fs.mkdirSync(this._storeDirPath, { recursive: true });
  }

  public async read(fileName: string): Promise<Item | undefined> {
    const filePath = path.join(this._storeDirPath, fileName);
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(content, reviveDateInJson);
    } catch {
      return;
    }
  }

  public async write(item: Item, fileName: string): Promise<void> {
    const filePath = path.join(this._storeDirPath, fileName);
    await fs.promises.writeFile(filePath, JSON.stringify(item), 'utf8');
    return;
  }

  public async delete(fileName: string): Promise<void> {
    const filePath = path.join(this._storeDirPath, fileName);
    await fs.promises.unlink(filePath);
    return;
  }

  public async clear(): Promise<void> {
    try {
      await fs.promises.rm(this._storeDirPath, { recursive: true, force: true });
    } catch {
      // 目录可能已被并发清理
    }
    await fs.promises.mkdir(this._storeDirPath, { recursive: true });
    return;
  }
}

const DATE_STR_REG_EXP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;

function reviveDateInJson(_: string, value: unknown): unknown {
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
