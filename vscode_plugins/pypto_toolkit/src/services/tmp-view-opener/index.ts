// TODO 当前文件所有代码为临时功能，待实现页面路由后替换
import path from 'node:path';

import * as vscode from 'vscode';

import { useView } from '../../view';
import { GraphView } from '../../view/graphView';
import { SingleGraphData } from '../../core/graphData';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { SwimGraphView } from '../../view/swimGraphView';
import { loadMaterialColorUtilities } from '../../color-list';
import { readOutputRunData } from '../workspace/rundata';
import { getOutputRecord } from '../workspace';
import { t } from 'i18next';

/**
 * 打开控制流
 */
export async function openControlFlow(params: { outputPath: string; controlFlowPath: string }) {
  const { outputPath, controlFlowPath } = params;
  const outputUri = vscode.Uri.file(outputPath);
  const controlFlowUri = vscode.Uri.file(controlFlowPath);

  // 标题使用output名称+图类型
  const runData = await readOutputRunData(outputUri);
  const record = getOutputRecord(outputUri, runData);
  const customTitle = `${record.title} - ${t('PyPTOToolkit.workspace.controlFlowName')}`;

  useView().editorView.open('controlFlow', controlFlowUri, { query: { url: outputPath }, title: customTitle });
}

/**
 * 打开计算图
 */
export async function openComputeGraph(params: { outputPath: string; computeGraphPath: string; pathName: string }) {
  await loadMaterialColorUtilities();
  const uri = vscode.Uri.file(params.computeGraphPath);
  new GraphView(
    { viewType: 'comItemDetailView', title: path.basename(params.computeGraphPath) },
    SingleGraphData,
    SingleGraphHandler,
  ).createPanel(uri.fsPath, undefined, undefined, undefined, undefined, undefined, undefined, params.outputPath, params.pathName);
}

/**
 * 打开泳道图
 */
export async function openSwimlaneGraph(params: { swimlaneGraphPath: string }) {
  await loadMaterialColorUtilities();
  const uri = vscode.Uri.file(params.swimlaneGraphPath);
  SwimGraphView.createPanel(uri);
}

/**
 * 打开自定义配置
 */
export async function openPtoConfig(params: { configPath: string; pathName: string }) {
  const { configPath, pathName } = params;
  const controlFlowUri = vscode.Uri.file(configPath);
  const customTitle = pathName ? pathName : `${t('PyPTOToolkit.workspace.ptoNewConfig')}`;
  useView().editorView.open('ptoNewConfig', controlFlowUri, { query: { url: configPath }, title: customTitle });
}
