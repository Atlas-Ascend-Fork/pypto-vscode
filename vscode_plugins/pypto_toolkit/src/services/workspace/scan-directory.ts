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
import { hasHealthReport, isHealthReport } from '../../utils/health-report';

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
      name: t('PyPTOToolkit.workspace.swimlaneGraphName'),
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
const passDirectoryRegExp = /^Pass_(\d+)_(\w+)$/;

/**
 * Pass目录
 */
async function getPassDirectories(parentDirUri: vscode.Uri, outputUri: vscode.Uri): Promise<PassDirectory[]> {
  const subList = await vscode.workspace.fs.readDirectory(parentDirUri);
  const passes: PassDirectory[] = [];
  let passStage = PassStage.TENSOR_GRAPH;
  for (const [subPath, fileType] of subList) {
    if (fileType === vscode.FileType.Directory && passDirectoryRegExp.test(subPath)) {
      const [_, passIndex, passName] = subPath.match(passDirectoryRegExp) ?? [];
      const passUri = vscode.Uri.joinPath(parentDirUri, subPath);

      const computeGraphList = await getComputeGraphFile(outputUri, { passUri, passIndex, passName });
      if (computeGraphList.length === 0) {
        continue;
      }

      passes.push({
        type: 'dir',
        directoryType: 'pass',
        passStage: passStage,
        passIndex: passIndex,
        name: subPath,
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

interface Pass {
  passUri: vscode.Uri;
  passIndex: string;
  passName: string;
}

/**
 * 计算图文件
 */
async function getComputeGraphFile(outputUri: vscode.Uri, pass: Pass): Promise<ComputeGraph[]> {
  const { passUri, passIndex } = pass;
  const subList = await vscode.workspace.fs.readDirectory(passUri);
  const graphs: ComputeGraph[] = [];

  for (const [subPath, fileType] of subList) {
    if (fileType === vscode.FileType.File && isComputeGraph(subPath, pass)) {
      const computeGraphUri = vscode.Uri.joinPath(passUri, subPath);
      const { pathName, computeType, leafProgramId, leafHash } = decodeComputeGraphFilename(subPath, pass);
      graphs.push({
        type: 'file',
        fileType: 'computeGraph',
        extname: '.json',
        name: subPath,
        absolutePath: computeGraphUri.path,
        outputPath: outputUri.path,
        passIndex,
        pathName,
        hasHealthReport: hasHealthReport(computeGraphUri.fsPath),
        computeType,
        leafProgramId,
        leafHash,
      });
    }
  }

  return graphs;
}

function isComputeGraph(subPath: string, { passIndex, passName }: Pass): boolean {
  return subPath.startsWith(`After_0${passIndex}_${passName}_`) && subPath.endsWith('.json') && !isHealthReport(subPath);
}

function decodeComputeGraphFilename(
  filename: string,
  { passIndex, passName }: Pass,
): Pick<ComputeGraph, 'pathName' | 'computeType' | 'leafProgramId' | 'leafHash'> {
  const fileNameRegExp = new RegExp(
    `^After_0${passIndex}_${passName}_(\\w+_PATH\\d+)_\\d+(?:_(ROOT|LEAF)(?:_program_id_(\\d+)_(\\d+)))?\\.json$`,
  );
  const [_, pathName, rootOrLeaf, leafProgramId, leafHash] = filename.match(fileNameRegExp) ?? [];
  const computeType = rootOrLeaf ? (rootOrLeaf.toLowerCase() as 'root' | 'leaf') : 'all';
  return { pathName, computeType, leafProgramId, leafHash };
}
