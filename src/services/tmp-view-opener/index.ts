/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
// TODO 当前文件所有代码为临时功能，待实现页面路由后替换
import path, { join } from 'node:path';

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
  const record = await runDataService.getOutputRecord(outputPath);
  const customTitle = `${record?.title ? record?.title + '-' : ''} ${t('PyPTOToolkit.workspace.controlFlowName')}`;

  // 加query
  useView().editorView.open('controlFlow', controlFlowUri, {
    query: {
      url: outputPath,
      outputPath: outputPath,
      isBootStep,
      computeGraphDirPath: record?.computeGraphDirPath,
      flowVerifyPath: record?.flowVerifyPath,
    },
    title: customTitle,
  });
}

/**
 * 打开计算图
 */
export async function openComputeGraph(params: {
  outputPath: string;
  computeGraphPath: string;
  pathName: string;
  isBootStep?: boolean;
  fileType?: string;
  computeGraphDirPath?: string;
  flowVerifyPath?: string;
}) {
  const { isBootStep = false, fileType, computeGraphDirPath, flowVerifyPath } = params;
  const uri = vscode.Uri.file(params.computeGraphPath);
  const query = {
    outputDirPath: params.outputPath,
    outputPath: params.outputPath,
    pathName: params.pathName,
    isBootStep,
    fileType,
    computeGraphDirPath,
    flowVerifyPath,
  };
  useView().editorView.open('computeGraph', uri, { query, title: path.basename(params.computeGraphPath) });
}

/**
 * 打开泳道图
 */
export async function openSwimlaneGraph(params: { swimlaneGraphPath: string; outputPath?: string; isBootStep?: boolean }) {
  const { isBootStep = false } = params;
  const uri = vscode.Uri.file(params.swimlaneGraphPath);
  useView().editorView.open('swimGraph', uri, { query: { isBootStep, outputPath: params.outputPath } });
}

/**
 * 打开OpCheck页面
 */
export async function openOpCheck(params: { outputPath: string; opeCheckDirPath?: string[] | null; flowVerifyPath?: string; computeGraphDirPath?: string }) {
  // 标题使用output名称+OpCheck
  const runDataService = useService('runData');
  const record = await runDataService.getOutputRecord(params.outputPath);
  const customTitle = `${record?.title ? record?.title + '-' : ''}OpCheck`;

  // 使用outputPath作为uri的唯一标识，避免重复打开
  // 不传递opeCheckDirPath到query中，由页面动态获取，避免因opeCheckDirPath变化导致打开多个页面
  const uri = vscode.Uri.file(params.outputPath);
  vscode.commands.executeCommand('workbench.action.closeSidebar');
  useView().editorView.open('opCheck', uri, { query: { outputPath: params.outputPath, flowVerifyPath: params.flowVerifyPath, computeGraphDirPath: params.computeGraphDirPath }, title: customTitle });
}

/**
 * 打开TaskCheck页面
 */
export async function openTaskCheck(params: { outputPath: string; taskCheckDirPath?: string[] | null; flowVerifyPath?: string; computeGraphDirPath?: string }) {
  // 标题使用output名称+TaskCheck
  const runDataService = useService('runData');
  const record = await runDataService.getOutputRecord(params.outputPath);
  const customTitle = `${record?.title ? record?.title + '-' : ''}TaskCheck`;

  // 使用outputPath作为uri的唯一标识，避免重复打开
  // 不传递taskCheckDirPath到query中，由页面动态获取，避免因taskCheckDirPath变化导致打开多个页面
  const uri = vscode.Uri.file(params.outputPath);
  vscode.commands.executeCommand('workbench.action.closeSidebar');
  useView().editorView.open('taskCheck', uri, { query: { outputPath: params.outputPath, flowVerifyPath: params.flowVerifyPath, computeGraphDirPath: params.computeGraphDirPath, swimGraphPath: record?.swimlaneGraphFilePath }, title: customTitle });
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

/**
 * 打开引导模式三联动视图
 */
export function openThreeColumnGraph(params: { isBootStep?: boolean; sameplePath: string }) {
  const { isBootStep = false, sameplePath } = params;
  const pyPath = join(sameplePath, 'test_glm_ffn_dense_quant.py');
  const swimPath = join(sameplePath, 'merged_swimlane.json');
  const computPath = join(sameplePath, 'program.json');
  const uri = vscode.Uri.file(pyPath);
  useView().editorView.open('threeColumnGraph', uri, { query: { isBootStep, swim: swimPath, comput: computPath } });
}
