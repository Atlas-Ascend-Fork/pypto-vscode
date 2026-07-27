/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { ExtensionContext, Uri, commands, window } from 'vscode';
import { t as _ } from 'i18next';

import { readFirstNLines } from '../utils/file-system';
import { useView } from '../view';
import * as vscode from 'vscode';
import * as path from 'path';
import { readCsv, getCsvData } from '../common/csvReader';
import * as fs from 'fs';
import { SwimGraphMsgHandler } from '../handler/swimGraphMsgHandler';

export class RegisterCommand {
  private context: ExtensionContext;
  private editorView;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  getCommands() {
    return [
      commands.registerCommand('PyPTO.readCsv', async () => {
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
      }),
      commands.registerCommand('PyPTO.getCsvData', async () => {
        getCsvData('');
      }),
      commands.registerCommand('PyPTO.Open.OpenGmMemoryVisualization', async (uri: Uri | undefined) => {
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
      }),
      commands.registerCommand('PyPTO.Open.OpenRenderGraphForCurrent', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) {
          window.showErrorMessage(_('pypto.entry.fileTooLarge'));
          return;
        }
        await this.openView('computeGraph', uri, undefined);
      }),
      commands.registerCommand('PyPTO.Open.OpenComGraphByFunchash', async (uri: Uri | undefined, funcHash: string, fileType?: string, cmpCsvPath?: string, loopInfo?: string, rootFuncHash?: string, pathFunchash?: string) => {
        if (!uri) return;
        await this.openView('computeGraph', uri, funcHash, undefined, undefined, fileType, cmpCsvPath, loopInfo, rootFuncHash, pathFunchash);
      }),
      commands.registerCommand('PyPTO.Open.OpenDiffComGraphForCurrent', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        await this.openView('diffGraph', uri);
      }),
      commands.registerCommand(
        'PyPTO.Open.OpenComGraphForNodeSearch',
        async (uri: Uri | undefined, funcHash: string | undefined, nodeMagic: string) => {
          if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
          if (!uri) return;
          nodeMagic ??= '-1';
          await this.openView('computeGraph', uri, typeof funcHash === 'string' ? funcHash : undefined, true, nodeMagic);
        },
      ),

      commands.registerCommand('PyPTO.Open.OpenLinkageMode', async (uri: Uri | undefined) => {
        if (!uri && window.activeTextEditor) uri = window.activeTextEditor.document.uri;
        if (!uri) return;
        const { editorView } = useView();
        await editorView.open('threeColumnGraph', uri);
      }),
      commands.registerCommand('PyPTO.Open.OpenSwimGraph', async (swimPath: string, seqNo: number, taskId: number) => {
        if (!swimPath) return;
        const uri = vscode.Uri.file(swimPath);
        const { editorView } = useView();
        let existingServer: any = null;
        for (const [, server] of editorView.openServer) {
          if (server.swimDataPath && server.swimDataPath.toLowerCase() === swimPath.toLowerCase() && typeof server.locateNode === 'function') {
            existingServer = server;
            break;
          }
        }
        if (existingServer) {
          existingServer.locateNode(seqNo, taskId);
          return;
        }
        SwimGraphMsgHandler.setEventToLocate(seqNo, taskId);
        await editorView.open('swimGraph', uri, { title: getBasenameWithoutExt(swimPath) });
        const serverKey = `${swimPath}__`;
        const server = editorView.openServer.get(serverKey);
        if (server && typeof server.locateNode === 'function') {
          SwimGraphMsgHandler.consumeEventToLocate();
          server.locateNode(seqNo, taskId);
        }
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
      }),
    ];
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
