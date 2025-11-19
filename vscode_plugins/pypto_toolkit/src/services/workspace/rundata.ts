import * as vscode from 'vscode';

import { RunDataManifest } from '../../types/workspace';

const RUNDATA_FILE_NAME = 'rundata.json';

/**
 * 当前目录是否包含rundata文件
 */
export async function hasOutputRunData(outputUri: vscode.Uri): Promise<boolean> {
  const dirNodes = await vscode.workspace.fs.readDirectory(outputUri);
  for (const [nodePath, fileType] of dirNodes) {
    if (fileType === vscode.FileType.File && nodePath === RUNDATA_FILE_NAME) {
      return true;
    }
  }
  return false;
}

/**
 * 读取rundata文件
 */
export async function readOutputRunData(outputUri: vscode.Uri): Promise<RunDataManifest> {
  const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(outputUri, RUNDATA_FILE_NAME));
  return JSON.parse(fileContent.toString());
}
