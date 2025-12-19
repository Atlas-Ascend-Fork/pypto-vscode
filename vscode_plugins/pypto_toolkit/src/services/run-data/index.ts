import path from 'node:path';
import { access, constants } from 'node:fs/promises';
import * as vscode from 'vscode';

import { SqlStore } from '../../core/store';
import type { OutputRecord } from '../../types/workspace';
import { defineAttributes, Store } from '../../core/store';
import { BasicService } from '../basic-service';
import { getOutputRecord, readRunDataList } from './file-system-utils';

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

  private scanning = false;

  private get scannedCount(): number {
    return this._scannedCount;
  }
  private set scannedCount(newValue: number) {
    this._scannedCount = newValue;
    this.scanListeners.get(newValue)?.();
  }
  private _scannedCount: number;

  private scanListeners = new Map<number, () => void>();

  private _stopScanTrigger?: () => void;

  constructor() {
    super('runData');
    this.store = new SqlStore('run_data', RUN_DATA_ATTRIBUTES);
    this.store.onClear(async () => {
      await this.stopScan();
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
    if (!this.scanning || this.scannedCount >= recordCount) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.scanListeners.set(recordCount, () => {
        resolve();
      });
    });
  }

  /**
   * 扫描目录
   */
  private async scanDirectory(): Promise<void> {
    if (this.scanning) {
      return;
    }
    this.scanning = true;
    this.scannedCount = 0;
    const runDataCollectionUri = vscode.Uri.file(RUN_DATA_HOME);
    
    try {
      await access(runDataCollectionUri.path, constants.F_OK); // F_OK 表示检查文件是否存在
    } catch {
      return;
    }
    const runDataList = await readRunDataList(runDataCollectionUri);

    const [latestRecord] = await this.store.query().sort('executeTime', 'desc').slice(0, 1).exec();
    for (const { dirname, executeTime } of runDataList) {
      if (executeTime <= (latestRecord?.executeTime ?? '')) {
        continue;
      }
      const rootDirUri = vscode.Uri.joinPath(runDataCollectionUri, dirname);
      await this.setOutputToStore(rootDirUri);
      if (this._stopScanTrigger) {
        this._stopScanTrigger();
        this.scanning = false;
        return;
      }
      this.scannedCount++;
    }
    this.scanning = false;
    this.scanListeners.get(Infinity)?.();
  }

  private stopScan(): Promise<void> {
    if (!this.scanning) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._stopScanTrigger = () => {
        resolve();
        delete this._stopScanTrigger;
      };
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
      this.store.set(record);
    }
  }
}
