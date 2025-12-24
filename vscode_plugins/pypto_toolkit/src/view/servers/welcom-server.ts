import path from 'node:path';

import * as vscode from 'vscode';

import { viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { extensionContext } from '../../extension';
type Apis = never;
type Refs = { skipAll: boolean };

// 定义持久化存储的 key，便于统一管理
const SKIP_ALL_STORAGE_KEY = 'welcomeView.skipAll';

@viewRefs(['skipAll'])
export class WelcomeViewServer extends ViewServer<Apis, Refs> {
  static skipGuide: () => void;
  private fileUri: vscode.Uri;
  public override created(ctx: ViewServerContext): void {
    // 1. 初始化 skipAll：从持久化存储读取，无值则设为 false
    const initialSkipAll = extensionContext?.globalState.get<boolean>(SKIP_ALL_STORAGE_KEY, false);
    this.setRef('skipAll', initialSkipAll);
    WelcomeViewServer.skipGuide = () => {
      // 更新内存中的 ref 值
      this.setRef('skipAll', true);
      // 持久化到 globalState（VS Code 会自动保存）
      extensionContext?.globalState.update(SKIP_ALL_STORAGE_KEY, true);
    };
  }
}
