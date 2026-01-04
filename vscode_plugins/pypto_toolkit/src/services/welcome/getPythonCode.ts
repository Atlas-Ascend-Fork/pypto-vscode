import * as vscode from 'vscode';

/**
 * 代码片段/完整文件返回类型
 */
type CodeSnippetDocument = string;

/**
 * 读取文件的完整内容
 * @param programUri 源代码指定文件地址
 * @returns 文件完整内容
 */
export async function readWholeFileByTextDocument(programUri: vscode.Uri): Promise<CodeSnippetDocument> {
  try {
    // 1. 后台打开文件处理编码
    const document = await vscode.workspace.openTextDocument(programUri);

    // 2. 获取文件完整内容
    const wholeFileContent = document.getText();

    return wholeFileContent;
  } catch (error) {
    // 异常处理返回默认代码片段
    return `#!/usr/bin/env python3
# coding: utf-8
# Copyright (c) 2025 Huawei Technologies Co., Ltd.
# This program is free software, you can redistribute it and/or modify it under the terms and conditions of
# CANN Open Software License Agreement Version 2.0 (the "License").
# Please refer to the License for details. You may not use this file except in compliance with the License.
# THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
# INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
# See LICENSE in the root of the software repository for the full text of the License.
# -----------------------------------------------------------------------------------------------------------
"""
Softmax Example for PyPTO

This example demonstrates how to implement a softmax operation using PyPTO, including:
- Manual softmax computation from basic operations
- Dynamic axis marking for variable batch sizes
- Tiling configuration for efficient execution
- Loop-based processing for large tensors

Softmax is a fundamental operation in neural networks, especially for attention mechanisms.
"""`;
  }
}
