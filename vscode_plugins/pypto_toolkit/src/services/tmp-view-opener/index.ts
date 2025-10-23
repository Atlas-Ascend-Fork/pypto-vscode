// TODO 当前文件所有代码为临时功能，待实现页面路由后替换
import path from 'node:path';

import * as vscode from 'vscode';

import { useView } from '../../view';
import { GraphView } from '../../view/graphView';
import { SingleGraphData } from '../../core/graphData';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { SwimGraphView } from '../../view/swimGraphView';

/**
 * 打开控制流
 */
export function openControlFlow(params: { outputPath: string; controlFlowPath: string }) {
  const uri = vscode.Uri.file(params.controlFlowPath).with({ query: JSON.stringify({ url: params.outputPath }) });
  useView().editorView.open('controlFlow', uri);
}

/**
 * 打开计算图
 */
export function openComputeGraph(params: { outputPath: string; computeGraphPath: string }) {
  const uri = vscode.Uri.file(params.computeGraphPath);
  new GraphView(
    { viewType: 'comItemDetailView', title: path.basename(params.computeGraphPath) },
    SingleGraphData,
    SingleGraphHandler,
  ).createPanel(uri.fsPath, undefined, undefined, undefined, undefined, undefined, undefined, params.outputPath);
}

/**
 * 打开泳道图
 */
export function openSwimlaneGraph(params: { swimlaneGraphPath: string }) {
  const uri = vscode.Uri.file(params.swimlaneGraphPath);
  SwimGraphView.createPanel(uri);
}
