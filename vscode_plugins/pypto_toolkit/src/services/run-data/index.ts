import path from 'node:path';

import * as vscode from 'vscode';

import { SqlStore } from '../../core/store';
import { OutputRecord, RunDataManifest } from '../../types/workspace';
import { defineAttributes, Store } from '../../core/store';
import { BasicService } from '../basic-service';

/** 当前用户根目录 */
const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;

/** PYPTO运行记录根目录 */
const RUN_DATA_HOME = process.env.PYPTO_HOME
  ? `${process.env.PYPTO_HOME}${path.sep}run`
  : `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

type RunDataStore = Store<OutputRecord, 'title', 'executeTime' | 'directoryPath'>;

const RUN_DATA_ATTRIBUTES = defineAttributes({
  title: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  executeTime: { type: String, isQuery: true },
  directoryPath: { type: String, isQuery: true },
  sourceFilePath: { type: String },
  controlFlowFilePath: { type: String },
  computeGraphDirPath: { type: String },
  swimlaneGraphFilePath: { type: String },
});

export class RunDataService extends BasicService {
  public name = 'runData';

  private store: RunDataStore;

  constructor(context: vscode.ExtensionContext) {
    super(() => {});
    this.store = new SqlStore('run_data', RUN_DATA_ATTRIBUTES, context);
    this.scanDirectory();
  }

  public query(): ReturnType<RunDataStore['query']> {
    return this.store.query();
  }

  public delete(output: OutputRecord): ReturnType<RunDataStore['delete']> {
    return this.store.delete(output);
  }

  private async scanDirectory(): Promise<void> {
    const runDataCollectionUri = vscode.Uri.file(RUN_DATA_HOME);
    const [latestRecord] = await this.store.query().sort('executeTime', 'desc').slice(0, 1).exec();
    const outputList = await getRecordsFromDirectory(runDataCollectionUri, latestRecord?.executeTime);
    for (const outputRecord of outputList) {
      this.store.set(outputRecord);
    }
  }
}

async function getRecordsFromDirectory(directoryUri: vscode.Uri, startFrom: string | undefined): Promise<OutputRecord[]> {
  let subList: [string, vscode.FileType][];
  try {
    subList = await vscode.workspace.fs.readDirectory(directoryUri);
  } catch {
    // 文件夹不存在
    subList = [];
  }
  const records: OutputRecord[] = [];
  for (const [subPath, fileType] of subList) {
    // 非目录无需扫描
    if (fileType !== vscode.FileType.Directory) {
      continue;
    }

    // 最新记录之前的目录无需扫描
    const { datetimeFormat } = resolveExecuteTime(subPath);
    if (!datetimeFormat || datetimeFormat <= (startFrom ?? '')) {
      continue;
    }
    const rootDirUri = vscode.Uri.joinPath(directoryUri, subPath);
    const runData = await readOutputRunData(rootDirUri);
    if (runData) {
      const record = getOutputRecord(rootDirUri, runData);
      records.push(record);
    }
  }

  return records;
}

const RUNDATA_FILE_NAME = 'rundata.json';

/**
 * 读取rundata文件
 */
async function readOutputRunData(outputUri: vscode.Uri): Promise<RunDataManifest | null> {
  try {
    const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(outputUri, RUNDATA_FILE_NAME));
    return JSON.parse(fileContent.toString());
  } catch {
    return null;
  }
}

/**
 * 获取output记录
 */
function getOutputRecord(outputUri: vscode.Uri, runData: RunDataManifest): OutputRecord {
  const directoryPath = outputUri.path;
  const sourceFilePath = runData.pto_src_file || null;
  const controlFlowFilePath = runData.program_file || null;
  const swimlaneGraphFilePath = runData.swim_graph_path || null;
  const computeGraphDirPath = runData.compute_graph_path || null;

  const directoryName = path.posix.basename(directoryPath);
  const executeTime = resolveExecuteTime(directoryName)!;
  const title = `${runData.runtype}_${executeTime.titleFormat}`;
  return {
    title,
    executeTime: executeTime.datetimeFormat,
    directoryPath,
    sourceFilePath,
    controlFlowFilePath,
    swimlaneGraphFilePath,
    computeGraphDirPath,
  };
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
