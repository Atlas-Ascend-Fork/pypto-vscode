import path from 'node:path';

import * as vscode from 'vscode';

import { OutputRecord } from '../../types/workspace';
import { hasOutputRunData, readOutputRunData } from './rundata';
import { getOutputDirectory } from './scan-directory';

export interface OutputRecordParams {
  /** 模糊搜索 */
  keyword?: string;

  /** 算子源文件 */
  operatorSourceFile?: string;

  /** 排序属性 */
  sortBy?: 'executeTime';

  /** 正序 or 倒序 */
  sortOrder?: 'asc' | 'desc';
}

export interface OutputRecordsRes {
  records: OutputRecord[];
}

const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;
const OUTPUT_COLLECTION_PATH = process.env.PYPTO_HOME || `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

/**
 * 获取运行结果记录
 */
export async function getOutputRecords(params: OutputRecordParams): Promise<OutputRecordsRes> {
  // const outputCollectionUri = vscode.Uri.file(OUTPUT_COLLECTION_PATH);

  // TODO 暂时解析workspace目录，之后使用环境变量指定目录代替
  const outputCollectionUri = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!outputCollectionUri) {
    return { records: [] };
  }

  const records: OutputRecord[] = await getRecordsFromDirectory(outputCollectionUri);

  // TODO 筛选、排序
  return { records };
}

/**
 * 获取指定目录下的编译记录
 */
async function getRecordsFromDirectory(directoryUri: vscode.Uri): Promise<OutputRecord[]> {
  let subList: [string, vscode.FileType][];
  try {
    subList = await vscode.workspace.fs.readDirectory(directoryUri);
  } catch {
    // 文件夹不存在
    subList = [];
  }

  const records: OutputRecord[] = [];
  for (const [subPath, fileType] of subList) {
    if (fileType === vscode.FileType.Directory) {
      const rootDirUri = vscode.Uri.joinPath(directoryUri, subPath);
      if (await isOutputDirectory(rootDirUri)) {
        const record = await getOutputRecord(rootDirUri);
        records.push(record);
      }
    }
  }

  return records;
}

/**
 * 是否是编译产物目录
 */
async function isOutputDirectory(uri: vscode.Uri): Promise<boolean> {
  return await hasOutputRunData(uri);
}

/**
 * 获取output记录
 */
async function getOutputRecord(outputUri: vscode.Uri): Promise<OutputRecord> {
  const runData = await readOutputRunData(outputUri);
  return {
    dir: await getOutputDirectory(outputUri, runData),
  };
}
