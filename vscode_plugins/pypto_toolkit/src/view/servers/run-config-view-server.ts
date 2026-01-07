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

  public override created(ctx: ViewServerContext): void {
    this.fileUri = ctx.fileUri!;
    this.setRef('filename', path.basename(this.fileUri.path));
    this.setRef('filepath', this.fileUri.path);
  }

  /**
   * 获取配置元数据
   */
  @viewApi()
  public async getSchema(): Promise<RunConfigSchema | null> {
    this.schema = await getConfigsTemplate();
    return this.schema;
  }

  /**
   * 获取配置
   */
  @viewApi()
  public getConfigData(): Promise<object> {
    return getConfigsForRevise(this.fileUri.path);
  }

  /**
   * 保存配置
   */
  @viewApi()
  public async saveConfigData(data: object): Promise<boolean> {
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
