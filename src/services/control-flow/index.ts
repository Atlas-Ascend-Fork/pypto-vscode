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
import * as vscode from 'vscode';

import { ControlFlowPath, ControlFlowIf, ControlFlowLoop, ProgramOutput } from '../../types/control-flow';
import { ComputeDirectory } from '../../types/workspace';
import { fetchRunDataDetail } from '../run-data/api';

import { FlowTreeAnalyzer } from './flow-tree';
import { openTargetFileInSplit, readLinesByTextDocument } from './source-code';
import { SourceCodeRequestDto } from '../../types/control-flow/basic-node';
import { CodeSnippetDocument } from '../../types/control-flow/source-code';
import { getControlFlowStore } from './store';
import { readRunData } from '../run-data/utils/scan-run-data';

export interface GetControlFlowParams {
  /** 编译结果文件夹路径 */
  outputDirPath: string;

  /** program.json文件路径 */
  controlFlowFilePath: string;
}

export interface GetControlFlowRes {
  /** 控制流 */
  data: (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[];
}

/**
 * 获取工作流图信息
 * @param params
 * @returns
 */
export async function getControlFlow(params: GetControlFlowParams): Promise<GetControlFlowRes> {
  const cachedControlFlow = await getControlFlowStore().find({ sourceFilePath: params.controlFlowFilePath });
  if (cachedControlFlow) {
    return { data: cachedControlFlow.flow };
  }
  const programUri = vscode.Uri.file(params.controlFlowFilePath);
  const fileContent = (await vscode.workspace.fs.readFile(programUri)).toString();

  let program: ProgramOutput;
  try {
    program = JSON.parse(fileContent);
  } catch {
    throw new Error('无法解析program.json');
  }

  const outputDetail = (await fetchRunDataDetail({ outputDirPath: params.outputDirPath })).data;
  const computeDir = outputDetail?.directoryTree?.children.find((child) => {
    return child.type === 'dir' && child.directoryType === 'compute';
  }) as ComputeDirectory | undefined;
  const passes = computeDir ? computeDir.children : [];

  const analyzer = new FlowTreeAnalyzer(program, passes);
  const flow = analyzer.getControlFlow();
  getControlFlowStore().set({ sourceFilePath: params.controlFlowFilePath, runDataPath: params.outputDirPath, flow });
  return { data: flow };
}

/**
 * 获取代码预览信息
 * @param params 控制流节点读取源码字段
 * @returns 返回指定行代码片段
 */
export async function getSnippetCodeText(params: SourceCodeRequestDto): Promise<CodeSnippetDocument> {
  const sourceCodeUri = vscode.Uri.file(params.filePath);
  const codeTextDocument = await readLinesByTextDocument(sourceCodeUri, params.startLine, params.endLine);
  return codeTextDocument;
}

/**
 * 分屏打开源代码指定行
 * @param params 控制流节点读取源码字段
 */
export async function openControlFlowTargetFile(params: SourceCodeRequestDto) {
  const fileUri = vscode.Uri.file(params.filePath);
  openTargetFileInSplit(fileUri, params.line);
}

/**
 * 根据runData.json读取program.json的Path
 * @returns 返回program.json的Path
 */
export async function readProgramPath(params: { outputPath: string }) {
  const runDataUri = vscode.Uri.file(params.outputPath);
  const record = await readRunData(runDataUri)
  if (record) {
    return record.controlFlowFilePath
  }
}

/**
 * 读取runData.json中配置的program_file原始路径（不做存在性过滤，用于提示）
 */
export async function readProgramConfiguredPath(params: { outputPath: string }): Promise<string | null> {
  try {
    const runDataUri = vscode.Uri.joinPath(vscode.Uri.file(params.outputPath), 'rundata.json');
    const fileContent = await vscode.workspace.fs.readFile(runDataUri);
    const rundata = JSON.parse(fileContent.toString());
    return typeof rundata?.program_file === 'string' ? rundata.program_file : null;
  } catch {
    return null;
  }
}
