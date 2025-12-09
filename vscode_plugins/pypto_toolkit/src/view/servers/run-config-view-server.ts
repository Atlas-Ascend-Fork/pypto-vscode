import path from 'node:path';

import * as vscode from 'vscode';

import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { ConfigsForRevise, RunConfigAttribute } from '../../types/config-schema';
import { getConfigsForRevise, getConfigsTemplate, updateConfigsFile } from '../../services/schema-config';

type Apis = 'getSchema' | 'getConfigData' | 'saveConfigData' | 'close' | 'viewSourceFile';
type Refs = { filename: string; filepath: string };

export type RunConfigSchema = Record<string, { label: { zh: string; en: string }; attributes: RunConfigAttribute<any>[] }>;

@viewRefs(['filename', 'filepath'])
export class RunConfigViewServer extends ViewServer<Apis, Refs> {
  private fileUri: vscode.Uri;

  public override created(ctx: ViewServerContext): void {
    this.fileUri = ctx.fileUri!;
    this.setRef('filename', path.basename(this.fileUri.path));
    this.setRef('filepath', this.fileUri.path);
  }

  @viewApi()
  public async getSchema(): Promise<RunConfigSchema> {
    const {
      simulationTemplate,
      passTemplate: { global_configs },
    } = await getConfigsTemplate();
    return {
      pass_global_configs: {
        label: { zh: 'PASS', en: 'PASS' },
        attributes: global_configs as RunConfigAttribute<any>[],
      },
      simulation: {
        label: { zh: '仿真', en: 'simulation' },
        attributes: simulationTemplate,
      },
    };
  }

  @viewApi()
  public getConfigData(): Promise<ConfigsForRevise> {
    return getConfigsForRevise(this.fileUri.path);
  }

  @viewApi()
  public saveConfigData(data: Partial<ConfigsForRevise>): Promise<boolean> {
    return updateConfigsFile({ ...data, path: this.fileUri.path } as ConfigsForRevise);
  }

  @viewApi()
  public close(): void {
    this.closeWebview();
  }

  @viewApi()
  public viewSourceFile(): void {
    vscode.commands.executeCommand('vscode.open', this.fileUri);
  }
}
