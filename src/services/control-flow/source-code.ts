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
import { CodeSnippetDocument, GetSnippetDocumentTag } from '../../types/control-flow/source-code';

/**
 * 获取代码片段
 * @param programUri 源代码指定文件地址
 * @param startLine 源代码起始行
 * @param endLine 源代码终止行
 * @returns 代码片段
 */
export async function readLinesByTextDocument(programUri: vscode.Uri, startLine: number, endLine: number): Promise<CodeSnippetDocument> {
  try {
    // 1. 后台打开文件处理编码
    const document = await vscode.workspace.openTextDocument(programUri);

    // 2. 行号转换：1-based → 0-based（TextDocument 行号从 0 开始）
    const startIdx = Math.max(0, startLine - 1);
    const endIdx = Math.min(document.lineCount - 1, endLine - 1);

    if (startIdx > endIdx) {
      return {
        isSuccessful: GetSnippetDocumentTag.IS_NO_LINE,
        document: '读取失败：源码已修改，找不到对应代码行', //国际化在前端适配
      };
    }

    // 3. 提取指定行
    const targetLines: string[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      targetLines.push(document.lineAt(i).text);
    }

    // 4. 用文件原始换行符拼接（document.eol 自动识别换行类型）
    const lineSeparator = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    return {
      isSuccessful: GetSnippetDocumentTag.IS_SUCCESSFUL,
      document: targetLines.join(lineSeparator),
    };
  } catch (error) {
    return {
      isSuccessful: GetSnippetDocumentTag.IS_NO_FILE,
      document: programUri.path,
    };
  }
}

/**
 * 分屏打开源代码指定行
 * @param fileUri 跳转指定文件地址
 * @param targetLine 跳转指定行
 */
export async function openTargetFileInSplit(fileUri: vscode.Uri, targetLine: number) {
  try {
    // 加载文件（异步，需 await）
    const document = await vscode.workspace.openTextDocument(fileUri);

    // 分屏显示（ViewColumn.Beside = 当前编辑器旁分屏）
    const editor = await vscode.window.showTextDocument(document, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false, // 新分屏获取焦点
    });

    // 跳转到目标行（1 索引 → 0 索引）
    const targetPos = new vscode.Position(targetLine - 1, 0);
    const targetRange = new vscode.Range(targetPos, targetPos);

    editor.selection = new vscode.Selection(targetPos, targetPos);
    editor.revealRange(targetRange, vscode.TextEditorRevealType.InCenter);
  } catch (error) {
    const errMsg = (error as Error).message;
    vscode.window.showErrorMessage(errMsg);
  }
}
