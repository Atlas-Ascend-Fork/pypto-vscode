import * as vscode from 'vscode';

import { RunDataManifest } from '../../types/workspace';

const RUN_DATA_FILE_NAME = 'rundata.json';

/**
 * 当前目录是否包含rundata文件
 */
export async function hasOutputRunData(uri: vscode.Uri): Promise<boolean> {
  const dirNodes = await vscode.workspace.fs.readDirectory(uri);
  for (const [nodePath, fileType] of dirNodes) {
    if (fileType === vscode.FileType.File && nodePath === RUN_DATA_FILE_NAME) {
      return true;
    }
  }
  return false;
}

/**
 * 读取rundata文件
 */
export async function readOutputRunData(outputUri: vscode.Uri): Promise<RunDataManifest> {
  const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(outputUri, RUN_DATA_FILE_NAME));
  return JSON.parse(fileContent.toString());
}
