import path from 'node:path';

import * as vscode from 'vscode';

import {
  ComputeDirectory,
  ComputeGraph,
  ControlFlowFile,
  OutputDirectory,
  PassDirectory,
  RunDataManifest,
  SwimlaneGraphFile,
} from '../../types/workspace';
import { t } from 'i18next';
import { PassStage, StageEndPassNames } from '../../types/workspace/pass';

const CONTROL_FLOW_SOURCE_FILE = 'program.json';

/**
 * 运行结果
 */
export async function getOutputDirectory(outputUri: vscode.Uri, runData: RunDataManifest): Promise<OutputDirectory> {
  return {
    type: 'dir',
    directoryType: 'output',
    name: path.basename(outputUri.path),
    absolutePath: outputUri.path,
    children: [
      ...(await getControlFlowFile(outputUri)),
      ...(await getSwimlaneFile(outputUri, runData)),
      ...(await getComputeGraphDirectory(outputUri, runData)),
    ],
  };
}

/**
 * 控制流文件
 */
async function getControlFlowFile(outputUri: vscode.Uri): Promise<ControlFlowFile[]> {
  const controlFlowUri = vscode.Uri.joinPath(outputUri, CONTROL_FLOW_SOURCE_FILE);
  try {
    await vscode.workspace.fs.readFile(controlFlowUri);
  } catch {
    return [];
  }
  return [
    {
      type: 'file',
      fileType: 'controlFlow',
      name: t('PyPTOToolkit.workspace.controlFlowName'),
      absolutePath: controlFlowUri.path,
      extname: 'json',
      outputPath: outputUri.path,
    },
  ];
}

/**
 * 泳道图文件
 */
async function getSwimlaneFile(outputUri: vscode.Uri, runData: RunDataManifest): Promise<SwimlaneGraphFile[]> {
  if (!runData.swim_graph_path) {
    return [];
  }

  const swimlaneFileUri = vscode.Uri.joinPath(outputUri, runData.swim_graph_path);
  return [
    {
      type: 'file',
      fileType: 'swimlaneGraph',
      name: runData.swim_graph_path,
      absolutePath: swimlaneFileUri.path,
      extname: 'json',
      outputPath: outputUri.path,
    },
  ];
}

/**
 * 计算图目录
 */
async function getComputeGraphDirectory(outputUri: vscode.Uri, runData: RunDataManifest): Promise<ComputeDirectory[]> {
  if (runData.compute_graph_path === undefined) {
    return [];
  }

  const computeDirectoryUri = vscode.Uri.joinPath(outputUri, runData.compute_graph_path);
  return [
    {
      type: 'dir',
      directoryType: 'compute',
      name: t('PyPTOToolkit.workspace.computeGraphName'),
      absolutePath: computeDirectoryUri.path,
      children: await getPassDirectories(computeDirectoryUri, outputUri),
    },
  ];
}

/** Pass目录名称正则 */
const PassDirectoryRegExp = /^Pass_(\d+)_(\w+)$/;

/**
 * Pass目录
 */
async function getPassDirectories(parentDirUri: vscode.Uri, outputUri: vscode.Uri): Promise<PassDirectory[]> {
  const subList = await vscode.workspace.fs.readDirectory(parentDirUri);
  const passes: PassDirectory[] = [];
  let passStage = PassStage.TENSOR_GRAPH;
  for (const [subPath, fileType] of subList) {
    if (fileType === vscode.FileType.Directory && PassDirectoryRegExp.test(subPath)) {
      const [_, passIndex, passName] = subPath.match(PassDirectoryRegExp) ?? [];
      const passUri = vscode.Uri.joinPath(parentDirUri, subPath);

      const computeGraphList = await getComputeGraphFile(passUri, outputUri, passIndex);
      if (computeGraphList.length === 0) {
        continue;
      }

      passes.push({
        type: 'dir',
        directoryType: 'pass',
        passStage: passStage,
        passIndex: passIndex,
        name: passName,
        absolutePath: passUri.path,
        children: computeGraphList,
      });

      // 判断是否进入下一个stage
      if (passName.toLowerCase() === StageEndPassNames[passStage][0].toLowerCase()) {
        passStage = StageEndPassNames[passStage][1];
      }
    }
  }
  return passes;
}

/**
 * 计算图文件
 */
async function getComputeGraphFile(passUri: vscode.Uri, outputUri: vscode.Uri, passIndex: string): Promise<ComputeGraph[]> {
  const subList = await vscode.workspace.fs.readDirectory(passUri);
  const graphs: ComputeGraph[] = [];

  for (const [subPath, fileType] of subList) {
    if (fileType === vscode.FileType.File && subPath.endsWith('.json') && !subPath.startsWith('Before')) {
      const computeGraphUri = vscode.Uri.joinPath(passUri, subPath);
      graphs.push({
        type: 'file',
        fileType: 'computeGraph',
        extname: '.json',
        name: subPath,
        absolutePath: computeGraphUri.path,
        outputPath: outputUri.path,
        passIndex,
      });
    }
  }

  return graphs;
}
