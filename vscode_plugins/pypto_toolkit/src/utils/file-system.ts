import * as vscode from 'vscode';

export function isFilePathExists(filePath: string): Promise<boolean> {
  const fileUri = vscode.Uri.file(filePath);
  return isFileUriExists(fileUri);
}

/**
 * 判断文件或目录是否存在
 */
export async function isFileUriExists(fileUri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(fileUri);
    return true;
  } catch {
    return false;
  }
}
