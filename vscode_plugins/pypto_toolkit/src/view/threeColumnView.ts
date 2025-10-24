import { Uri, ViewColumn, commands, window, WebviewPanel, workspace } from 'vscode';
import { hismartliteEx } from '../hismarliteEx';
import { Util } from '../util';
import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';
import { SingleGraphHandler } from '../handler/singleGraphHandler';
import * as vscode from 'vscode';
import { MsgHandler, SwimData } from './swimGraphView';
import { Fider } from './threeColumnEntry';
import { SingleGraphData } from '../core/graphData';

class codeMsgHandler {
  static getPyCode(panel: any) {
    const codePath = panel.codePath;
    let code = '';
    try {
      code = readFileSync(codePath, 'utf8');
    } catch (err) {
      console.error(`${codePath}读取 py 文件时发生错误:`, err);
    }
    panel.webview.postMessage({
      command: 'returnPyCode',
      data: { code, codePath },
    });
  }

  static savePyCode(panel: any, code: string) {
    const codePath = panel.codePath;

    try {
      // 保存代码到文件
      writeFileSync(codePath, code, 'utf8');
      
      // 通知前端保存成功
      panel.webview.postMessage({
        command: 'saveSuccess',
        data: 'Code saved successfully'
      });

      console.log(`Code saved to: ${codePath}`);
    } catch (err: any) {
      console.error(`保存文件时发生错误:`, err);
      
      // 通知前端保存失败
      panel.webview.postMessage({
        command: 'saveError',
        data: err.message
      });
    }
  }
}

class comGraphHandler extends SingleGraphHandler {
  static searchFuncHashInProject(panel, funcHash: string) {
    vscode.workspace.findFiles(`**/*${funcHash}*.json`).then(fileList => {
      const res = fileList.map(uri => uri.fsPath);
      panel.webview.postMessage({
        type: 'getFuncHashFileList',
        data: res,
      });
    });    
  }
  static override async loadMainData(panel: any): Promise<void> {
      if (!panel.comGraphData) {
        panel.comGraphData = new SingleGraphData(panel.comPath, panel.funcHash, panel.calleeOpMagic, panel.calleeOpSubgraphId);
      }
  
      const gd = panel.comGraphData as SingleGraphData;
      if (!gd.funcHash) {
        gd.funcHash = await SingleGraphData.getEntryHash(gd.fsPath);
      }
    }
}

class swimGrapHandler extends MsgHandler {

}

export class ThreeColumnGraphView {
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  public panel: any;
  codePath: string;
  swimPath?: string;
  comPath?: string;

  constructor(panel: WebviewPanel, codeUri: Uri, swimUri?: Uri, comgraphUri?: Uri) {
    this.title = 'multiple graph';
    this.isReveal = false;
    this._disposables = [];
    this.codePath = codeUri.fsPath;
    this.swimPath = swimUri?.fsPath;
    this.comPath = comgraphUri?.fsPath;

    this.panel = panel;
    this.panel.codeMsgHandler = codeMsgHandler;
    this.panel.comgraphHanlder = comGraphHandler;
    this.panel.swimgraphHandler = swimGrapHandler;
    this.panel.codePath = this.codePath;
    this.initWebViewPanel();

    const context: any = hismartliteEx.context;
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.onDispose();
      },
      null,
      context.subscriptions
    );
    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        const panel: any = this.panel;
        if (message.command === 'getInitialData') {
          panel.webview.postMessage({
            command: 'setThreeColumnMode'
          });
        }
        if (panel.codeMsgHandler[message.command]) {
          panel.codeMsgHandler[message.command](panel, message.paramObj);
        }
        if (panel.comgraphHanlder[message.command]) {
          panel.comgraphHanlder[message.command](panel, message.paramObj);
        }
        if (panel.swimgraphHandler[message.command]) {
          panel.swimgraphHandler[message.command](panel, message.paramObj);
        }
      },
      undefined,
      this._disposables
    );
  }

  // 初始化自动关联路径
  async initRelativePath(
    codePath: string,
    swimPath: string | undefined,
    comPath: string | undefined
  ): Promise<{ codePath: string; swimPath: string | undefined; comPath: string | undefined }> {
    const ret = await new Fider(codePath).findByCodePath(swimPath, comPath);
    return { codePath, ...ret };
  }

  public static createPanel(ucodeUri: Uri, swimUri?: Uri, comgraphUri?: Uri) {
    const titleNameMatch = ucodeUri.path.match(/\/([^\/]+)\.py$/);
    let titleName = "linkage mode default";
    if (titleNameMatch) {
      titleName = titleNameMatch[1];
    }
    const panel = window.createWebviewPanel(
      'threeColumn',
      titleName,
      ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      },
    );
    new ThreeColumnGraphView(panel, ucodeUri, swimUri, comgraphUri);

    window.onDidChangeActiveColorTheme(() => {
       panel.webview.postMessage({
        command: 'returnTheme',
        data: getIDETheme(),
      });
    });
  }

  public static revive(panel: WebviewPanel, uri: Uri) {
    new ThreeColumnGraphView(panel, uri);
  }

  private async refreshPanel() {
    if (this.panel) {
      if (this.panel.title === this.title) {
        await this.msgHandler.refreshDetail(this.panel);
      } else {
        await this.initWebViewPanel();
      }
      this.panel.title = this.title;
    }
  }

  async initWebViewPanel() {
    if (!this.swimPath || !this.comPath) {
      const { swimPath, comPath } = await this.initRelativePath(this.codePath, this.swimPath, this.comPath);
      if (!swimPath || !comPath) {
        return;
      }
      this.panel.swimPath = swimPath;
      this.panel.comPath = comPath;
      this.panel.swimData = new SwimData(Uri.file(swimPath), swimPath);
    }
    let replaceParams: any[] = [];
    const htmlPath = join(hismartliteEx.extensionPath, 'webview-dist', 'index.html');
    let documentText = readFileSync(htmlPath);
    let webviewText = this.panel.webview.asWebviewUri(Uri.file(join(hismartliteEx.extensionPath)));
    let html = documentText.toString()
      .replace(/{{root}}/g, webviewText)
      .replace(/{{staticPath}}/g, `${webviewText}/webview-dist`)
      .replace(/{{ascTheme}}/g, getIDETheme())
      .replace(/{{ascLang}}/g, getIDELang());
    this.panel.webview.html = new Util().replaceHtmlFromData(replaceParams, html);
  }

 private onDispose() {
    this.panel = null;
    this.closeWebViewPanel();
  }

 private closeWebViewPanel() {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}
