import path from 'node:path';

import * as vscode from 'vscode';

import {
  ComputeDirectory,
  ComputeGraph,
  ControlFlowFile,
  OutputDirectory,
  OutputRecord,
  PassDirectory,
  SwimlaneGraphFile,
} from '../../types/workspace';
import { t } from 'i18next';
import { PassStage, StageEndPassNames } from '../../types/workspace/pass';
import { hasHealthReport, isHealthReport } from '../../utils/health-report';

/**
 * 运行结果
 */
export async function getOutputDirectory(outputUri: vscode.Uri, record: OutputRecord): Promise<OutputDirectory | null> {
  if (!isFileExist(outputUri)) {
    return null;
  }
  return {
    type: 'dir',
    directoryType: 'output',
    name: path.basename(outputUri.path),
    absolutePath: outputUri.path,
    children: [
      ...(await getControlFlowFile(outputUri, record)),
      ...(await getSwimlaneFile(outputUri, record)),
      ...(await getComputeGraphDirectory(outputUri, record)),
    ],
  };
}

/**
 * 控制流文件
 */
async function getControlFlowFile(outputUri: vscode.Uri, record: OutputRecord): Promise<ControlFlowFile[]> {
  if (!record.controlFlowFilePath || !path.isAbsolute(record.controlFlowFilePath)) {
    return [];
  }
  const controlFlowUri = vscode.Uri.file(record.controlFlowFilePath);
  if (!(await isFileExist(controlFlowUri))) {
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
async function getSwimlaneFile(outputUri: vscode.Uri, record: OutputRecord): Promise<SwimlaneGraphFile[]> {
  if (!record.swimlaneGraphFilePath || !path.isAbsolute(record.swimlaneGraphFilePath)) {
    return [];
  }
  const swimlaneFileUri = vscode.Uri.file(record.swimlaneGraphFilePath);
  if (!(await isFileExist(swimlaneFileUri))) {
    return [];
  }
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
async function getComputeGraphDirectory(outputUri: vscode.Uri, record: OutputRecord): Promise<ComputeDirectory[]> {
  if (!record.computeGraphDirPath || !path.isAbsolute(record.computeGraphDirPath)) {
    return [];
  }

  const computeDirectoryUri = vscode.Uri.file(record.computeGraphDirPath);
  const passDirectories = await getPassDirectories(computeDirectoryUri, outputUri);
  return passDirectories.length > 0
    ? [
        {
          type: 'dir',
          directoryType: 'compute',
          name: t('PyPTOToolkit.workspace.computeGraphName'),
          absolutePath: computeDirectoryUri.path,
          children: passDirectories,
        },
      ]
    : [];
}

/** Pass目录名称正则 */
const passDirectoryRegExp = /^Pass_(\d+)_(\w+)$/;

/**
 * Pass目录
 */
async function getPassDirectories(parentDirUri: vscode.Uri, outputUri: vscode.Uri): Promise<PassDirectory[]> {
  let subList: [string, vscode.FileType][];
  try {
    subList = await vscode.workspace.fs.readDirectory(parentDirUri);
  } catch {
    return [];
  }

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

async function isFileExist(fileUri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(fileUri);
    return true;
  } catch {
    return false;
  }
}

function isComputeGraph(subPath: string, { passIndex, passName }: Pass): boolean {
  return subPath.startsWith(`After_0${passIndex}_${passName}_`) && subPath.endsWith('.json') && !isHealthReport(subPath);
}

function decodeComputeGraphFilename(
  filename: string,
  { passIndex, passName }: Pass,
): Pick<ComputeGraph, 'pathName' | 'computeType' | 'leafProgramId' | 'leafHash'> {
  const fileNameRegExp = new RegExp(
    `^After_0${passIndex}_${passName}(?:_\\d+)?_(\\w+_PATH\\d+)_\\d+(?:_(ROOT|LEAF)(?:_program_id_(\\d+)_(\\d+))?)?\\.json$`,
  );
  const [_, pathName, rootOrLeaf, leafProgramId, leafHash] = filename.match(fileNameRegExp) ?? [];
  const computeType = rootOrLeaf ? (rootOrLeaf.toLowerCase() as 'root' | 'leaf') : 'all';
  return { pathName, computeType, leafProgramId, leafHash };
}
