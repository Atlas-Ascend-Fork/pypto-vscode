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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import path from 'node:path';
import * as vscode from 'vscode';

import { SqlStore } from '../../core/store';
import type { OutputRecord, OutputDetail } from '../../types/workspace';
import { defineAttributes, Store } from '../../core/store';
import { BasicService } from '../basic-service';
import { getOutputDirectory } from './utils/scan-output';
import { readRunData, readRunDataList, RunDataDir, findVerifyDir, COMPUTE_GRAPH_PATH_LEVER, findVerifySubDir } from './utils/scan-run-data';
import { AsyncListResolver, AsyncListResolverImpl } from './utils/async-resolving-list';
import { deleteFile } from '../../utils/file-system';
import { t } from 'i18next';
import { getControlFlowStore } from '../control-flow/store';
import { SQLiteCache, AccuracyToolCompList } from '../../core/sqliteCache';

/** 当前用户根目录 */
const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;

/** PYPTO运行记录根目录 */
const RUN_DATA_HOME = process.env.PYPTO_HOME
  ? `${process.env.PYPTO_HOME}${path.sep}run`
  : `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

type RecordOrDetail = OutputRecord & { directoryTree?: OutputDetail['directoryTree']; noDirectoryTree: boolean };
type RunDataStore = Store<RecordOrDetail, 'title', 'executeTime' | 'directoryPath' | 'noDirectoryTree' | 'swimlaneGraphFilePath' | 'hasOpeCheck' | 'opeCheckDirPath'| 'hasTaskCheck' | 'taskCheckDirPath'>;

const RUN_DATA_ATTRIBUTES = defineAttributes<RecordOrDetail>({
  title: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  executeTime: { type: String, isQuery: true },
  directoryPath: { type: String, isQuery: true },
  sourceFilePath: { type: String },
  controlFlowFilePath: { type: String, isQuery: true },
  computeGraphDirPath: { type: String },
  swimlaneGraphFilePath: { type: String, isQuery: true },
  noDirectoryTree: { type: Boolean, isQuery: true },
  directoryTree: { type: Object },
  hasOpeCheck: { type: Boolean, isQuery: true, defaultValue: false },
  opeCheckDirPath: { type: Object, isQuery: true },
  flowVerifyPath: { type: String },
  hasTaskCheck: { type: Boolean, isQuery: true, defaultValue: false },
  taskCheckDirPath: { type: Object, isQuery: true },
});

export class RunDataService extends BasicService {
  private store: RunDataStore;

  private listResolver?: AsyncListResolver<RunDataDir, unknown>;

  private delayTimer: ReturnType<typeof setTimeout> | null;

  constructor() {
    super('runData');
    this.store = new SqlStore('run_data', RUN_DATA_ATTRIBUTES);
    this.store.onClear(async () => {
      await this.listResolver?.stop();
      this.scanDirectory();
    });
    this._disposables.push(this.store);
    this.scanDirectory();
  }

  public query(): ReturnType<RunDataStore['query']> {
    return this.store.query().filter({ noDirectoryTree: false });
  }

  public delete(output: OutputRecord): ReturnType<RunDataStore['delete']> {
    return this.store.delete(output);
  }

  /**
   * 删除数据
   * @outputList outputList 数据地址列表
   */
  public async deleteData(outputList: OutputRecord[]): Promise<void> {
    // 批量删除数据库
    for (const output of outputList) {
      await this.store.delete(output);
      if (output.controlFlowFilePath) {
        await getControlFlowStore().delete({ sourceFilePath: output.controlFlowFilePath });
      }
    }
    // 批量删除文件
    const deletePromises = outputList.map(async (output) => {
      const runDataUri = vscode.Uri.file(output.directoryPath);
      await deleteFile(runDataUri)
      if (output.computeGraphDirPath) {
        const outputUri = vscode.Uri.file(output.computeGraphDirPath);
        await deleteFile(outputUri)
      }
    });
    // 并行执行所有删除操作
    await Promise.all(deletePromises);
  }

  /**
   * 获取运行记录
   * @param runDataDirPath rundata目录
   */
  public async getOutputRecord(runDataDirPath: string): Promise<OutputRecord | undefined> {
    const runDataUri = vscode.Uri.file(runDataDirPath);
    const record = await this.queryOutputFromStore(runDataUri);
    if (record) {
      return this.mergeOpeCheckFromComparelist(record);
    } else {
      const fileRecord = await readRunData(runDataUri);
      return fileRecord ? this.mergeOpeCheckFromComparelist(fileRecord) : undefined;
    }
  }

  /**
   * 强制从文件重读运行记录并更新缓存（展开时检查数据文件最新状态）
   * @param runDataDirPath rundata目录
   */
  public async refreshOutputRecord(runDataDirPath: string): Promise<OutputRecord | undefined> {
    const runDataUri = vscode.Uri.file(runDataDirPath);
    const record = await readRunData(runDataUri);
    if (record) {
      await this.store.set({ noDirectoryTree: false, ...record });
      return this.mergeOpeCheckFromComparelist(record);
    }
    // rundata.json 不存在或已失效时，删除缓存记录
    await this.store.query().filter({ directoryPath: runDataDirPath }).delete();
    return undefined;
  }

  private async mergeOpeCheckFromComparelist(record: OutputRecord): Promise<OutputRecord> {
    if (!record.hasOpeCheck && !record.hasTaskCheck) {
        return record;
    }

    const flowVerifyUri = record.flowVerifyPath 
        ?? await findVerifySubDir(findVerifyDir(record.computeGraphDirPath, COMPUTE_GRAPH_PATH_LEVER));

    const updates: Partial<Pick<OutputRecord, 'opeCheckDirPath' | 'taskCheckDirPath'>> = {};

    if (record.hasOpeCheck) {
        const opeList = await SQLiteCache.getInstance()
            .accuracyToolCompListGetByComputePath(`${flowVerifyUri}_opcheck`);
        if (opeList.length > 0) {
            updates.opeCheckDirPath = opeList;
        }
    }

    if (record.hasTaskCheck) {
        const taskList = await SQLiteCache.getInstance()
            .accuracyToolCompListGetByComputePath(`${flowVerifyUri}_taskcheck`);
        if (taskList.length > 0) {
            updates.taskCheckDirPath = taskList;
        }
    }

    return Object.keys(updates).length > 0 
        ? { ...record, ...updates } 
        : record;
  }

  private hasDirectoryTree(record: OutputRecord): record is OutputDetail {
    return 'directoryTree' in record
  }
  /**
   * 获取运行记录详情
   * @param runDataDirPath rundata目录
   */
  public async getOutputDetail(runDataDirPath: string): Promise<OutputDetail | undefined> {
    const record = await this.getOutputRecord(runDataDirPath);
    if (!record) {
      return undefined;
    }

    // 动态获取国际化
    if (this.hasDirectoryTree(record) && record.directoryTree) {
      const nameMap = {
        controlFlow: t('PyPTOToolkit.workspace.controlFlowName'),
        swimlaneGraph: t('PyPTOToolkit.workspace.swimlaneGraphName'),
        compute: t('PyPTOToolkit.workspace.computeGraphName'),
      };
      record.directoryTree.children.forEach(item => {
        if (item.type === 'file') {
          item.name = t(nameMap[item.fileType])
        } else if (item.type === 'dir') {
          item.name = t(nameMap[item.directoryType])
        }
      });
    }
    if (this.isDetailLoaded(record)) {
      return record;
    }

    // 缓存运行记录没有详情，扫描output目录，并更新缓存
    const outputUri = vscode.Uri.file(runDataDirPath);
    const directoryTree = await getOutputDirectory(outputUri, record);
    const recordWithDetail = {
      ...record,
      noDirectoryTree: false,
      directoryTree,
    };
    if (await this.store.find({ title: record.title })) {
      this.store.set(recordWithDetail);
    }
    return directoryTree ? recordWithDetail : undefined;
  }

  /**
   * 扫描目录
   */
  public async scanDirectory(): Promise<void> {
    if (this.listResolver?.isResolving()) {
      return;
    }

    const runDataCollectionUri = vscode.Uri.file(RUN_DATA_HOME);
    const runDataList = await readRunDataList(runDataCollectionUri);
    const [latestRecord] = await this.store.query().sort('executeTime', 'desc').slice(0, 1).exec();
    this.listResolver = new AsyncListResolverImpl<RunDataDir, unknown>(async ({ dirname, executeTime }) => {
      // 上次扫描时间之前的目录，延后扫描
      if (executeTime <= (latestRecord?.executeTime ?? '')) {
        this.listResolver?.stop().then((resolvedList) => {
          this.delay(5000, () => {
            this.updateSavedRunData(runDataList.slice(resolvedList.length));
          });
        });
        return { skip: true };
      }

      const rootDirUri = vscode.Uri.joinPath(runDataCollectionUri, dirname);
      await this.addNewOutputToStore(rootDirUri);
      return { data: null };
    });
    this.listResolver.start(runDataList);
  }

  /**
   * 等待扫描目录
   * @param targetLength 扫描至多少条数据继续运行
   */
  public async waitForScanning(targetLength: number = Infinity): Promise<void> {
    if (!this.listResolver) {
      return;
    }
    await this.listResolver.waitFor(targetLength);
    return;
  }

  private async updateSavedRunData(savedDirs: RunDataDir[]): Promise<void> {
    if (this.listResolver?.isResolving()) {
      return;
    }
    const runDataCollectionUri = vscode.Uri.file(RUN_DATA_HOME);
    for (const { dirname } of savedDirs) {
      const rootDirUri = vscode.Uri.joinPath(runDataCollectionUri, dirname);
      await this.updateOutputToStore(rootDirUri);
    }
  }

  private async queryOutputFromStore(runDataUri: vscode.Uri): Promise<RecordOrDetail | undefined> {
    const [record] = await this.store.query().filter({ directoryPath: runDataUri.fsPath }).exec();
    return record;
  }

  private async addNewOutputToStore(runDataUri: vscode.Uri): Promise<void> {
    const record = await readRunData(runDataUri);
    if (record) {
      await this.store.set({ noDirectoryTree: false, ...record });
    }
  }

  private async updateOutputToStore(runDataUri: vscode.Uri): Promise<void> {
    const storeRecord = await this.queryOutputFromStore(runDataUri);
    if (!storeRecord) {
      await this.addNewOutputToStore(runDataUri);
      return;
    }
    const record = await readRunData(runDataUri);
    if (record) {
      await this.store.set({ ...storeRecord, ...record });
    } else {
      await this.store.query().filter({ directoryPath: runDataUri.fsPath }).delete();
    }
  }

  /**
   * 是否扫描过详情
   */
  private isDetailLoaded(recordOrDetail: OutputRecord): recordOrDetail is OutputDetail {
    return Reflect.has(recordOrDetail, 'directoryTree');
  }

  /**
   * 延后执行
   * @param ms 延后时间（毫秒）
   * @param handler 执行函数
   */
  private delay(ms: number, handler: () => void) {
    if (this.delayTimer) {
      clearTimeout(this.delayTimer);
    }
    this.delayTimer = setTimeout(() => {
      this.delayTimer = null;
      handler();
    }, ms);
  }
}
