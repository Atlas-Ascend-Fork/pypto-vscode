import path from 'node:path';

import * as vscode from 'vscode';

import { RunDataManifest } from '../../types/workspace';

const RUN_DATA_FILE_NAME = 'rundata.json';

/**
 * 当前目录是否包含rundata文件
 */
export async function hasOutputRunData(outputUri: vscode.Uri): Promise<boolean> {
  const dirName = path.basename(outputUri.path);
  const dirNodes = await vscode.workspace.fs.readDirectory(outputUri);
  for (const [nodePath, fileType] of dirNodes) {
    if (fileType === vscode.FileType.File && nodePath === `${dirName}.json`) {
      return true;
    }
  }
  return false;
}

/**
 * 读取rundata文件
 */
export async function readOutputRunData(outputUri: vscode.Uri): Promise<RunDataManifest> {
  const dirName = path.basename(outputUri.path);
  const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(outputUri, `${dirName}.json`));
  return JSON.parse(fileContent.toString());
}
