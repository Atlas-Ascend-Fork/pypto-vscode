/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import path from 'node:path';

import { t } from 'i18next';
import * as vscode from 'vscode';

import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { RunConfigSchema } from '../../types/config-schema';
import { getConfigsForRevise, getConfigsTemplate, updateConfigsFile } from '../../services/schema-config';

type Apis = 'getSchema' | 'getConfigData' | 'saveConfigData' | 'cancelEdit' | 'openSourceFile';
type Refs = { filename: string; filepath: string };

@viewRefs(['filename', 'filepath'])
export class RunConfigViewServer extends ViewServer<Apis, Refs> {
  private fileUri: vscode.Uri;

  private schema: RunConfigSchema | null;
  private pendingSchemaRequest: Promise<unknown>;

  public override created(ctx: ViewServerContext): void {
    this.fileUri = ctx.fileUri!;
    this.setRef('filename', path.basename(this.fileUri.path));
    this.setRef('filepath', this.fileUri.path);
    this.pendingSchemaRequest = getConfigsTemplate().then((res) => {
      this.schema = res;
    });
  }

  /**
   * 获取配置元数据
   */
  @viewApi()
  public async getSchema(): Promise<RunConfigSchema | null> {
    await this.pendingSchemaRequest;
    return this.schema;
  }

  /**
   * 获取配置
   */
  @viewApi()
  public async getConfigData(): Promise<Record<string, unknown>> {
    await this.pendingSchemaRequest;
    if (!this.schema) {
      return {};
    }
    return await getConfigsForRevise(this.fileUri.path, this.schema);
  }

  /**
   * 保存配置
   */
  @viewApi()
  public async saveConfigData(data: Record<string, unknown>): Promise<boolean> {
    if (!this.schema) {
      return false;
    }
    const res = await updateConfigsFile(this.fileUri.path, data, this.schema);
    if (res) {
      vscode.window.showInformationMessage(t('PyPTOToolkit.public.savingSuccess'));
    }
    return res;
  }

  /**
   * 取消编辑
   */
  @viewApi()
  public async cancelEdit(): Promise<void> {
    const continueButton = { title: t('PyPTOToolkit.runConfig.confirmCancelButton') };
    const confirmResult = await vscode.window.showInformationMessage<vscode.MessageItem>(
      t('PyPTOToolkit.runConfig.confirmCancelMessage'),
      { modal: true },
      continueButton,
      { title: t('PyPTOToolkit.runConfig.revertCancelButton'), isCloseAffordance: true },
    );
    if (confirmResult === continueButton) {
      this.closeWebview();
    }
  }

  /**
   * 打开源文件
   */
  @viewApi()
  public openSourceFile(): void {
    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(this.fileUri.path));
  }
}
