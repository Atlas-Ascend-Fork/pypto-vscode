// TODO 当前文件所有代码为临时功能，待实现页面路由后替换
import path from 'node:path';

import * as vscode from 'vscode';
import { t } from 'i18next';

import { useView } from '../../view';
import { useService } from '..';

/**
 * 打开控制流
 */
export async function openControlFlow(params: { outputPath: string; controlFlowPath: string; isBootStep?: boolean }) {
  const { outputPath, controlFlowPath, isBootStep = false } = params;
  const controlFlowUri = vscode.Uri.file(controlFlowPath || 'FileIsNull'); //避免空'结果总览'时导致报错,当没有'结果总览'时地址改为'FileIsNull'，跳转至找不到结果总览页面

  // 标题使用output名称+图类型
  const runDataService = useService('runData');
  const record = await runDataService.getRecordByDirectoryPath(outputPath);
  const customTitle = `${record?.title ?? 'unknown'} - ${t('PyPTOToolkit.workspace.controlFlowName')}`;

  // 加query
  useView().editorView.open('controlFlow', controlFlowUri, { query: { url: outputPath, isBootStep }, title: customTitle });
}

/**
 * 打开计算图
 */
export async function openComputeGraph(params: { outputPath: string; computeGraphPath: string; pathName: string; isBootStep?: boolean }) {
  const { isBootStep = false } = params;
  const uri = vscode.Uri.file(params.computeGraphPath);
  const query = { outputDirPath: params.outputPath, pathName: params.pathName, isBootStep };
  useView().editorView.open('computeGraph', uri, { query, title: path.basename(params.computeGraphPath) });
}

/**
 * 打开泳道图
 */
export async function openSwimlaneGraph(params: { swimlaneGraphPath: string; isBootStep?: boolean }) {
  const { isBootStep = false } = params;
  const uri = vscode.Uri.file(params.swimlaneGraphPath);
  useView().editorView.open('swimGraph', uri, { query: { isBootStep } });
}

/**
 * 打开自定义配置
 */
export async function openPtoConfig(params: { configPath: string; pathName: string; isBootStep?: boolean }) {
  const { isBootStep = false } = params;
  const { configPath, pathName } = params;
  const controlFlowUri = vscode.Uri.file(configPath);
  const customTitle = pathName ? pathName : `${t('PyPTOToolkit.workspace.ptoNewConfig')}`;
  useView().editorView.open('editRunConfig', controlFlowUri, { query: { url: configPath, isBootStep }, title: customTitle });
}

/**
 * 打开欢迎页面
 */
export async function openPyPTOWelcome() {
  const uri = vscode.Uri.file('openPyPTOWelcome');
  useView().editorView.open('welcome', uri);
}
