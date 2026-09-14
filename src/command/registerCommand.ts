/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ExtensionContext, Uri, commands, window } from 'vscode';
import { t as _ } from 'i18next';

import { readFirstNLines } from '../utils/file-system';
import { useView } from '../view';
import * as vscode from 'vscode';
import * as path from 'path';
import { readCsv, getCsvData } from '../common/csvReader';
import * as fs from 'fs';
import * as os from 'os';
import { exec } from 'child_process';
import { SwimGraphMsgHandler } from '../handler/swimGraphMsgHandler';

export class RegisterCommand {
  private context: ExtensionContext;
  private editorView;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  getCommands() {
    return [
      this.registerReadCsv(),
      this.registerGetCsvData(),
      this.registerOpenGmMemoryVisualization(),
      this.registerOpenRenderGraphForCurrent(),
      this.registerOpenComGraphByFunchash(),
      this.registerOpenDiffComGraphForCurrent(),
      this.registerOpenComGraphForNodeSearch(),
      this.registerOpenLinkageMode(),
      this.registerOpenSwimGraph(),
      this.registerCloseAllToolPages(),
      this.registerPostLayoutData(),
      this.registerExecuteRemoteCommand(),
    ];
  }

  private registerReadCsv() {
    return commands.registerCommand('PyPTO.readCsv', async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'CSV Files': ['csv'] },
        openLabel: '选择 CSV 文件',
      });
      const filePath = fileUri?.[0].fsPath ?? undefined;
      if (!filePath || filePath.length === 0) return;
      const type = 4;
      await readCsv(filePath, type);
      getCsvData(filePath, type);
    });
  }

  private registerGetCsvData() {
    return commands.registerCommand('PyPTO.getCsvData', async () => {
      getCsvData('');
    });
  }

  private registerOpenGmMemoryVisualization() {
    return commands.registerCommand('PyPTO.Open.OpenGmMemoryVisualization', async (uri: Uri | undefined) => {
      if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
      if (!uri || path.basename(uri.fsPath) !== 'memory_usage_visualization.json') {
        window.showInformationMessage(_('pypto.cannotRender'));
        return;
      }
      const { editorView } = useView();
      await editorView.open('gmMemoryVisual', vscode.Uri.file(uri.fsPath), {
        query: {},
        title: getBasenameWithoutExt(uri.fsPath),
      });
    });
  }

  private registerOpenRenderGraphForCurrent() {
    return commands.registerCommand('PyPTO.Open.OpenRenderGraphForCurrent', async (uri: Uri | undefined) => {
      if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
      if (!uri) {
        window.showErrorMessage(_('pypto.entry.fileTooLarge'));
        return;
      }
      await this.openView('computeGraph', uri, undefined);
    });
  }

  private registerOpenComGraphByFunchash() {
    return commands.registerCommand('PyPTO.Open.OpenComGraphByFunchash', async (uri: Uri | undefined, funcHash: string, fileType?: string, cmpCsvPath?: string, loopInfo?: string, rootFuncHash?: string, pathFunchash?: string) => {
      if (!uri) return;
      await this.openView('computeGraph', uri, funcHash, undefined, undefined, fileType, cmpCsvPath, loopInfo, rootFuncHash, pathFunchash);
    });
  }

  private registerOpenDiffComGraphForCurrent() {
    return commands.registerCommand('PyPTO.Open.OpenDiffComGraphForCurrent', async (uri: Uri | undefined) => {
      if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
      if (!uri) return;
      await this.openView('diffGraph', uri);
    });
  }

  private registerOpenComGraphForNodeSearch() {
    return commands.registerCommand(
      'PyPTO.Open.OpenComGraphForNodeSearch',
      async (uri: Uri | undefined, funcHash: string | undefined, nodeMagic: string) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        nodeMagic ??= '-1';
        await this.openView('computeGraph', uri, typeof funcHash === 'string' ? funcHash : undefined, true, nodeMagic);
      },
    );
  }

  private registerOpenLinkageMode() {
    return commands.registerCommand('PyPTO.Open.OpenLinkageMode', async (uri: Uri | undefined) => {
      if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
      if (!uri) return;
      const { editorView } = useView();
      await editorView.open('threeColumnGraph', uri);
    });
  }

  private registerOpenSwimGraph() {
    return commands.registerCommand('PyPTO.Open.OpenSwimGraph', async (swimPath: string, seqNo: number, taskId: number) => {
      if (!swimPath) return;
      const uri = vscode.Uri.file(swimPath);
      const { editorView } = useView();
      const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
      const normalizedSwimPath = normalizePath(swimPath);
      let existingServer: any = null;
      for (const [, server] of editorView.openServer) {
        if (server.swimDataPath && normalizePath(server.swimDataPath) === normalizedSwimPath && typeof server.locateNode === 'function') {
          existingServer = server;
          break;
        }
      }
      if (existingServer) {
        await editorView.open('swimGraph', uri, { title: getBasenameWithoutExt(swimPath) });
        existingServer.locateNode(seqNo, taskId);
        return;
      }
      SwimGraphMsgHandler.setEventToLocate(seqNo, taskId);
      await editorView.open('swimGraph', uri, { title: getBasenameWithoutExt(swimPath) });
      for (const [, server] of editorView.openServer) {
        if (server.swimDataPath && normalizePath(server.swimDataPath) === normalizedSwimPath && typeof server.locateNode === 'function') {
          SwimGraphMsgHandler.consumeEventToLocate();
          server.locateNode(seqNo, taskId);
          break;
        }
      }
    });
  }

  private registerCloseAllToolPages() {
    return commands.registerCommand('PyPTO.Open.CloseAllToolPages', () => {
      this.closeAllToolPages();
    });
  }

  private registerPostLayoutData() {
    return commands.registerCommand('PyPto.Open.postLayoutData', (id: string, data: any) => {
      const [serverId, infoStr] = id.split('&&');
      const server = this.editorView.editorView.openServer.get(serverId);
      if (server) {
        server.renderLayout(data, infoStr);
      }
    });
  }

  private registerExecuteRemoteCommand() {
    return commands.registerCommand('PyPTO.ExecuteRemoteCommand', async () => {
      if (os.platform() !== 'linux') {
        vscode.window.showErrorMessage(_('pypto.remoteTool.linuxOnly'));
        return;
      }

      const envCheck = await new Promise<boolean>((resolve) => {
        exec('remote_tool.sh -h', { encoding: 'utf8', timeout: 5000 }, (error) => {
          resolve(!error);
        });
      });
      if (!envCheck) {
        vscode.window.showErrorMessage(_('pypto.remoteTool.notTargetEnv'));
        return;
      }

      const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const userHome = process.env.PYPTO_HOME || process.env.HOME || process.env.USERPROFILE;

      if (!workspace || !userHome) {
        const missingVars = [!workspace && 'workspace folder', !userHome && 'PYPTO_HOME/HOME/USERPROFILE'].filter(Boolean).join(', ');
        vscode.window.showErrorMessage(_('pypto.remoteTool.envVarMissing', { vars: missingVars }));
        return;
      }

      const pullDir = `${workspace},${userHome}/.pypto`;
      const mkdirPaths = `${workspace} ${userHome}/.pypto`;
      const execCommand = `remote_tool.sh exec --command 'mkdir -p ${mkdirPaths}' --pull-dir '${pullDir}'`;

      const result = await new Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }>(
        (resolve) => {
          exec(
            execCommand,
            {
              encoding: 'utf8',
              timeout: 300000,
              maxBuffer: 1024 * 1024 * 10,
            },
            (error, stdout, stderr) => {
              const exitCode = error ? (error as any).code ?? 1 : 0;
              resolve({
                success: !error,
                stdout: (stdout as string).trim(),
                stderr: (stderr as string).trim(),
                exitCode: typeof exitCode === 'number' ? exitCode : 1,
              });
            },
          );
        },
      );

      if (result.success) {
        vscode.window.showInformationMessage(_('pypto.remoteTool.execSuccess'));
      } else {
        vscode.window.showErrorMessage(
          _('pypto.remoteTool.execFailed', { exitCode: result.exitCode, stderr: result.stderr || 'Unknown error' }),
        );
      }
    });
  }

  async openView(routeName: string, uri: Uri, funcHash?: string, isSearch?: boolean, nodeMagic?: string, fileType?: string, cmpCsvPath?: string, loopInfo?: string, rootFuncHash?: string, pathFunchash?: string) {
    const content = ((await readFirstNLines(uri.fsPath, 10)) as string[]).join('');
    const { editorView } = useView();
    if (content.includes('entryhash')) {
      const finalQuery = {
        funcHash: funcHash,
        isSearch: isSearch,
        nodeMagic: nodeMagic,
        fileType: fileType,
        loopInfo: loopInfo,
        outputPath: cmpCsvPath,
        rootFuncHash: rootFuncHash,
        pathFunchash: pathFunchash,
      };
      await editorView.open(routeName, vscode.Uri.file(uri.fsPath), {
        query: finalQuery,
        title: getBasenameWithoutExt(uri.fsPath),
      });
    } else if (content.includes('traceEvents') || content.includes('tasks') || (content.charAt(0) === '[' && content.includes('pid'))) {
      const isPerfSwim = !content.includes('traceEvents') && !content.includes('pid');
      const isMsProf = content.charAt(0) === '[' && content.includes('pid');
      await editorView.open('swimGraph', uri, { title: getBasenameWithoutExt(uri.fsPath), query: { isPerfSwim, isMsProf } });
    } else if (/_OoO_Memory_Trace\.json$/.test(uri.fsPath)) {
      let comGraphPath = uri.fsPath.replace('_OoO_Memory_Trace.json', '.json');
      if (!fs.existsSync(comGraphPath)) {
        window.showErrorMessage(_('pypto.memoryTraceFileNoComGraph'));
      }
      const finalQuery = {
        funcHash: funcHash,
        isSearch: isSearch,
        nodeMagic: nodeMagic,
        memoryPath: uri.fsPath,
      };
      await editorView.open(routeName, vscode.Uri.file(comGraphPath), {
        query: finalQuery,
        title: getBasenameWithoutExt(comGraphPath),
      });
    } else if (path.basename(uri.fsPath) == 'memory_usage_visualization.json') {
      await editorView.open(routeName || "gmMemoryVisual", vscode.Uri.file(uri.fsPath), {
        query: {},
        title: getBasenameWithoutExt(uri.fsPath),
      });
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
