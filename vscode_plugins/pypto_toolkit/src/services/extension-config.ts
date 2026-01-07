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
