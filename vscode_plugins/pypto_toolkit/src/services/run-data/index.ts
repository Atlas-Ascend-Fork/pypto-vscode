import path from 'node:path';
import * as vscode from 'vscode';

import { SqlStore } from '../../core/store';
import type { OutputRecord } from '../../types/workspace';
import { defineAttributes, Store } from '../../core/store';
import { BasicService } from '../basic-service';
import { getOutputRecord, readRunDataList, RunDataDir } from './file-system-utils';
import { AsyncListResolver, asyncResolvingList } from './utils/async-resolving-list';

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
  private store: RunDataStore;

  private listResolver?: AsyncListResolver<RunDataDir, unknown>;

  constructor() {
    super('runData');
    this.store = new SqlStore('run_data', RUN_DATA_ATTRIBUTES);
    this.store.onClear(async () => {
      await this.listResolver?.stop();
      this.scanDirectory();
    });
    this._disposables.push(this.store);
    this.scanDirectory();
    this.watchFileChange();
  }

  public query(): ReturnType<RunDataStore['query']> {
    return this.store.query();
  }

  public delete(output: OutputRecord): ReturnType<RunDataStore['delete']> {
    return this.store.delete(output);
  }

  public async getRecordByDirectoryPath(directoryPath: string): Promise<OutputRecord | undefined> {
    const [record] = await this.query().filter({ directoryPath }).exec();

    // 数据库没有记录时，从文件目录读取
    if (!record) {
      const runDataUri = vscode.Uri.file(directoryPath);
      return await getOutputRecord(runDataUri);
    }

    return record;
  }

  public async waitForScanning(recordCount: number = Infinity): Promise<void> {
    if (!this.listResolver) {
      return;
    }
    await this.listResolver.waitFor(recordCount);
    return;
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
    this.listResolver = asyncResolvingList(runDataList, async ({ dirname, executeTime }) => {
      if (executeTime <= (latestRecord?.executeTime ?? '')) {
        return { skip: true };
      }
      const rootDirUri = vscode.Uri.joinPath(runDataCollectionUri, dirname);
      await this.setOutputToStore(rootDirUri);
      return { data: null };
    });
  }

  /**
   * 监听文件变化
   */
  private watchFileChange() {
    const pattern = new vscode.RelativePattern(vscode.Uri.file(RUN_DATA_HOME), '{rundata_*/,rundata_*/rundata.json}');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this._disposables.push(watcher);
    watcher.onDidCreate(async (uri) => {
      const outputUri = this.getOutputUri(uri);
      this.setOutputToStore(outputUri);
    });
    watcher.onDidChange((uri) => {
      const outputUri = this.getOutputUri(uri);
      this.setOutputToStore(outputUri);
    });
    watcher.onDidDelete((uri) => {
      const outputUri = this.getOutputUri(uri);
      this.store.query().filter({ directoryPath: outputUri.fsPath }).slice(0, 1).delete();
    });
  }

  private getOutputUri(uri: vscode.Uri): vscode.Uri {
    return uri.fsPath.endsWith('rundata.json') ? vscode.Uri.joinPath(uri, '..') : uri;
  }

  private async setOutputToStore(runDataUri: vscode.Uri) {
    const record = await getOutputRecord(runDataUri);
    if (record) {
      await this.store.set(record);
    }
  }
}
