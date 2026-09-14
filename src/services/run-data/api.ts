/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

function getExitCodeDescription(exitCode: number): string {
  const descriptions: Record<number, string> = {
    0: t('pypto.remoteTool.exitCode0') ?? 'Success',
    2: t('pypto.remoteTool.exitCode2') ?? 'Server error (Pod IP or NPU boot failed)',
    3: t('pypto.remoteTool.exitCode3') ?? 'SSH connection error',
    4: t('pypto.remoteTool.exitCode4') ?? 'Data sync failed',
    5: t('pypto.remoteTool.exitCode5') ?? 'Configuration error (token read failed)',
    6: t('pypto.remoteTool.exitCode6') ?? 'Invalid parameters',
    7: t('pypto.remoteTool.exitCode7') ?? 'Remote command execution failed',
    10: t('pypto.remoteTool.exitCode10') ?? 'Unknown error',
  };
  return descriptions[exitCode] ?? (t('pypto.remoteTool.exitCode10') ?? 'Unknown error');
}

function getUserHome(): string | undefined {
  return process.env.PYPTO_HOME || process.env.HOME || process.env.USERPROFILE;
}

async function checkRemoteToolEnv(): Promise<boolean> {
  if (os.platform() !== 'linux') {
    return false;
  }
  return new Promise<boolean>((resolve) => {
    exec('remote_tool.sh -h', { encoding: 'utf8', timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
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

/** 检查 rundata.json 中是否有缺失的文件或文件夹 */
function hasMissingRunDataFiles(rundataJsonPath: string): boolean {
  const allPaths = parseRunDataFilePaths(rundataJsonPath);
  if (!allPaths) {
    return false;
  }
  return allPaths.some((p) => !fs.existsSync(p));
}

/** 将路径分类为文件和文件夹 */
function classifyPaths(paths: string[]): { files: string[]; folders: string[] } {
  const files: string[] = [];
  const folders: string[] = [];
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      // 路径存在，使用 stat 判断
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        folders.push(p);
      } else {
        files.push(p);
      }
    } else {
      // 路径不存在，根据特征推断
      // 有扩展名视为文件，无扩展名或以 / 结尾视为文件夹
      if (p.endsWith('/') || !path.extname(p)) {
        folders.push(p);
      } else {
        files.push(p);
      }
    }
  }
  
  return { files, folders };
}

/** 动态构建同步消息，避免显示 "0 files" 或 "0 folders" */
function buildSyncMessage(
  filesKey: string,
  foldersKey: string,
  bothKey: string,
  fileCount: number,
  folderCount: number,
  extraVars?: Record<string, any>
): string {
  if (fileCount > 0 && folderCount > 0) {
    return t(bothKey, { files: fileCount, folders: folderCount, ...extraVars }) ?? '';
  } else if (fileCount > 0) {
    return t(filesKey, { count: fileCount, ...extraVars }) ?? '';
  } else {
    return t(foldersKey, { count: folderCount, ...extraVars }) ?? '';
  }
}

function getSyncPaths(): string | null {
  const userHome = getUserHome();
  if (!userHome) {
    vscode.window.showErrorMessage(t('pypto.remoteTool.envVarMissing', { vars: 'PYPTO_HOME/HOME/USERPROFILE' }));
    return null;
  }
  return userHome;
}

async function showMessageWithCopyCommand(
  message: string,
  command: string,
  severity: 'error' | 'warning'
): Promise<void> {
  const copyBtn = t('pypto.remoteTool.copyCommand') ?? 'Copy Command';
  const viewLogBtn = t('pypto.remoteTool.viewLog') ?? 'View Log';
  const showFn = severity === 'error' ? vscode.window.showErrorMessage : vscode.window.showWarningMessage;
  const action = await showFn(message, copyBtn, viewLogBtn);
  if (action === copyBtn) {
    await vscode.env.clipboard.writeText(command);
    vscode.window.showInformationMessage(t('pypto.remoteTool.commandCopied') ?? 'Command copied to clipboard');
  } else if (action === viewLogBtn) {
    const logUri = vscode.Uri.file('/opt/log/remote_tool.log');
    try {
      const doc = await vscode.workspace.openTextDocument(logUri);
      await vscode.window.showTextDocument(doc);
    } catch (err) {
      vscode.window.showErrorMessage(t('pypto.remoteTool.logNotFound') ?? 'Log file not found: /opt/log/remote_tool.log');
    }
  }
}

function showRemoteDataResult(result: ExecResult, command: string): void {
  if (result.success) {
    vscode.window.showInformationMessage(t('pypto.remoteTool.execSuccess'));
  } else {
    showMessageWithCopyCommand(
      t('pypto.remoteTool.execFailed', { exitCode: result.exitCode, stderr: result.stderr || 'Unknown error' }) ?? '',
      command,
      'error'
    );
  }
}

function showSyncFilesResult(
  result: ExecResult,
  totalFiles: number,
  totalFolders: number,
  syncedFiles: number,
  syncedFolders: number,
  command: string
): void {
  const allSuccess = syncedFiles === totalFiles && syncedFolders === totalFolders;
  const allFailed = syncedFiles === 0 && syncedFolders === 0;
  
  if (allSuccess) {
    const msg = buildSyncMessage(
      'pypto.remoteTool.syncSuccessFiles',
      'pypto.remoteTool.syncSuccessFolders',
      'pypto.remoteTool.syncSuccessFilesAndFolders',
      syncedFiles,
      syncedFolders
    );
    vscode.window.showInformationMessage(msg);
  } else if (allFailed) {
    const exitDesc = getExitCodeDescription(result.exitCode);
    const errorMsg = result.stderr ? `${exitDesc} - ${result.stderr}` : exitDesc;
    const msg = buildSyncMessage(
      'pypto.remoteTool.syncFailedFiles',
      'pypto.remoteTool.syncFailedFolders',
      'pypto.remoteTool.syncFailedFilesAndFolders',
      totalFiles,
      totalFolders,
      { exitCode: result.exitCode, stderr: errorMsg }
    );
    showMessageWithCopyCommand(msg, command, 'error');
  } else {
    const msg = buildSyncMessage(
      'pypto.remoteTool.syncPartialFiles',
      'pypto.remoteTool.syncPartialFolders',
      'pypto.remoteTool.syncPartialFilesAndFolders',
      totalFiles,
      totalFolders,
      { syncedFiles, syncedFolders }
    );
    showMessageWithCopyCommand(msg, command, 'warning');
  }
}

async function syncRemoteData(): Promise<void> {
  try {
    const envOk = await checkRemoteToolEnv();
    if (!envOk) {
      return;
    }
    const userHome = getSyncPaths();
    if (!userHome) {
      return;
    }
    const pyptoPath = `${userHome}/.pypto`;
    const execCommand = `remote_tool.sh exec --no-sync --command 'mkdir -p ${pyptoPath}' --pull-dir '${pyptoPath}'`;
    const progressTitle = t('pypto.remoteTool.syncing') ?? '';
    const result = await executeRemoteCommand(execCommand, progressTitle);
    showRemoteDataResult(result, execCommand);
  } catch (err) {
    console.warn('[PyPTO] Remote sync failed:', err);
  }
}

export async function syncRunDataFiles(rundataJsonPath: string): Promise<{ allSynced: boolean }> {
  try {
    const envOk = await checkRemoteToolEnv();
    if (!envOk) {
      return { allSynced: false };
    }
    const allPaths = parseRunDataFilePaths(rundataJsonPath);
    if (!allPaths) {
      return { allSynced: false };
    }
    
    // 只同步缺失的文件（夹）
    const missingPaths = allPaths.filter((fp) => !fs.existsSync(fp));
    if (missingPaths.length === 0) {
      return { allSynced: true };
    }
    
    // 分类缺失的文件和文件夹
    const { files: missingFiles, folders: missingFolders } = classifyPaths(missingPaths);
    
    const pullDir = missingPaths.join(',');
    const mkdirPaths = missingPaths.map((fp) => path.dirname(fp)).join(' ');
    const execCommand = `remote_tool.sh exec --no-sync --command 'mkdir -p ${mkdirPaths}' --pull-dir '${pullDir}'`;
    
    // 构建进度标题，区分文件和文件夹
    const progressTitle = buildSyncMessage(
      'pypto.remoteTool.syncingFiles',
      'pypto.remoteTool.syncingFolders',
      'pypto.remoteTool.syncingFilesAndFolders',
      missingFiles.length,
      missingFolders.length
    );
    
    const result = await executeRemoteCommand(execCommand, progressTitle);
    
    // 同步后检查缺失的文件（夹）是否同步成功
    const syncedMissingFiles = missingFiles.filter((fp) => fs.existsSync(fp)).length;
    const syncedMissingFolders = missingFolders.filter((fp) => fs.existsSync(fp)).length;
    
    showSyncFilesResult(
      result, 
      missingFiles.length,
      missingFolders.length,
      syncedMissingFiles,
      syncedMissingFolders,
      execCommand
    );
    
    return { 
      allSynced: (syncedMissingFiles === missingFiles.length) && 
                 (syncedMissingFolders === missingFolders.length) 
    };
  } catch (err) {
    console.error('[PyPTO] Sync rundata files failed:', err);
    vscode.window.showErrorMessage(t('pypto.remoteTool.syncFilesError', { error: getErrorMessage(err) }));
    return { allSynced: false };
  }
}

/** 已完全同步成功的 rundata 目录（所有文件都同步成功才标记，每次刷新重置） */
const syncedRunDataDirs = new Set<string>();

/**
 * 判断记录是否已无任何可用数据文件（含 opcheck/taskcheck 检测结果）。
 * 记录中的路径字段经 readRunData 的存在性过滤：本地不存在的路径（如远端源码路径）为 null。
 */
function isAllDataFilesMissing(record: OutputRecord): boolean {
  const hasFilePath = [record.sourceFilePath, record.controlFlowFilePath, record.swimlaneGraphFilePath, record.computeGraphDirPath].some(Boolean);
  return !hasFilePath && !record.hasOpeCheck && !record.hasTaskCheck;
}

/**
 * 尝试同步并刷新记录：检查缺失文件 → 同步（仅 Linux）→ 刷新缓存。
 * 无论是否执行同步，只要 rundata.json 存在就重读缓存，保证记录反映本地最新状态；
 * 只有全部同步成功才标记为已同步（syncedRunDataDirs），避免同一目录反复拉取
 */
async function trySyncAndRefresh(directoryPath: string): Promise<OutputRecord | undefined> {
  const rundataJsonPath = path.join(directoryPath, 'rundata.json');
  if (!fs.existsSync(rundataJsonPath)) {
    return undefined;
  }
  try {
    // 仅 Linux 执行远程同步；Windows 等环境完全不涉及同步逻辑
    if (os.platform() === 'linux' && !syncedRunDataDirs.has(directoryPath) && hasMissingRunDataFiles(rundataJsonPath)) {
      const { allSynced } = await syncRunDataFiles(rundataJsonPath);
      if (allSynced) {
        syncedRunDataDirs.add(directoryPath);
      }
    }
    return await useService('runData').refreshOutputRecord(directoryPath);
  } catch (err) {
    console.warn('[PyPTO] Sync and refresh failed:', err);
    return undefined;
  }
}

/**
 * 刷新后同步列表第一条（最新）记录的缺失文件，并按原逻辑重新缓存（仅 Linux）。
 * 非 Linux 环境或无缺失文件时不做任何同步与重读
 */
async function syncFirstRunDataFiles(firstRecord: OutputRecord | undefined): Promise<OutputRecord | undefined> {
  if (!firstRecord) {
    return undefined;
  }
  const rundataJsonPath = path.join(firstRecord.directoryPath, 'rundata.json');
  if (os.platform() !== 'linux' || !fs.existsSync(rundataJsonPath) || !hasMissingRunDataFiles(rundataJsonPath)) {
    return undefined;
  }
  return trySyncAndRefresh(firstRecord.directoryPath);
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
 * 获取运行结果详情。
 * - Linux：rundata.json 存在缺失路径时先尝试同步补齐，但无论同步是否成功，均按本地已有文件展示；
 * - Windows：不涉及任何同步逻辑，仅按本地文件展示；
 * - 展示基准为记录字段（经本地存在性过滤），远端专有路径本地缺失不影响打开
 */
export async function fetchRunDataDetail({ outputDirPath }: GetOutputDetailParams): Promise<GetOutputDetailRes> {
  const runDataService = useService('runData');
  const rundataJsonPath = path.join(outputDirPath, 'rundata.json');

  // Step 1: 快速路径——记录有可用数据且无需同步时直接使用缓存
  const record = await runDataService.getOutputRecord(outputDirPath);
  const shouldSyncFirst =
    os.platform() === 'linux' && fs.existsSync(rundataJsonPath) && hasMissingRunDataFiles(rundataJsonPath);
  if (record && !isAllDataFilesMissing(record) && !shouldSyncFirst) {
    const detail = await runDataService.getOutputDetail(outputDirPath);
    return { data: detail ?? null };
  }

  // Step 2: 尝试同步缺失文件（仅 Linux）并强制重读缓存
  const refreshedRecord = await trySyncAndRefresh(outputDirPath);

  // Step 3: 按本地实际文件判断——仍有任一可用数据文件即展示（同步成败不影响打开），全部缺失才提示未找到
  const finalRecord = refreshedRecord ?? record;
  if (!finalRecord || isAllDataFilesMissing(finalRecord)) {
    vscode.window.showWarningMessage(t('pypto.remoteTool.filesNotFound'));
    return { data: null };
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
