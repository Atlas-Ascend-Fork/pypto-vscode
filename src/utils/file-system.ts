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
import * as fs from 'fs';
const readline = require('readline');

export function isFilePathExists(filePath: string): Promise<boolean> {
  const fileUri = vscode.Uri.file(filePath);
  return isFileUriExists(fileUri);
}

/**
 * 判断文件或目录是否存在
 */
export async function isFileUriExists(fileUri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(fileUri);
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除文件
 */
export async function deleteFile(fileUri: vscode.Uri): Promise<void> {
  try {
    if (await isFileUriExists(fileUri)) {
      await vscode.workspace.fs.delete(fileUri, { recursive: true });
    }
  } catch (error) {
    console.error(error)
  }
}

/**
 * 返回前n行数据
 */
export function readFirstNLines(filePath: string, n: number) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    const lineReader = readline.createInterface({
      input: stream,
      crlfDelay: Infinity, // 正确处理不同平台的换行符
    });
    let lines: string[] = [];
    let lineCount = 0;
    lineReader.on('line', (line) => {
      lines.push(line);
      lineCount++;
      if (lineCount >= n) {
        lineReader.close(); // 达到所需行数，停止读取
        lineReader.removeAllListeners();
        stream.destroy();
      }
    });
    lineReader.on('close', () => {
      resolve(lines); // 返回读取的行
    });
    lineReader.on('error', (err) => {
      reject(err); // 处理读取过程中可能出现的错误
    });
  });
}