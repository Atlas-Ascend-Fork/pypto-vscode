import * as vscode from 'vscode';

import { ControlFlowPath, ControlFlowIf, ControlFlowLoop, ProgramOutput } from '../../types/control-flow';
import { ComputeDirectory } from '../../types/workspace';
import { getOutputDetail } from '../workspace';

import { FlowTreeAnalyzer } from './flow-tree';

export interface GetControlFlowParams {
  /** 编译结果文件夹路径 */
  outputDirPath: string;
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
  let program: ProgramOutput;
  try {
    const programUri = vscode.Uri.joinPath(vscode.Uri.file(params.outputDirPath), 'program.json');
    const fileContent = (await vscode.workspace.fs.readFile(programUri)).toString();
    program = JSON.parse(fileContent); // TODO 超大数字精度丢失
  } catch {
    throw new Error('无法解析program.json');
  }

  const outputDetail = (await getOutputDetail({ outputDirPath: params.outputDirPath })).data;
  const computeDir = outputDetail.directoryTree.children.find((child) => {
    return child.type === 'dir' && child.directoryType === 'compute';
  }) as ComputeDirectory | undefined;
  const passes = computeDir ? computeDir.children : [];

  const analyzer = new FlowTreeAnalyzer(program, passes);
  return { data: analyzer.getControlFlow() };
}
