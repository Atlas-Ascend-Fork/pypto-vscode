import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {hismartliteEx} from '../hismarliteEx';
import {getIDETheme} from '../theme';
import {getIDELang} from '../lang';
import {Util} from '../util';
import {useView} from "./index";
import {ExtensionApiServer} from '../core/server';

export class SidebarViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'PyPTO-Toolkit-Sidebar';
    public websidePanel: vscode.Webview;
    private extensionUri: string;

    constructor(
        private readonly _extensionUri: vscode.Uri,// 插件所在路径
        private servers: ExtensionApiServer,
    ) {
        this.extensionUri = _extensionUri.toString();

    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        webviewView.webview.options = {
            enableScripts: true, // 允许脚本
            localResourceRoots: [this._extensionUri] // 允许加载本地资源的路径
        };

        this.websidePanel = webviewView.webview;
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        this.servers.addWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (message) => {

            if (message.command === 'getInitialData') {
                webviewView.webview.postMessage({
                    command: 'returnSidBar',
                })
            }
            if (message.command === 'openGraphView') {
                const {editorView} = useView();
                try {
                    const url = vscode.Uri.parse(message.data.absolutepath).with({
                        query: JSON.stringify({
                            url: message.data.outputpath
                        })
                    })
                    const webviewPanel = await editorView.open('controlFlow', url);

                } catch (e) {
                    console.log('controlFlow err', e)
                }
            }
        })


    }
    private _getHtmlForWebview(webview: vscode.Webview) {
        let replaceParams: any[] = [];
        // 打包的前端页面资源的路径
        const guiSidebarPath = vscode.Uri.joinPath(this._extensionUri, '/webview-dist');

        // 前端页面的入口文件
        const indexPath = vscode.Uri.joinPath(guiSidebarPath, '/index.html');

        let indexHtml = fs.readFileSync(indexPath.fsPath, 'utf-8');
        let webviewText = webview.asWebviewUri(vscode.Uri.file(path.join(hismartliteEx.extensionPath)));

        let html = indexHtml.toString()
            .replace(/{{root}}/g, webviewText)
            .replace(/{{staticPath}}/g, `${webviewText}/webview-dist`)
            .replace(/{{ascTheme}}/g, getIDETheme())
            .replace(/{{ascLang}}/g, getIDELang());
        const sideHtml = new Util().replaceHtmlFromData(replaceParams, html);
        // 将本地资源路径替换成 webview 可以加载的资源路径
        return sideHtml

    }

}