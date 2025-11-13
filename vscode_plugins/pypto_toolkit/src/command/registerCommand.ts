import { ExtensionContext, Uri, ViewColumn, commands, window } from 'vscode';
import { t as _ } from 'i18next';
import { SwimGraphView } from '../view/swimGraphView';
const fs = require('fs');
const readline = require('readline');

import { useView } from '../view';
import * as vscode from 'vscode';
import { ThreeColumnGraphView } from '../view/threeColumnView';

export class RegisterCommand {
  private context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  readFirstNLines(filePath, n) {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      const lineReader = readline.createInterface({
        input: stream,
        crlfDelay: Infinity, // 正确处理不同平台的换行符
      });
      let lines: string[] = [];
      let lineCount = 0;
      lineReader.on('line', (line) => {
        lines.push(line);
        lineCount++;
        if (lineCount >= n) {
          lineReader.close(); // 达到所需行数，停止读取
          lineReader.removeAllListeners();
          stream.destroy();
        }
      });
      lineReader.on('close', () => {
        resolve(lines); // 返回读取的行
      });
      lineReader.on('error', (err) => {
        reject(err); // 处理读取过程中可能出现的错误
      });
    });
  }

  getCommands() {
    return [
      commands.registerCommand('PyPTO.OpenRenderGraphForCurrent', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        await this.openView('computeGraph', uri);
      }),
      commands.registerCommand('PyPTO.OpenComGraphByFunchash', async (uri: Uri | undefined, funcHash: string) => {
        if (!uri) return;
        await this.openView('computeGraph', uri, funcHash);
      }),
      commands.registerCommand('PyPTO.OpenDiffComGraphForCurrent', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        await this.openView('diffGraph', uri);
      }),

      commands.registerCommand('PyPTO.OpenLinkageMode', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        // ThreeColumnGraphView.createPanel(uri);
        const { editorView } = useView();
        await editorView.open('threeColumnGraph', uri);
      }),
    ];
  }

  async openView(routeName: string, uri: Uri, funcHash?: string) {
    const content = ((await this.readFirstNLines(uri.fsPath, 10)) as string[]).join('');
    const { editorView } = useView();
    if (content.includes('entryhash')) {
      const finalQuery = {
        funcHash: funcHash,
      };
      await editorView.open(routeName, vscode.Uri.file(uri.fsPath), { query: finalQuery });
    } else if (content.includes('traceEvents')) {
      await editorView.open('swimGraph', (uri));
    } else {
      window.showInformationMessage(_('pypto.cannotRender'));
    }
  }

  register() {
    this.context.subscriptions.push(...this.getCommands());
  }
}
