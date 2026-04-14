import { ExtensionContext, Uri, commands, window } from 'vscode';
import { t as _ } from 'i18next';
const fs = require('fs');
const readline = require('readline');

import { useView } from '../view';
import * as vscode from 'vscode';
import * as path from 'path';

export class RegisterCommand {
  private context: ExtensionContext;
  private editorView;

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
      commands.registerCommand('PyPTO.Open.OpenRenderGraphForCurrent', async (uri: Uri | undefined,) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) {
          window.showErrorMessage(_('pypto.entry.fileTooLarge'));
          return;
        };
        await this.openView('computeGraph', uri, undefined);
      }),
      commands.registerCommand('PyPTO.Open.OpenComGraphByFunchash', async (uri: Uri | undefined, funcHash: string) => {
        if (!uri) return;
        await this.openView('computeGraph', uri, funcHash);
      }),
      commands.registerCommand('PyPTO.Open.OpenDiffComGraphForCurrent', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        await this.openView('diffGraph', uri);
      }),
      commands.registerCommand('PyPTO.Open.OpenComGraphForNodeSearch', async (uri: Uri | undefined, funcHash: string | undefined, nodeMagic: string) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        nodeMagic ??= '-1';
        await this.openView('computeGraph', uri, typeof funcHash === 'string' ? funcHash : undefined, true, nodeMagic);
      }),

      commands.registerCommand('PyPTO.Open.OpenLinkageMode', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        // ThreeColumnGraphView.createPanel(uri);
        const { editorView } = useView();
        await editorView.open('threeColumnGraph', uri);
      }),
      commands.registerCommand('PyPTO.Open.CloseAllToolPages', () => {
        this.closeAllToolPages();
      }),
      commands.registerCommand('PyPto.Open.postLayoutData', (id: string, data: any) => {
        const [serverId, infoStr] = id.split('&&');
        const server = this.editorView.editorView.openServer.get(serverId);
        if (server) {
          server.renderLayout(data, infoStr);
        }
      })
    ];
  }

  async openView(routeName: string, uri: Uri, funcHash?: string, isSearch?: boolean, nodeMagic?: string) {
    const content = ((await this.readFirstNLines(uri.fsPath, 10)) as string[]).join('');
    const { editorView } = useView();
    if (content.includes('entryhash')) {
      const finalQuery = {
        funcHash: funcHash,
        isSearch: isSearch,
        nodeMagic: nodeMagic,
      };
      await editorView.open(routeName, vscode.Uri.file(uri.fsPath), {
        query: finalQuery,
        title:  getBasenameWithoutExt(uri.fsPath),
      });
    } else if (content.includes('traceEvents')) {
      await editorView.open('swimGraph', uri, { title: getBasenameWithoutExt(uri.fsPath) });
    } else {
      window.showInformationMessage(_('pypto.cannotRender'));
    }
  }

  closeAllToolPages() {
    const { editorView } = useView();
    editorView.closeAll();
  }

  register(editorView) {
    this.editorView = editorView;
    this.context.subscriptions.push(...this.getCommands());
  }
}

export function getBasenameWithoutExt(filePath: string): string {
  const basename = path.basename(filePath); // 获取带扩展名的文件名，如 'file.txt'
  return path.parse(basename).name; // 提取不带扩展名的部分，如 'file'
}
