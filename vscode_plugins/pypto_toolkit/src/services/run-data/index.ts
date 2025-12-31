import path from 'node:path';
import * as vscode from 'vscode';

import { SqlStore } from '../../core/store';
import type { OutputRecord, OutputDetail } from '../../types/workspace';
import { defineAttributes, Store } from '../../core/store';
import { BasicService } from '../basic-service';
import { getOutputDirectory } from './utils/scan-output';
import { getRunDataRecord, readRunDataList, RunDataDir } from './utils/scan-run-data';
import { AsyncListResolver, asyncResolvingList } from './utils/async-resolving-list';

/** 当前用户根目录 */
const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;

/** PYPTO运行记录根目录 */
const RUN_DATA_HOME = process.env.PYPTO_HOME
  ? `${process.env.PYPTO_HOME}${path.sep}run`
  : `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

type RecordOrDetail = OutputRecord & { directoryTree?: OutputDetail['directoryTree'] };
type RunDataStore = Store<RecordOrDetail, 'title', 'executeTime' | 'directoryPath'>;

const RUN_DATA_ATTRIBUTES = defineAttributes({
  title: { type: String, isQuery: true, isPrimary: true, defaultValue: '' },
  executeTime: { type: String, isQuery: true },
  directoryPath: { type: String, isQuery: true },
  sourceFilePath: { type: String },
  controlFlowFilePath: { type: String },
  computeGraphDirPath: { type: String },
  swimlaneGraphFilePath: { type: String },
  directoryTree: { type: Object },
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

  public async getOutputDetail(directoryPath: string): Promise<OutputDetail | undefined> {
    const record = await this.getRecordByDirectoryPath(directoryPath);
    if (!record || this.isDetail(record)) {
      return record;
    }
    const outputUri = vscode.Uri.file(directoryPath);
    const directoryTree = await getOutputDirectory(outputUri, record);
    if (!directoryTree) {
      this.delete(record);
      return;
    }
    record.directoryTree = directoryTree;
    this.store.set(record);
    return record as OutputDetail;
  }

  public async getRecordByDirectoryPath(directoryPath: string): Promise<RecordOrDetail | undefined> {
    const [record] = await this.query().filter({ directoryPath }).exec();

    // 数据库没有记录时，从文件目录读取
    if (!record) {
      const runDataUri = vscode.Uri.file(directoryPath);
      return await getRunDataRecord(runDataUri);
    }

    return record;
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
    const record = await getRunDataRecord(runDataUri);
    if (record) {
      await this.store.set(record);
    }
  }

  private isDetail(recordOrDetail: RecordOrDetail): recordOrDetail is OutputDetail {
    return Reflect.has(recordOrDetail, 'directoryTree');
  }
}
