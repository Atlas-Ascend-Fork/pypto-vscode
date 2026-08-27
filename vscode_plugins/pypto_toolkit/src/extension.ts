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

export let extensionContext: vscode.ExtensionContext | undefined;
export let sampleManager: any;

export function setExtensionContext(ctx: vscode.ExtensionContext | undefined) {
  extensionContext = ctx;
}

export function setSampleManager(sm: any) {
  sampleManager = sm;
}

let _activate: Function;
let _deactivate: Function;

try {
  const main = require('./extensionMain');
  _activate = main.activate;
  _deactivate = main.deactivate;
  console.log('[PyPTO] Extension main module loaded successfully');
} catch (err) {
  console.error('[PyPTO] CRITICAL: Extension module loading FAILED:', err);
  console.error('[PyPTO] Error stack:', err instanceof Error ? err.stack : 'no stack');
  _activate = async function (context: vscode.ExtensionContext) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`[PyPTO] Extension failed to load: ${msg}`);
  };
  _deactivate = function () {};
}

export async function activate(context: vscode.ExtensionContext) {
  extensionContext = context;
  return _activate(context);
}

export async function deactivate() {
  return _deactivate();
}
