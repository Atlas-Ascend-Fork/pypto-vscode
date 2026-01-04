import * as vscode from 'vscode';

import { ControlFlowPath, ControlFlowIf, ControlFlowLoop, ProgramOutput } from '../../types/control-flow';
import { ComputeDirectory } from '../../types/workspace';
import { getOutputDetail } from '../run-data/api';

import { FlowTreeAnalyzer } from './flow-tree';
import { openTargetFileInSplit, readLinesByTextDocument } from './source-code';
import { SourceCodeRequestDto } from '../../types/control-flow/basic-node';
import { CodeSnippetDocument } from '../../types/control-flow/source-code';
import { getControlFlowStore } from './store';

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

  const outputDetail = (await getOutputDetail({ outputDirPath: params.outputDirPath })).data;
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
