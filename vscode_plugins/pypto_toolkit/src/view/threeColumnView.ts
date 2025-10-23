import { Uri, ViewColumn, commands, window, WebviewPanel, workspace } from 'vscode';
import { hismartliteEx } from '../hismarliteEx';
import { Util } from '../util';
import { join } from 'path';
import { readFileSync} from 'fs';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';
import { SingleGraphHandler } from '../handler/singleGraphHandler';
import { MsgHandler } from './swimGraphView'

class codeMsgHandler {

}

class comGraphHandler extends SingleGraphHandler {
  
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
    this.panel.codeHandler = codeMsgHandler;
    this.panel.comgraphHanlder = comGraphHandler;
    this.panel.swimgraphHandler = swimGrapHandler;
    this.initRelativePath();
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
  initRelativePath() {
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

  initWebViewPanel() {
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



