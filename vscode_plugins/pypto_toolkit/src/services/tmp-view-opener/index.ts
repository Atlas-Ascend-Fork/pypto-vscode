// TODO 当前文件所有代码为临时功能，待实现页面路由后替换
import path from 'node:path';

import * as vscode from 'vscode';
import { t } from 'i18next';

import { useView } from '../../view';
import { useService } from '..';

/**
 * 打开控制流
 */
export async function openControlFlow(params: { outputPath: string; controlFlowPath: string }) {
  const { outputPath, controlFlowPath } = params;
  const controlFlowUri = vscode.Uri.file(controlFlowPath);

  // 标题使用output名称+图类型
  const runDataService = useService('runData');
  const [record] = await runDataService.query().filter({ directoryPath: outputPath }).exec();
  const customTitle = `${record.title} - ${t('PyPTOToolkit.workspace.controlFlowName')}`;

  useView().editorView.open('controlFlow', controlFlowUri, { query: { url: outputPath }, title: customTitle });
}

/**
 * 打开计算图
 */
export async function openComputeGraph(params: { outputPath: string; computeGraphPath: string; pathName: string }) {
  const uri = vscode.Uri.file(params.computeGraphPath);
  const query = { outputDirPath: params.outputPath, pathName: params.pathName };
  useView().editorView.open('computeGraph', uri, { query, title: path.basename(params.computeGraphPath) });
}

/**
 * 打开泳道图
 */
export async function openSwimlaneGraph(params: { swimlaneGraphPath: string }) {
  const uri = vscode.Uri.file(params.swimlaneGraphPath);
  useView().editorView.open('swimGraph', uri);
}
