import path from 'node:path';

import * as vscode from 'vscode';
import { CustomConfigItem, PtoConfigSchemaModel, TileFWKConfig } from '../../types/workspace/config-schema';

const CONFIG_SCHEMA_FILE_NAME = 'pto-config-schema.json';

/**
 * 读取Schema_fwk_config文件
 */
export async function readSchemaData(baseUri: vscode.Uri): Promise<PtoConfigSchemaModel> {
  const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(baseUri, CONFIG_SCHEMA_FILE_NAME));
  return JSON.parse(fileContent.toString());
}

/**
 * 读取tile_fwk_config文件
 */
export async function readFwkData(fileUri: vscode.Uri): Promise<TileFWKConfig> {
  const fileContent = await vscode.workspace.fs.readFile(fileUri);
  return JSON.parse(fileContent.toString());
}

/**
 * 写入tile_fwk_config文件
 * @param baseUri 文件路径
 * @param targetObj 数据对象
 */
export async function writeSchemaData(baseUri: vscode.Uri, targetObj: TileFWKConfig) {
  const jsonContent = JSON.stringify(targetObj, null, 2);
  const content = new TextEncoder().encode(jsonContent);

  // 写入文件
  try {
    await vscode.workspace.fs.writeFile(baseUri, content);
  } catch (err) {
    vscode.window.showErrorMessage(`${(err as Error).message}`);
  }
}

/**
 * 创建指定文件夹
 * @param baseUri 需要创建的文件uri路径
 */
export async function addNewFile(baseUri: vscode.Uri) {
  // 创建文件夹
  try {
    await vscode.workspace.fs.createDirectory(baseUri);
  } catch (err) {
    vscode.window.showErrorMessage(`${(err as Error).message}`);
  }
}

/**
 * 获取指定目录下的所有 配置JSON 文件列表
 * @param baseUri 目标目录的 URI（vscode.Uri 类型）
 * @returns 结构化 JSON 文件列表
 */
export async function getJsonFileList(baseUri: vscode.Uri): Promise<CustomConfigItem[]> {
  try {
    const stats = await vscode.workspace.fs.stat(baseUri);
    if (stats.type !== vscode.FileType.Directory) {
      vscode.window.showErrorMessage(`${stats.type}`);
      return [];
    }
    const dirEntries = await vscode.workspace.fs.readDirectory(baseUri);
    const jsonFileList: CustomConfigItem[] = [];
    for (const [entryName, entryType] of dirEntries) {
      if (entryType === vscode.FileType.File && entryName.toLowerCase().endsWith('.json')) {
        const fileUri = vscode.Uri.joinPath(baseUri, entryName);
        const filePath = fileUri.fsPath;
        jsonFileList.push({
          configName: entryName,
          configBaseName: entryName.replace(/\.json$/i, ''),
          configPath: filePath,
        });
      }
    }
    const FILE_NAME_REGEX = /(\d+)$/; // 匹配文件名末尾的数字
    jsonFileList.sort((a, b) => {
      // 提取 a 的数字部分（从 configBaseName 提取，已去掉.json后缀）
      const aMatch = a.configBaseName.match(FILE_NAME_REGEX);
      const aNum = aMatch ? parseInt(aMatch[1], 10) : -1; // 无数字时排最前

      // 提取 b 的数字部分
      const bMatch = b.configBaseName.match(FILE_NAME_REGEX);
      const bNum = bMatch ? parseInt(bMatch[1], 10) : -1;

      // 按数字升序排序（数字小的在前）
      return aNum - bNum;
    });
    return jsonFileList;
  } catch (err) {
    // 处理目录不存在、权限不足等错误
    vscode.window.showErrorMessage(`${(err as Error).message}`);
    return [];
  }
}

/**
 * 删除指定路径下的配置文件
 * @param fileUri 目标目录的 URI（vscode.Uri 类型）
 */
export async function delFile(fileUri: vscode.Uri) {
  try {
    // 验证：目标是文件（而非目录）且存在
    try {
      const stats = await vscode.workspace.fs.stat(fileUri);
      if (stats.type !== vscode.FileType.File) {
        vscode.window.showErrorMessage(`${stats.type}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`${(err as Error).message}`);
    }

    // 执行删除
    await vscode.workspace.fs.delete(fileUri, {
      useTrash: true,
      recursive: false,
    });
    // 删除成功：提示用户 + 通知前端刷新列表 todo
  } catch (err) {
    // 处理权限不足、文件被占用等错误
    vscode.window.showErrorMessage(`${(err as Error).message}`);
  }
}
