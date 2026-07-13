/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import path from 'node:path';

import * as vscode from 'vscode';

import type { OutputRecord, RunDataManifest } from '../../../types/workspace';
import { isFilePathExists, isFileUriExists } from '../../../utils/file-system';
import { getMockDataPath, getProgramPath, getSwimPath } from '../../welcome';
import { getCmpFileList } from '../../../common/csvReader';
import { SQLiteCache, AccuracyToolCompList } from '../../../core/sqliteCache';

export interface RunDataDir {
  dirname: string;
  executeTime: string;
}

const SCAN_RUN_DATA_LIMIT = 5000;
export const COMPUTE_GRAPH_PATH_LEVER = 2;
export const VERIFY_GRAPH_PATH_LEVER = 1;
const VERIFY_DIR = "verify";

/**
 * 读取所有rundata目录
 */
export async function readRunDataList(parentUri: vscode.Uri): Promise<RunDataDir[]> {
  if (!(await isFileUriExists(parentUri))) {
    return [];
  }
  const runDataList = await vscode.workspace.fs.readDirectory(parentUri);
  const sortedRunDataList: RunDataDir[] = [];
  for (let i = runDataList.length - 1; i >= 0; i--) {
    const [subPath, fileType] = runDataList[i];
    // 非目录无需扫描
    if (fileType !== vscode.FileType.Directory) {
      continue;
    }
    // 最新记录之前的目录无需扫描
    const { datetimeFormat } = resolveExecuteTime(subPath);
    if (!datetimeFormat) {
      continue;
    }
    sortedRunDataList.push({ dirname: subPath, executeTime: datetimeFormat });
    if (sortedRunDataList.length >= SCAN_RUN_DATA_LIMIT) {
      break;
    }
  }
  return sortedRunDataList;
}

const RUNDATA_FILE_NAME = 'rundata.json';
const RUNDATA_BOOT_STEPS_FILE_NAME = 'rundata_boot_steps.json';

/**
 * 获取output记录
 */
export async function readRunData(runDataUri: vscode.Uri): Promise<OutputRecord | undefined> {
  const runData = await readRunDataFile(runDataUri);
  const directoryName = path.posix.basename(runDataUri.path);
  const executeTime = resolveExecuteTime(directoryName)!;
  if (!runData || !runData.runtype || !executeTime.titleFormat) {
    return undefined;
  }

  const title = `${runData.runtype}_${executeTime.titleFormat}`;
  const directoryPath = runDataUri.fsPath;
  const sourceFilePath = await getPathIfExists(runData.pto_src_file);
  const controlFlowFilePath = await getPathIfExists(runData.program_file);
  const swimlaneGraphFilePath = await getPathIfExists(runData.swim_graph_path);
  const computeGraphDirPath = await getPathIfExists(runData.compute_graph_path);
  let flowVerifyPath = runData.flow_verify_path ? runData.flow_verify_path : (runData.verify_path ? runData.verify_path : null);
  let computePath = flowVerifyPath;

  let verifyPath = VERIFY_GRAPH_PATH_LEVER;
  if (!flowVerifyPath) {
    computePath = computeGraphDirPath;
    verifyPath = COMPUTE_GRAPH_PATH_LEVER;
  }

  if (![sourceFilePath, controlFlowFilePath, swimlaneGraphFilePath, computeGraphDirPath].some(Boolean)) {
    return undefined;
  }

  const { hasOpeCheck, opeCheckDirPath } = await findOpeCheck(computePath ?? undefined, verifyPath);

  return {
    title,
    executeTime: executeTime.datetimeFormat,
    directoryPath,
    sourceFilePath,
    controlFlowFilePath,
    swimlaneGraphFilePath,
    computeGraphDirPath,
    flowVerifyPath,
    hasOpeCheck,
    opeCheckDirPath,
  };
}

/**
 * 读取rundata文件
 */
async function readRunDataFile(outputUri: vscode.Uri): Promise<RunDataManifest | null> {
  try {
    const fileList = await vscode.workspace.fs.readDirectory(outputUri);
    const isBootSteps = fileList.some((item) => item[0] === RUNDATA_BOOT_STEPS_FILE_NAME);
    if (isBootSteps) {
      const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(outputUri, RUNDATA_BOOT_STEPS_FILE_NAME));
      const res = JSON.parse(fileContent.toString());
      res.compute_graph_path = await getMockDataPath();
      res.program_file = await getProgramPath();
      res.swim_graph_path = await getSwimPath();
      return res;
    } else {
      const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(outputUri, RUNDATA_FILE_NAME));
      return JSON.parse(fileContent.toString());
    }
  } catch {
    return null;
  }
}

interface ResolvedExecuteTime {
  /** 标题格式（年月日_时分秒） */
  titleFormat: string;

  /** 日期时间格式（年-月-日 时:分:秒） */
  datetimeFormat: string;
}

/** rundata目录名称正则 */
const RUN_DATA_DIRNAME_REG_EXP = /^rundata_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/;

/**
 * 从rundata目录名解析执行时间
 * @param directoryName 目录名
 */
function resolveExecuteTime(directoryName: string): ResolvedExecuteTime {
  const matches = RUN_DATA_DIRNAME_REG_EXP.exec(directoryName);
  if (!matches) {
    return { titleFormat: '', datetimeFormat: '' };
  }
  const [_, year, month, day, hour, minute, second] = matches;
  return {
    titleFormat: `${year}${month}${day}_${hour}${minute}${second}`,
    datetimeFormat: `${year}-${month}-${day} ${hour}:${minute}:${second}`,
  };
}

async function getPathIfExists(checkingPath: string | undefined): Promise<string | null> {
  return checkingPath && (await isFilePathExists(checkingPath)) ? checkingPath : null;
}

const VERIFY_GRAPH_RESULT_CMP_REG_EXP = /^verify_graph_result_cmp/;

export function findVerifyDir(path, level) {
  if (!path || typeof path !== 'string') return '';
  const cleanPath = path.replace(/\/+$/, '');
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length <= level) return '';
  const result = parts.slice(0, -level).join('/');
  return cleanPath.startsWith('/') ? '/' + result : result;
}

interface OpeCheckResult {
  hasOpeCheck: boolean;
  opeCheckDirPath: AccuracyToolCompList[] | null;
}

/**
 * 查找目录下以 verify 开头的子目录
 */
export async function findVerifySubDir(parentPath: string): Promise<string> {
  const parentUri = vscode.Uri.file(parentPath);
  const entries = await vscode.workspace.fs.readDirectory(parentUri);

  const verifyDir = entries.find(
    ([name, fileType]) => 
      fileType === vscode.FileType.Directory && name.startsWith('verify')
  );

  return verifyDir
    ? vscode.Uri.joinPath(parentUri, verifyDir[0]).fsPath
    : '';
}

async function findOpeCheck(
  flowVerifyPath?: string,
  level?: any
): Promise<OpeCheckResult> {
  const empty: OpeCheckResult = { hasOpeCheck: false, opeCheckDirPath: null };
  if (!flowVerifyPath) {
    return empty;
  }

  let flowVerifyUri = flowVerifyPath;
  if (level === COMPUTE_GRAPH_PATH_LEVER) {
    const rootDataDir =  findVerifyDir(flowVerifyUri, COMPUTE_GRAPH_PATH_LEVER)
    flowVerifyUri = await findVerifySubDir(rootDataDir);
  }
  if (!flowVerifyUri) {
    return empty;
  }

  const existingList = await SQLiteCache.getInstance().accuracyToolCompListGetByComputePath(flowVerifyUri);
  if (existingList.length > 0) {
    return { hasOpeCheck: true, opeCheckDirPath: existingList };
  }

  const fileUri = vscode.Uri.file(flowVerifyUri);
  const fsPath = fileUri.fsPath; 

  let files: [string, vscode.FileType][];
  try {
    files = await vscode.workspace.fs.readDirectory(fileUri);
  } catch {
    return empty;
  }
  
  const hasCmpFile = files.some(([name, fileType]) => 
    fileType === vscode.FileType.File && VERIFY_GRAPH_RESULT_CMP_REG_EXP.test(name)
  );

  if (!hasCmpFile) {
    return empty;
  }

  const compList = await getCmpFileList(fsPath);
  const allInsertData: AccuracyToolCompList[] = compList.map(filePath => ({
    file_path: filePath,
    first_req: '-1',
    compute_path: flowVerifyUri,
  }));

  await SQLiteCache.getInstance().accuracyToolCompListSet(flowVerifyUri, allInsertData);
  return { hasOpeCheck: true, opeCheckDirPath: allInsertData };
}
