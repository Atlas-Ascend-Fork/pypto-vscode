import * as vscode from 'vscode';

import { ControlFlowPath, ControlFlowIf, ControlFlowLoop, ProgramOutput } from '../../types/control-flow';
import { ComputeDirectory } from '../../types/workspace';
import { getOutputDetail } from '../workspace';

import { FlowTreeAnalyzer } from './flow-tree';

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
  const programUri = vscode.Uri.file(params.controlFlowFilePath);
  const fileContent = (await vscode.workspace.fs.readFile(programUri)).toString();

  let program: ProgramOutput;
  try {
    program = JSON.parse(fileContent);
  } catch {
    throw new Error('无法解析program.json');
  }

  const outputDetail = (await getOutputDetail({ outputDirPath: params.outputDirPath })).data;
  const computeDir = outputDetail?.directoryTree.children.find((child) => {
    return child.type === 'dir' && child.directoryType === 'compute';
  }) as ComputeDirectory | undefined;
  const passes = computeDir ? computeDir.children : [];

  const analyzer = new FlowTreeAnalyzer(program, passes);
  return { data: analyzer.getControlFlow() };
}
