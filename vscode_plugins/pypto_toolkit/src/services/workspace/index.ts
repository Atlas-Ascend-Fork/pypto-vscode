import path from 'node:path';

import * as vscode from 'vscode';

import { OutputDetail, OutputRecord, RunDataManifest } from '../../types/workspace';
import { hasOutputRunData, readOutputRunData } from './rundata';
import { getOutputDirectory } from './scan-directory';

export interface GetOutputRecordParams {
  /** 算子源文件 */
  operatorSourceFile?: string;

  /** 排序属性 */
  sortBy?: 'executeTime';

  /** 正序 or 倒序 */
  sortOrder?: 'asc' | 'desc';
}

export interface GetOutputRecordsRes {
  data: OutputRecord[];
}

const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;
const OUTPUT_COLLECTION_PATH = process.env.PYPTO_HOME || `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

/**
 * 获取运行结果记录
 */
export async function getOutputRecords(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  const { sortBy = 'executeTime', sortOrder = 'desc' } = params;
  const outputCollectionUri = vscode.Uri.file(OUTPUT_COLLECTION_PATH);
  if (!outputCollectionUri) {
    return { data: [] };
  }

  const records: OutputRecord[] = await getRecordsFromDirectory(outputCollectionUri);

  // 执行排序
  records.sort((a, b) => {
    const sortFlag = sortOrder === 'asc' ? 1 : -1;
    return a[sortBy] > b[sortBy] ? sortFlag : sortFlag;
  });

  return { data: records };
}

export interface GetOutputDetailParams {
  outputDirPath: string;
}

export interface GetOutputDetailRes {
  data: OutputDetail;
}

/**
 * 获取运行结果详情
 */
export async function getOutputDetail(params: GetOutputDetailParams): Promise<GetOutputDetailRes> {
  const outputUri = vscode.Uri.file(params.outputDirPath);
  const runData = await readOutputRunData(outputUri);
  const detail = {
    ...getOutputRecord(outputUri, runData),
    directoryTree: await getOutputDirectory(outputUri, runData),
  };
  return { data: detail };
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
    if (fileType !== vscode.FileType.Directory) {
      continue;
    }
    const rootDirUri = vscode.Uri.joinPath(directoryUri, subPath);
    if (await isOutputDirectory(rootDirUri)) {
      const runData = await readOutputRunData(rootDirUri);
      const record = getOutputRecord(rootDirUri, runData);
      records.push(record);
    }
  }

  return records;
}

const OutputDirectoryRegExp = /^rundata_(\d{14})/;

/**
 * 是否是编译产物目录
 */
async function isOutputDirectory(uri: vscode.Uri): Promise<boolean> {
  const isLegalPath = OutputDirectoryRegExp.test(path.basename(uri.path));
  const hasRunData = await hasOutputRunData(uri);
  return isLegalPath && hasRunData;
}

/**
 * 获取output记录
 */
function getOutputRecord(outputUri: vscode.Uri, runData: RunDataManifest): OutputRecord {
  const directoryPath = outputUri.path;
  const sourceFilePath = runData.pto_src_file ? path.posix.join(directoryPath, runData.pto_src_file) : '';
  const controlFlowFilePath = path.posix.join(directoryPath, 'program.json');
  const swimlaneGraphFilePath = runData.swim_graph_path ? path.posix.join(directoryPath, runData.swim_graph_path) : '';

  const directoryName = path.posix.basename(directoryPath);
  const [_, timestamp] = directoryName.match(OutputDirectoryRegExp) ?? [];
  const executeDate = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
  const executeTime = `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`;
  return {
    title: `${runData.runtype}_${timestamp.slice(0, 8)}_${timestamp.slice(8, 14)}`,
    executeTime: `${executeDate} ${executeTime}`,
    directoryPath,
    sourceFilePath,
    controlFlowFilePath,
    swimlaneGraphFilePath,
  };
}
