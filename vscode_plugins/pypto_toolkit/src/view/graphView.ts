// src/view/graphView.ts

import * as vscode from 'vscode';
import { join } from 'path';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';
import { hismartliteEx } from '../hismarliteEx';
import { AbstractGraphData } from '../core/graphData';
import { BaseGraphMsgHandler } from '../handler/baseGraphMsgHandler';
import { basename } from 'path';

export interface GraphViewOptions {
  /** 面板类型标识，对应 package.json contributes.views */
  viewType: string;
  /** 显示标题 */
  title: string;
  /** 列区域 */
  column?: vscode.ViewColumn;
  /** 额外图标（可选） */
  iconPath?: vscode.Uri;
  calleeOpMagic?: string;
  calleeOpSubgraphId?: string;
}

/**
 * 通用 Graph Webview 壳
 * T : 具体 GraphData 子类
 * H : 具体 Handler（单图 or 差异）
 */
export class GraphView<T extends AbstractGraphData> {
  public title: string;  
  private panel?: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private options: GraphViewOptions,
    /** 工厂：如何把 fsPath+funcHash 变成 T 实例 */
    private dataCtor: new (fsPath: string, funcHash?: string, calleeOpMagic?: string, calleeOpSubgraphId?: string) => T,
    /** 工厂：对应哪个 Handler（SingleGraphHandler | DiffGraphHandler） */
    private handler: typeof BaseGraphMsgHandler,
  ) {}

  /** 外部唯一入口 */
  async createPanel(
    fsPath: string,
    funcHash?: string,
    curPath?: string,
    existingPanel?: vscode.WebviewPanel,
    magicName?: string ,
    calleeOpMagic?: string, 
    calleeOpSubgraphId?: string, 
    outputDirPath?: string,
    pathName?: string
  ): Promise<vscode.WebviewPanel> {
    // 1. 如果已存在，直接复用
    if (existingPanel) {
      this.panel = existingPanel;
      this.title = this.panel.title;
      console.debug('GraphView createPanel 复用原有Panel');
    } else {
      console.debug('GraphView createPanel 新建Panel');
      this.panel = vscode.window.createWebviewPanel(
        this.options.viewType,
        magicName || basename(fsPath),
        this.options.column ?? vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(join(hismartliteEx.extensionPath, 'webview-dist'))],
        },
      );
    }

    // 2. 把数据挂到 panel 上
    console.debug('GraphView createPanel 原始数据挂载');
    this.panel.webview.html = await this.getHtmlContent();
    (this.panel as any).graphData = new this.dataCtor(fsPath, funcHash, calleeOpMagic,calleeOpSubgraphId);
    (this.panel as any).fsPath = fsPath;
    (this.panel as any).outputDirPath = outputDirPath;
    (this.panel as any).pathName = pathName;
    (this.panel as any).funcHash = funcHash;
    (this.panel as any).calleeOpMagic = calleeOpMagic;
    (this.panel as any).calleeOpSubgraphId = calleeOpSubgraphId;
    (this.panel as any).curPath = curPath;

    // 3. 注册生命周期
    console.debug('GraphView createPanel 注册生命周期');
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage((msg) => this.onMessage(msg), undefined, this.disposables);

    // 4. 主题变化自动刷新
    vscode.window.onDidChangeActiveColorTheme(
      () => this.panel!.webview.postMessage({ command: 'returnTheme', data: getIDETheme() }),
      null,
      this.disposables,
    );

    return this.panel;
  }

  static revive<T extends AbstractGraphData>(
    panel: vscode.WebviewPanel,
    dataCtor: new (p: string, h?: string, opM?: string, opSg?: string) => T,
    handler: typeof BaseGraphMsgHandler,
    fsPath: string,
    funcHash?: string,
    magicName?: string,
    curPath?: string,
    calleeOpMagic?: string,
    calleeOpSubgraphId?: string,
    outputDirPath?: string,
    pathName?: string
  ): GraphView<T> {
    const view = new GraphView<T>(
      {
        viewType: panel.viewType,
        title: panel.title,
        calleeOpMagic,
        calleeOpSubgraphId,
      },
      dataCtor,
      handler,
    );
    view.panel = panel; // 复用旧 panel
    void view.createPanel(fsPath, funcHash,curPath,panel,magicName,calleeOpMagic,calleeOpSubgraphId, outputDirPath, pathName);
    return view;
  }

  static reviveDiffGraph<T extends AbstractGraphData>(
    panel: vscode.WebviewPanel,
    dataCtor: new (p: string, h?: string, opM?: string, opSg?: string) => T,
    handler: typeof BaseGraphMsgHandler,
    fsPath: string,
    funcHash?: string,
    magicName?: string,
    curPath?: string,
  ): GraphView<T> {
    const view = new GraphView<T>(
      {
        viewType: panel.viewType,
        title: panel.title,
        column: vscode.ViewColumn.One,
      },
      dataCtor,
      handler,
    );
    view.panel = panel; // 复用旧 panel
    void view.createPanel(fsPath,funcHash,curPath,panel,magicName);
    return view;
  }
  /* --------------------------------------------------
   * 私有：HTML 注入
   * -------------------------------------------------- */
  private async getHtmlContent(): Promise<string> {
    const baseUri = this.panel!.webview.asWebviewUri(vscode.Uri.file(join(hismartliteEx.extensionPath)));
    const htmlPath = vscode.Uri.file(join(hismartliteEx.extensionPath, 'webview-dist', 'index.html'));
    const document = await vscode.workspace.fs.readFile(htmlPath);
    return document
      .toString()
      .replace(/{{root}}/g, baseUri.toString())
      .replace(/{{staticPath}}/g, `${baseUri}/webview-dist`)
      .replace(/{{ascTheme}}/g, getIDETheme())
      .replace(/{{ascLang}}/g, getIDELang());
  }

  /* --------------------------------------------------
   * 私有：消息转发 → Handler
   * -------------------------------------------------- */
  private onMessage(msg: any) {
    const cmd = msg.command;

    // 1. 拦截所有非业务命令
    if (!BaseGraphMsgHandler.WHITE_COMMANDS.has(cmd)) {
      return;
    }
    console.log(`[GraphView] business command: ${cmd}   type:${msg.type}`);
    if (this.handler[cmd]) {
      this.handler[cmd](this.panel, msg.paramObj);
    }
  }

  /* --------------------------------------------------
   * 释放资源
   * -------------------------------------------------- */
  private dispose() {
    const webviews: any = hismartliteEx.webviews;
    delete webviews[this.options.title];
    if (Object.keys(webviews).length <= 0) {
      BaseGraphMsgHandler.globalCallInOutTensorMap.clear();
    }
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
