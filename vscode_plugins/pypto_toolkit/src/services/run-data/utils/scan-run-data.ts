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
  const flowVerifyPath = runData.flow_verify_path ? runData.flow_verify_path : (runData.verify_path ? runData.verify_path : null);
  if (![sourceFilePath, controlFlowFilePath, swimlaneGraphFilePath, computeGraphDirPath].some(Boolean)) {
    return undefined;
  }

  const { hasOpeCheck, opeCheckDirPath } = await findOpeCheck(flowVerifyPath ?? undefined);

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

const VERIFY_DIR_REG_EXP = /^verify_/;
const VERIFY_GRAPH_RESULT_CMP_REG_EXP = /^verify_graph_result_cmp/;

interface OpeCheckResult {
  hasOpeCheck: boolean;
  opeCheckDirPath: AccuracyToolCompList[] | null;
}

async function findOpeCheck(flowVerifyPath?: string): Promise<OpeCheckResult> {
  const empty: OpeCheckResult = { hasOpeCheck: false, opeCheckDirPath: null };

  const flowVerifyUri = (flowVerifyPath ?? '').split('/').slice(0, -1).join('/');
  if (!flowVerifyUri) {
    return empty;
  }

  const existingList = await SQLiteCache.getInstance().accuracyToolCompListGetByComputePath(flowVerifyUri);
  if (existingList.length > 0) {
    return { hasOpeCheck: true, opeCheckDirPath: existingList };
  }

  const fileUri = vscode.Uri.file(flowVerifyUri);
  const subList = await vscode.workspace.fs.readDirectory(fileUri);
  const allInsertData: AccuracyToolCompList[] = [];

  for (const [subPath, fileType] of subList) {
    if (fileType !== vscode.FileType.Directory || !VERIFY_DIR_REG_EXP.test(subPath)) {
      continue;
    }
    const verifyDirUri = vscode.Uri.joinPath(fileUri, subPath);
    try {
      const files = await vscode.workspace.fs.readDirectory(verifyDirUri);
      if (files.some(([name]) => VERIFY_GRAPH_RESULT_CMP_REG_EXP.test(name))) {
        const compList = await getCmpFileList(verifyDirUri.fsPath);
        for (const filePath of compList) {
          allInsertData.push({
            file_path: filePath,
            first_req: '-1',
            compute_path: flowVerifyUri,
          });
        }
      }
    } catch {
      continue;
    }
  }

  if (allInsertData.length > 0) {
    await SQLiteCache.getInstance().accuracyToolCompListSet(flowVerifyUri, allInsertData);
    return { hasOpeCheck: true, opeCheckDirPath: allInsertData };
  }

  return empty;
}
