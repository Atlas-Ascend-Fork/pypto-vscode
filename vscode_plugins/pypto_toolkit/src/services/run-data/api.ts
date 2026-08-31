/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { OutputDetail, OutputRecord } from '../../types/workspace';
import { useService } from '..';
import * as os from 'os';
import { exec } from 'child_process';
import * as vscode from 'vscode';
import { t } from 'i18next';
import * as fs from 'fs';
import * as path from 'path';

interface ExecResult {
  success: boolean;
  stderr: string;
  exitCode: number;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getUserHome(): string | undefined {
  return process.env.PYPTO_HOME || process.env.HOME || process.env.USERPROFILE;
}

function getWorkspaceOrFallback(fallbackPath: string): string {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(fallbackPath);
}

async function checkRemoteToolEnv(showError: boolean): Promise<boolean> {
  if (os.platform() !== 'linux') {
    if (showError) {
      vscode.window.showErrorMessage(t('pypto.remoteTool.linuxOnly'));
    }
    return false;
  }
  const envCheck = await new Promise<boolean>((resolve) => {
    exec('remote_tool.sh -h', { encoding: 'utf8', timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
  if (!envCheck) {
    if (showError) {
      vscode.window.showErrorMessage(t('pypto.remoteTool.notTargetEnv'));
    }
    return false;
  }
  return true;
}

async function executeRemoteCommand(execCommand: string, progressTitle: string): Promise<ExecResult> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false,
    },
    async () => {
      return new Promise<ExecResult>((resolve) => {
        exec(execCommand, { encoding: 'utf8', timeout: 300000, maxBuffer: 1024 * 1024 * 10 }, (error, _stdout, stderr) => {
          const exitCode = error ? (error as any).code ?? 1 : 0;
          resolve({
            success: !error,
            stderr: (stderr as string).trim(),
            exitCode: typeof exitCode === 'number' ? exitCode : 1,
          });
        });
      });
    },
  );
}

function isFilePathEntry([key, value]: [string, unknown]): boolean {
  return key !== 'runtype' && typeof value === 'string' && (value as string).trim() !== '';
}

function parseRunDataFilePaths(rundataJsonPath: string): string[] | null {
  if (!fs.existsSync(rundataJsonPath)) {
    vscode.window.showErrorMessage(t('pypto.remoteTool.fileNotFound', { path: rundataJsonPath }));
    return null;
  }
  const rundataContent = fs.readFileSync(rundataJsonPath, 'utf-8');
  const rundata = JSON.parse(rundataContent);
  const filePaths = Object.entries(rundata)
    .filter(isFilePathEntry)
    .map(([, value]) => value as string);
  if (filePaths.length === 0) {
    vscode.window.showInformationMessage(t('pypto.remoteTool.noFilesToSync'));
    return null;
  }
  return filePaths;
}

function getSyncPaths(): string | null {
  const userHome = getUserHome();
  if (!userHome) {
    vscode.window.showErrorMessage(t('pypto.remoteTool.envVarMissing', { vars: 'PYPTO_HOME/HOME/USERPROFILE' }));
    return null;
  }
  return userHome;
}

function showRemoteDataResult(result: ExecResult): void {
  if (result.success) {
    vscode.window.showInformationMessage(t('pypto.remoteTool.execSuccess'));
  } else {
    vscode.window.showErrorMessage(
      t('pypto.remoteTool.execFailed', { exitCode: result.exitCode, stderr: result.stderr || 'Unknown error' }),
    );
  }
}

function showSyncFilesResult(result: ExecResult, syncedCount: number, totalCount: number): void {
  if (!result.success) {
    vscode.window.showErrorMessage(
      t('pypto.remoteTool.syncFilesFailed', { count: totalCount, exitCode: result.exitCode, stderr: result.stderr || 'Unknown error' }),
    );
    return;
  }
  if (syncedCount === totalCount) {
    vscode.window.showInformationMessage(t('pypto.remoteTool.syncFilesSuccess', { count: syncedCount }));
  } else {
    vscode.window.showWarningMessage(t('pypto.remoteTool.syncFilesPartial', { synced: syncedCount, total: totalCount }));
  }
}

async function syncRemoteData(): Promise<void> {
  try {
    const envOk = await checkRemoteToolEnv(false);
    if (!envOk) {
      return;
    }
    const userHome = getSyncPaths();
    if (!userHome) {
      return;
    }
    const pullDir = `${userHome}/.pypto`;
    const mkdirPaths = `${userHome}/.pypto`;
    const execCommand = `remote_tool.sh exec --no-sync --command 'mkdir -p ${mkdirPaths}' --pull-dir '${pullDir}'`;
    const progressTitle = t('pypto.remoteTool.syncing') ?? '';
    const result = await executeRemoteCommand(execCommand, progressTitle);
    showRemoteDataResult(result);
  } catch (err) {
    console.warn('[PyPTO] Remote sync failed:', err);
  }
}

export async function syncRunDataFiles(rundataJsonPath: string): Promise<void> {
  try {
    const envOk = await checkRemoteToolEnv(true);
    if (!envOk) {
      return;
    }
    const filePaths = parseRunDataFilePaths(rundataJsonPath);
    if (!filePaths) {
      return;
    }
    const pullDir = filePaths.join(',');
    const workspace = getWorkspaceOrFallback(rundataJsonPath);
    const mkdirPaths = filePaths.map((fp) => path.dirname(fp)).join(' ');
    const execCommand = `remote_tool.sh exec --no-sync --command 'mkdir -p ${mkdirPaths}' --pull-dir '${pullDir}'`;
    const progressTitle = t('pypto.remoteTool.syncingFiles', { count: filePaths.length }) ?? '';
    const result = await executeRemoteCommand(execCommand, progressTitle);
    const syncedCount = filePaths.filter((fp) => fs.existsSync(fp)).length;
    showSyncFilesResult(result, syncedCount, filePaths.length);
  } catch (err) {
    console.error('[PyPTO] Sync rundata files failed:', err);
    vscode.window.showErrorMessage(t('pypto.remoteTool.syncFilesError', { error: getErrorMessage(err) }));
  }
}

/** 判断记录的数据文件是否全部缺失（含 opcheck/taskcheck 检测结果） */
function isAllDataFilesMissing(record: OutputRecord): boolean {
  const hasFilePath = [record.sourceFilePath, record.controlFlowFilePath, record.swimlaneGraphFilePath, record.computeGraphDirPath].some(Boolean);
  return !hasFilePath && !record.hasOpeCheck && !record.hasTaskCheck;
}

/** 已尝试同步过数据文件的 rundata 目录（每次刷新重置，避免重复同步） */
const syncedRunDataDirs = new Set<string>();

/**
 * 刷新后同步列表第一条（最新）记录的数据文件，并按原逻辑重新缓存
 */
async function syncFirstRunDataFiles(firstRecord: OutputRecord | undefined): Promise<OutputRecord | undefined> {
  if (!firstRecord || !isAllDataFilesMissing(firstRecord)) {
    return undefined;
  }
  const rundataJsonPath = path.join(firstRecord.directoryPath, 'rundata.json');
  if (!fs.existsSync(rundataJsonPath)) {
    return undefined;
  }
  // 静默检查环境，非目标环境直接跳过
  if (!(await checkRemoteToolEnv(false))) {
    return undefined;
  }
  try {
    await syncRunDataFiles(rundataJsonPath);
    syncedRunDataDirs.add(firstRecord.directoryPath);
    // 同步结束后按原逻辑重新缓存
    return await useService('runData').refreshOutputRecord(firstRecord.directoryPath);
  } catch (err) {
    console.warn('[PyPTO] Sync first rundata files failed:', err);
    return undefined;
  }
}

export interface GetOutputRecordParams {
  /** 页码 */
  page: number;

  /** 分页数量，默认20 */
  pageSize?: number;

  /** 排序属性 */
  sortBy?: 'executeTime';

  /** 正序 or 倒序 */
  sortOrder?: 'asc' | 'desc';

  /** 强制重新读取文件 */
  forceReloadFromFiles?: boolean;

  /** 是否三栏视图 */
  isThreeColumnNotNull?: boolean;

  /** 搜索关键词 */
  titleKeyword?: string;

  /** 是否精确匹配 */
  isExactMatch?: boolean;
}

export interface GetOutputRecordsRes {
  data: OutputRecord[];
  total: number;
}

/**
 * 获取运行结果记录
 */
export async function getRunDataList(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  const { page, pageSize = 50, sortBy = 'executeTime', sortOrder = 'desc', forceReloadFromFiles, isThreeColumnNotNull = false, titleKeyword, isExactMatch = false } = params;
  const runDataService = useService('runData');
  if (forceReloadFromFiles) {
    await syncRemoteData();
    await runDataService.scanDirectory();
  }
  const isDefaultSortCondition = sortBy === 'executeTime' && sortOrder === 'desc';
  const waitingCount = isDefaultSortCondition ? page * pageSize : undefined;
  await runDataService.waitForScanning(waitingCount);
  const query = runDataService
    .query()
    .sort(sortBy, sortOrder);
  if (titleKeyword) {
    query.search('title', titleKeyword, isExactMatch);
  }
  // 三栏联动视图确保泳道图文件地址、控制流文件地址存在
  if (isThreeColumnNotNull) {
    query.notNull(['swimlaneGraphFilePath', 'controlFlowFilePath']);
  }
  const total = await query.count();
  const records = await query.slice(pageSize * (page - 1), pageSize * page).exec();
  // 刷新后同步列表第一条（最新）记录的数据文件，并更新列表数据
  if (forceReloadFromFiles) {
    syncedRunDataDirs.clear();
    const refreshedRecord = await syncFirstRunDataFiles(records[0]);
    if (refreshedRecord) {
      records[0] = { ...refreshedRecord, noDirectoryTree: false };
    }
  }
  const list = records.map<OutputRecord>((record) => ({ ...record, directoryTree: undefined }));
  return { data: list, total };
}

/**
 * 删除数据
 */
export async function deleteRunData(params: { directoryPaths: string[] }): Promise<void> {
  const runDataService = useService('runData')
  const recordPromises = params.directoryPaths.map(async (directoryPath) => {
    return await runDataService.getOutputRecord(directoryPath);
  });
  const records = await Promise.all(recordPromises);
  // 过滤掉无效或不存在的记录
  const validRecords = records.filter((record): record is OutputRecord => record !== undefined);
  if (validRecords.length > 0) {
    await runDataService.deleteData(validRecords);
  }
}

export interface GetOutputDetailParams {
  outputDirPath: string;
}

export interface GetOutputDetailRes {
  data: OutputDetail | null;
}

/**
 * 获取运行结果详情（缓存有数据文件时直接使用缓存；全缺失时未同步过的尝试同步，已同步过的直接提示）
 */
export async function getOutputDetail({ outputDirPath }: GetOutputDetailParams): Promise<GetOutputDetailRes> {
  const runDataService = useService('runData');
  // 优先读缓存，缓存已有数据文件时无需重读
  let record = await runDataService.getOutputRecord(outputDirPath);
  if (!record || isAllDataFilesMissing(record)) {
    // 缓存无数据文件，强制重读文件获取最新存在状态
    record = await runDataService.refreshOutputRecord(outputDirPath);
    if (!record || isAllDataFilesMissing(record)) {
      // 未同步过的记录尝试同步远程文件后重读（刷新时已同步过第一条的除外）
      const rundataJsonPath = path.join(outputDirPath, 'rundata.json');
      let hasSynced = false;
      if (os.platform() === 'linux' && fs.existsSync(rundataJsonPath) && !syncedRunDataDirs.has(outputDirPath)) {
        syncedRunDataDirs.add(outputDirPath);
        await syncRunDataFiles(rundataJsonPath);
        hasSynced = true;
        record = await runDataService.refreshOutputRecord(outputDirPath);
      }
      if (!record || isAllDataFilesMissing(record)) {
        // 本次执行过同步仍无数据提示同步后未找到；未同步（如 Windows 环境无法执行脚本）直接提示未找到
        const messageKey = hasSynced ? 'pypto.remoteTool.filesDeleted' : 'pypto.remoteTool.filesNotFound';
        vscode.window.showWarningMessage(t(messageKey));
        return { data: null };
      }
    }
  }
  const detail = await runDataService.getOutputDetail(outputDirPath);
  return { data: detail ?? null };
}

export interface GetRunDataBySwimlaneGraphPathParams {
  swimlaneGraphPath: string;
}

/**
 * 根据泳道图路径获取运行结果记录
 * @param swimlaneGraphPath
 * @returns
 */
export async function getRunDataBySwimlaneGraphPath({
  swimlaneGraphPath,
}: GetRunDataBySwimlaneGraphPathParams): Promise<OutputRecord | null> {
  const runDataService = useService('runData');
  const [record] = await runDataService.query().filter({ swimlaneGraphFilePath: swimlaneGraphPath }).exec();
  return record ?? null;
}
