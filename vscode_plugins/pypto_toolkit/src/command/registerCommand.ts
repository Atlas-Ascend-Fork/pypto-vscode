import { ExtensionContext, Uri, ViewColumn, commands, window } from 'vscode';
import { t as _ } from 'i18next';
import { SwimGraphView } from '../view/swimGraphView';
import { loadMaterialColorUtilities } from '../color-list';
const fs = require('fs');
const readline = require('readline');
import { GraphView } from '../view/graphView';
import { SingleGraphData, DiffGraphData } from '../core/graphData';
import { SingleGraphHandler } from '../handler/singleGraphHandler';
import { DiffGraphHandler } from '../handler/diffGraphHandler';
import { basename } from 'path';

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
        await loadMaterialColorUtilities();
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;

        const content = ((await this.readFirstNLines(uri.fsPath, 10)) as string[]).join('');
        if (content.includes('entryhash')) {
          new GraphView({ viewType: 'comItemDetailView', title: basename(uri.fsPath) }, SingleGraphData, SingleGraphHandler).createPanel(
            uri.fsPath,
          );
        } else if (content.includes('traceEvents')) {
          SwimGraphView.createPanel(uri);
        } else {
          window.showInformationMessage(_('pypto.cannotRender'));
        }
      }),
      commands.registerCommand('PyPTO.OpenComGraphByFunchash', async (uri: Uri | undefined, funcHash: string) => {
        await loadMaterialColorUtilities();
        if (!uri) return;
        new GraphView({ viewType: 'comItemDetailView', title: 'swimGraphJump' }, SingleGraphData, SingleGraphHandler).createPanel(
          uri.fsPath,
          funcHash,
        );
      }),
      commands.registerCommand('PyPTO.OpenDiffComGraphForCurrent', async (uri: Uri | undefined) => {
        await loadMaterialColorUtilities();
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;

        const content = ((await this.readFirstNLines(uri.fsPath, 10)) as string[]).join('');
        if (content.includes('entryhash')) {
          new GraphView(
            { viewType: 'itemDetailView', title: 'Computation Graph Diff', column: ViewColumn.One },
            DiffGraphData,
            DiffGraphHandler,
          ).createPanel(uri.fsPath);
        } else {
          window.showInformationMessage(_('pypto.cannotRender'));
        }
      }),
    ];
  }

  register() {
    this.context.subscriptions.push(...this.getCommands());
  }
}
