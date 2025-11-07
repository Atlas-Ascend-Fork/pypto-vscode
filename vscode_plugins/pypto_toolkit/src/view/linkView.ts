import { Uri, ViewColumn, commands, window, WebviewPanel, workspace } from 'vscode';
import { hismartliteEx } from '../hismarliteEx';
import { Util } from '../util';
import { dirname, join, extname, resolve } from 'path';
import { writeFileSync, existsSync, readFileSync, readdirSync} from 'fs';
import { t } from 'i18next';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';

class LinkData {

  public uri: string;
  public fsPath: string;

  constructor(uri: string, fsPath: string) {
    this.uri = uri;
    this.fsPath = fsPath;
  }
}

class MsgHandler {

  static cachePath: string;

  static getInitialData(panel: any) {
    panel.webview.postMessage({
      command: 'returnLink',
      data: {},
    });
    panel.webview.postMessage({
      command: 'returnTheme',
      data: getIDETheme(),
    });
  }

  static getPyCode(panel: any) {
    const linkUri = panel.linkData.uri;
    const linkPath = panel.linkData.fsPath;

    let code = '';
    try {
      code = readFileSync(linkPath, 'utf8');
    } catch (err) {
      console.error(`${linkPath}读取 py 文件时发生错误:`, err);
    }
    panel.webview.postMessage({
      command: 'returnPyCode',
      data: code
    });
  }

  static savePyCode(panel: any, code: string) {
    const linkPath = panel.linkData.fsPath;

    try {
      // 保存代码到文件
      writeFileSync(linkPath, code, 'utf8');
      
      // 通知前端保存成功
      panel.webview.postMessage({
        command: 'saveSuccess',
        data: 'Code saved successfully'
      });

      console.log(`Code saved to: ${linkPath}`);
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

export class LinkView {
  static defaultTitle: 'Link Mode';
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  public panel: any;

  constructor(panel: WebviewPanel, uri: Uri) {
    this.isReveal = false;
    this._disposables = [];

    this.panel = panel;
    this.panel.linkData = new LinkData(this.panel.webview.asWebviewUri(uri).toString(), uri.fsPath);
    this.panel.msgHandler = MsgHandler;

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
        if (panel.msgHandler[message.command]) {
          panel.msgHandler[message.command](panel, message.paramObj);
        }
      },
      undefined,
      this._disposables
    );
  }

  public static createPanel(uri: Uri) {
    const titleNameMatch = uri.path.match(/\/([^\/]+)\.py$/);
    let titleName = titleNameMatch ? titleNameMatch[1] : LinkView.defaultTitle;
    const panel = window.createWebviewPanel(
      'LinkMode',
      titleName,
      ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      },
    );
    new LinkView(panel, uri);

    window.onDidChangeActiveColorTheme(() => {
       panel.webview.postMessage({
        command: 'returnTheme',
        data: getIDETheme(),
      });
    });
  }

  public static revive(panel: WebviewPanel, uri: Uri) {
    new LinkView(panel, uri);
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
