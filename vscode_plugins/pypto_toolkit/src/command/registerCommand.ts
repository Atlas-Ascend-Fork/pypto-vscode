import { ExtensionContext, Uri, ViewColumn, commands, window } from 'vscode';
import { t as _ } from 'i18next';
import { ComGraphView } from '../view/comGraphView';
import { DiffComGraphView } from '../view/diffComGraphView';
import { SwimGraphView } from '../view/swimGraphView';
import { loadMaterialColorUtilities } from '../color-list';
const fs = require('fs');
const readline = require('readline');

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
            crlfDelay: Infinity // 正确处理不同平台的换行符
        });

        let lines: string[]= [];
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
        await loadMaterialColorUtilities();
        if (!uri && window.activeTextEditor) {
          uri = window.activeTextEditor.document.uri;
        }

        if (uri) {
          this.readFirstNLines(uri.fsPath, 10).then((content: any) => {
            const allContent = content.join('');
            if (allContent.includes('entryhash')) {
              new ComGraphView(ViewColumn.One).createPanel(uri.fsPath, undefined, undefined, undefined);
            } else if (allContent.includes('traceEvents')) {
              SwimGraphView.createPanel(uri);
            } else {
              window.showInformationMessage(_('pypto.cannotRender'));
            }
          })
        }
      }),
      commands.registerCommand('PyPTO.OpenComGraphByFunchash', async (uri: Uri | undefined, funcHash: string) => {
        await loadMaterialColorUtilities();
        if (uri) {
          new ComGraphView(ViewColumn.One).createPanel(uri.fsPath, funcHash, 'swimGraphJump', undefined);
        }
      }),
      commands.registerCommand('PyPTO.OpenDiffComGraphForCurrent', async (uri: Uri | undefined) => {
        await loadMaterialColorUtilities();
        if (!uri && window.activeTextEditor) {
          uri = window.activeTextEditor.document.uri;
        }

        if (uri) {
          this.readFirstNLines(uri.fsPath, 10).then((content: any) => {
            const allContent = content.join('');
            if (allContent.includes('entryhash')) {
              new DiffComGraphView(ViewColumn.One).createPanel(uri.fsPath, undefined);
            } else {
              window.showInformationMessage(_('pypto.cannotRender'));
            }
          })
        }
      }),
    ]
  }

  register() {
    this.context.subscriptions.push(
      ...this.getCommands(),
    )
  }
}
