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
import { Uri } from 'vscode';
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { SwimGraphMsgHandler } from '../../handler/swimGraphMsgHandler';
import { FourcolMsgHandler } from '../../handler/fourcolMsgHandler';
import { hismartliteEx } from '../../hismarliteEx';
import { Fider } from '../threeColumnEntry';
import { Util } from '../../util';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { isAbsolute, resolve, dirname, extname, basename, join } from 'path';
import { SingleGraphData } from '../../core/graphData';
import { GetOutputRecordParams } from '../../services/run-data/api';
import { getRunDataList } from '../../services/run-data/api';
import * as vscode from 'vscode';
import { t } from 'i18next';

import * as fs from 'node:fs';
import * as stream from 'node:stream';
import {
  ICommonViewServer,
  IComViewServer,
  IThreeViewServer,
  ISwimViewServer,
  IComApis,
  IComRefs,
  ICommonApis,
  ICommonRefs,
  IThreeApis,
  IThreeRefs,
  ISwimApis,
  ISwimRefs,
} from './view-server-interface';
import { readFirstNLines } from '../../utils/file-system';
import { detectColumnMode, readRecordCceDir } from '../../services/cce-index';
import { getSemanticFromCache, readAndBuildSemanticObj, saveSemanticToCache } from '../../services/three-column-semantic';
import {
  buildPyOpmagicMap,
  getCceFile,
  getCceFilesByLeaf,
  getCceLocation,
  getFirstLeafHash,
  getLabel,
  getLabelsByCceFile,
  getCachedEntryHash,
  getLeafOpsByLabel,
  getOpByCceTree,
  getOpSelectionByImplPyLine,
  getOpSequence,
  getOpsByPyLine,
  getPyFilesByLeaf,
  loadFourColData,
  toProgramId,
} from '../../services/fourcol';

export class SwimData {
  public uri: Uri;
  public fsPath: string;

  constructor(uri: Uri, fsPath: string) {
    this.uri = uri;
    this.fsPath = fsPath;
  }
}

type Apis = IComApis | ICommonApis | IThreeApis | ISwimApis;

type Refs = IComRefs & ICommonRefs & IThreeRefs & ISwimRefs;

@viewRefs([
  'InitFlag',
  'SetThreeColumnMode',
  'ColumnMode',
  'CceCode',
  'CceFileList',
  'ResetPrompt',
  'PyOpmagicMap',
  'GraphSelection',
  'FuncHashFileList',
  'CompleteData',
  'PyCode',
  'FileExistenceResult',
  'CalleeMap',
  'CalleeOpAttrMap',
  'ComData',
  'DiffComData',
  'ErrorMessage',
  'FuncTree',
  'GlobalSearchResult',
  'HealthyReport',
  'AccurancyReport',
  'AccurancyList',
  'AccurancyDetail',
  'InitComGraph',
  'InitDiffComGraph',
  'IDELang',
  'JsonGraphData',
  'LayoutResult',
  'PathNodesSet',
  'ReadJsonWarning',
  'PathOriginMode',
  'nodeErrorList',
  'returnSwim',
  'noSwimFile',
  'dataError',
  'performanceWarn',
  'returnSwimData',
  'bindResult',
  'unbindResult',
  'JsonContent',
  'GetPassPath',
  'returnInitPath',
  'returnSearchPath',
  'returnReplace',
  'SetVscodeState',
  'returnSwimPath',
  'returnComPath',
  'FourcolLoaded',
  'FourcolLoadError',
])
export class ThreeColumnServer
  extends ViewServer<Apis, Refs>
  implements ICommonViewServer, IComViewServer, IThreeViewServer, ISwimViewServer {
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  codePath: string;
  initPath: string;
  swimDataPath?: string;
  comPath?: string;
  swimData?: SwimData;
  codeMsgHandler?: any;
  query?: any;
  cachePath?: any;
  headerTitle?: string
  columnMode: 3 | 4 = 3;
  cceDir?: string;
  private recordCceDir?: string;
  private pendingCceSwitch?: { dir: string; selectedFile?: string; cceFuncHash?: string };
  private pendingApply?: {
    type: 'cce' | 'replace';
    dir?: string;
    selectedFile?: string;
    cceFuncHash?: string;
    options?: { swimPath?: string; comPath?: string };
    missing: string[];
  };
  /** CCE 先打开场景的初始子图 hash（pickCceFile 流程下发，loadMainData 一次性消费） */
  cceInitialFuncHash?: string;
  /** 正在加载中的 programId，防重入（完成/失败后清空，允许后续指纹复查） */
  loadingProgramId?: string;
  /** 进行中的加载任务：重入调用方等待它，避免查询打到未灌完的空表 */
  private fourcolLoadingPromise?: Promise<void>;

  constructor(ctx: ViewServerContext) {
    super(ctx);
  }
  getMemTraceFile: () => Promise<void>;
  getTimelineEvents: () => Promise<void>;
  getMetadata: () => Promise<void>;
  getInitialMemoryData: () => Promise<void>;

  public override created(ctx: ViewServerContext): void {
    if (!ctx.fileUri) {
      return;
    }
    const oldQuery = typeof ctx.fileUri.query === 'string' ? JSON.parse(ctx.fileUri.query) : ctx.fileUri.query ?? {};
    this.codePath = removeSuffix(oldQuery._path);
    this.initPath = this.codePath;
    // 设置视图标题
    const titleNameMatch = ctx.fileUri.path.match(/\/([^\/]+)\.py$/);
    let titleName = 'linkage mode default';
    if (titleNameMatch) {
      titleName = titleNameMatch[1];
    }

    this.title = 'multiple graph';
    this.isReveal = false;
    this._disposables = [];
    const threeQuery = JSON.parse(ctx.fileUri?.query)
    if (threeQuery.isBootStep) {
      this.swimDataPath = threeQuery.swim
      this.comPath = threeQuery.comput
    }
    this.cachePath = Util.getCachePath('threeViewFiles.json');
    this.initWebViewPanel();
  }

  @viewApi()
  public getInitialData = async () => {
    await this.ensureFourcolLoaded();
    this.setRef('SetThreeColumnMode', '');
    await ComGraphHandler.getInitialData(this);
    await SwimGraphMsgHandler.getInitialData(this);
  };
  @viewApi()
  public getInitialComData = async () => {
    await this.ensureFourcolLoaded();
    this.setRef('SetThreeColumnMode', '');
    await ComGraphHandler.getInitialData(this);
  };
  @viewApi()
  public getInitialSwimData = async () => {
    this.setRef('SetThreeColumnMode', '');
    await SwimGraphMsgHandler.getInitialData(this);
  };
  @viewApi()
  public getPyCode = async () => {
    await codeMsgHandler.getPyCode(this);
  };
  @viewApi()
  public switchPyFile = async (message: any) => {
    const { path } = message.paramObj;
    if (!path || !existsSync(path)) {
      return;
    }
    await this.reopenWithCodePath(path);
  };
  @viewApi()
  public getCceCode = async (message: any) => {
    const fileName = message.paramObj?.fileName;
    if (!fileName || !this.cceDir) {
      return;
    }
    const filePath = isAbsolute(fileName) ? fileName : join(this.cceDir, fileName);
    if (!filePath.startsWith(this.cceDir) || !existsSync(filePath)) {
      return;
    }
    const code = readFileSync(filePath, 'utf8');
    this.setRef('CceCode', { data: { code, fileName: basename(filePath), filePath } });
  };
  @viewApi()
  public pickCceFile = async () => {
    const { path } = await new Fider(this.codePath).selectPath('cce');
    if (!path || !existsSync(path)) {
      return;
    }
    this.recordCceDir = undefined;
    const isDir = statSync(path).isDirectory();
    const dir = isDir ? path : dirname(path);
    const selectedFile = isDir ? undefined : path;
    const hadComPath = !!this.comPath;
    const hadSwimPath = !!this.swimDataPath;
    const pickedFile = selectedFile ? basename(selectedFile) : undefined;
    const candidates = this.findComSwimByCceDir(dir);
    const conflict = (this.comPath && candidates.comPath && this.comPath !== candidates.comPath)
      || (this.swimDataPath && candidates.swimPath && this.swimDataPath !== candidates.swimPath);
    if (conflict) {
      this.pendingCceSwitch = { dir, selectedFile, cceFuncHash: '' };
      const replaceMsg = {
        graphType: 'cce',
        paths: { swimPath: candidates.swimPath || '', comPath: candidates.comPath || '' },
        selectPath: path,
      };
      this.setRef('returnReplace', { data: replaceMsg });
      return;
    }
    this.complementPathsFromCceDir(dir, '');
    const firstSelect = !hadComPath && !!this.comPath;
    if (!firstSelect) {
      this.pushCceDir(dir, pickedFile);
    }
    // 路径未变化（图已加载时重选 CCE 文件/目录）不重推 returnSearchPath：重推会触发图重初始化，
    // 把 cceFileSwitched 的下钻覆盖回 firstExecFuncHash；此场景由文件切换事件完成图同步
    if ((!hadComPath && this.comPath) || (!hadSwimPath && this.swimDataPath)) {
      const pathMsg = { swimPath: this.swimDataPath || '', comPath: this.comPath || '' };
      if (this.swimDataPath || this.comPath) {
        this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
      }
      this.setRef('returnSearchPath', { data: pathMsg });
      this.updateFilePathsCache(this.swimDataPath, this.comPath, this.headerTitle);
    }
  };
  /** 在 [dir, 父目录] 两级内查找配套的计算图/泳道图，找不到返回空串 */
  findComSwimByCceDir(dir: string): { comPath: string; swimPath: string } {
    let comPath = '';
    let swimPath = '';
    for (const candidate of [dir, dirname(dir)]) {
      if (!comPath) {
        const p = join(candidate, 'program.json');
        if (existsSync(p)) {
          comPath = p;
        }
      }
      if (!swimPath) {
        const p = join(candidate, 'merged_swimlane.json');
        if (existsSync(p)) {
          swimPath = p;
        }
      }
      if (comPath && swimPath) {
        break;
      }
    }
    return { comPath, swimPath };
  }
  @viewApi()
  public confirmPendingCceSwitch = async () => {
    const pending = this.pendingCceSwitch;
    this.pendingCceSwitch = undefined;
    if (!pending) {
      return;
    }
    const candidates = this.findComSwimByCceDir(pending.dir);
    const srcCom = candidates.comPath || undefined;
    const srcSwim = candidates.swimPath || undefined;
    const missing = this.planOverwrite(srcCom, srcSwim);
    if (missing.length > 0) {
      this.pendingApply = {
        type: 'cce',
        dir: pending.dir,
        selectedFile: pending.selectedFile,
        cceFuncHash: pending.cceFuncHash,
        missing,
      };
      this.setRef('ResetPrompt', { data: { missing } });
      return;
    }
    this.applyOverwrite(srcCom, srcSwim, false, pending.cceFuncHash);
    this.pushCceDir(pending.dir, pending.selectedFile);
  };
  @viewApi()
  public cancelPendingCceSwitch = async () => {
    const pending = this.pendingCceSwitch;
    this.pendingCceSwitch = undefined;
    if (!pending) {
      return;
    }
    // 不覆盖：只处理 CCE 自己栏，其他栏保持原状（缺省或已加载都不动）
    this.pushCceDir(pending.dir, pending.selectedFile);
  };
  complementPathsFromCceDir(dir: string, cceFuncHash?: string) {
    for (const candidate of [dir, dirname(dir)]) {
      if (!this.comPath) {
        const comPath = join(candidate, 'program.json');
        if (existsSync(comPath)) {
          this.updateComData(comPath, cceFuncHash);
        }
      }
      if (!this.swimDataPath) {
        const swimPath = join(candidate, 'merged_swimlane.json');
        if (existsSync(swimPath)) {
          this.updateSwimData(swimPath);
        }
      }
      if (this.comPath && this.swimDataPath) {
        break;
      }
    }
  }
  /** CCE 展示目标：优先所选文件，其次首个 _main.cpp，最后字典序首个 .cpp；目录不可读返回 undefined */
  resolveCceTarget(dir: string, selectedFile?: string): string | undefined {
    try {
      const cppFiles = readdirSync(dir).filter((f) => f.endsWith('.cpp')).sort();
      const selectedName = selectedFile ? basename(selectedFile) : undefined;
      return (selectedName && cppFiles.includes(selectedName) ? selectedName : undefined)
        ?? cppFiles.find((f) => f.endsWith('_main.cpp'))
        ?? cppFiles[0];
    } catch {
      return undefined;
    }
  }
  pushCceDir(dir: string, selectedFile?: string) {
    this.cceDir = dir;
    try {
      const cppFiles = readdirSync(dir).filter((f) => f.endsWith('.cpp')).sort();
      const files = cppFiles.map((f) => ({ path: join(dir, f), name: f, exists: true }));
      this.setRef('CceFileList', { data: { files } });
      const target = this.resolveCceTarget(dir, selectedFile);
      if (!target) {
        this.setRef('CceCode', { data: { code: '', fileName: '', filePath: '' } });
        return;
      }
      const code = readFileSync(join(dir, target), 'utf8');
      this.setRef('CceCode', { data: { code, fileName: target, filePath: join(dir, target) } });
    } catch (error) {
      console.log('push cce dir failed:', error);
    }
  }
  @viewApi()
  public checkFileExistence = async (message: any) => {
    const paths: string[] = message.paramObj?.paths ?? [];
    const result: Record<string, boolean> = {};
    for (const p of paths) {
      result[p] = existsSync(p);
    }
    this.setRef('FileExistenceResult', { data: result });
  };
  @viewApi()
  public askLayout = async (message) => {
    await ComGraphHandler.layout(message.data, this);
  };
  @viewApi()
  public renderLayout = async (data, infoStr) => {
    await ComGraphHandler.renderLayout(data, infoStr, this);
  };
  @viewApi()
  public getJsonGraphData = async (message) => {
    await ComGraphHandler.getJsonGraphData(message, this);
  };
  @viewApi()
  public setFinalResult = async (message) => {
    await ComGraphHandler.setFinalResult(message, this);
  };
  @viewApi()
  public openDiffViewer = async () => {
    await ComGraphHandler.openDiffViewer(this, this.query);
  };
  @viewApi()
  public getSubgraph = async (message: any) => {
    await ComGraphHandler.getSubgraph(this, message.paramObj, this.query);
  };
  @viewApi()
  public searchAllFunc = async (message) => {
    await ComGraphHandler.searchAllFunc(this, message);
  };
  @viewApi()
  public jumpToCodeLine = async (message) => {
    await ComGraphHandler.jumpToCodeLine(message);
  };
  @viewApi()
  public getHealthyReport = async () => {
    await ComGraphHandler.getHealthyReport(this);
  };
  @viewApi()
  public getAccurancyReport = async () => {
    await ComGraphHandler.getAccurancyReport(this);
  };
  @viewApi()
  public searchAccurancySumList = async (message) => {
    await ComGraphHandler.searchAccurancySumList(this, message);
  };
  @viewApi()
  public getAccurancyDetail = async (message) => {
    await ComGraphHandler.getAccurancyDetail(this, message);
  };
  @viewApi()
  public innerGetSubgraph = async (message) => {
    await ComGraphHandler.innerGetSubgraph(this, message.paramObj);
  };
  @viewApi()
  public returnFuncTree = async () => {
    await ComGraphHandler.returnFuncTree(this);
  };
  @viewApi()
  public getSprottyGraphWithLevel = async (message) => {
    await ComGraphHandler.getSprottyGraphWithLevel(this, message);
  };
  @viewApi()
  public fetchVscodeState = async (message) => {
    if (message.swimDataPath) {
      this.swimDataPath = message.swimDataPath;
      this.swimData = new SwimData(Uri.file(message.swimDataPath), message.swimDataPath);
    }
    if (message.comPath) {
      this.comPath = message.comPath;
      this.query = {
        fsPath: message.comPath,
        _path: this.initPath
      };
    }
    if (message.codePath) {
      this.codePath = message.codePath;
    }
  };
  @viewApi()
  public getSwimData = async (message) => {
    if (message.swimDataPath) {
      this.swimDataPath = message.swimDataPath;
    }
    if (!this.swimDataPath) {
      return;
    }
    const content = ((await readFirstNLines(this.swimDataPath, 10)) as string[]).join('');
    const isGoogleFormat = content.includes('traceEvents');
    if (!isGoogleFormat) {
      this.setRef('dataError', { msg: t('pypto.threeCol.notTraceFormat')});
      return;
    }
    const packages = await SwimGraphMsgHandler.getSwimData(this);
    if (packages) {
      return stream.Readable.toWeb(stream.Readable.from(packages));
    }
    return;
  };
  @viewApi()
  public getData = async (message) => {
    if (message.swimDataPath) {
      this.swimDataPath = message.swimDataPath;
    }
    if (!this.swimDataPath) {
      return;
    }
    const content = ((await readFirstNLines(this.swimDataPath, 10)) as string[]).join('');
    const isGoogleFormat = content.includes('traceEvents');
    if (!isGoogleFormat) {
      this.setRef('dataError', { msg: t('pypto.threeCol.notTraceFormat')});
      return;
    }
    hismartliteEx.startTime = new Date().getTime();
    const data = await SwimGraphMsgHandler.getData(this);
    if (Array.isArray(data)) {
      hismartliteEx.transformStartTime = new Date().getTime();
      return stream.Readable.toWeb(stream.Readable.from(data!));
    }
    hismartliteEx.transformStartTime = new Date().getTime();
    return data;
  };
  @viewApi()
  public getOtherData = async () => {
    return await SwimGraphMsgHandler.getOtherData(this);
  };
  @viewApi()
  public getPerformanceInfo = async () => {
    return await SwimGraphMsgHandler.getPerformanceInfo(this);
  };
  @viewApi()
  public getCompressedData = async (message) => {
    if(message.swimDataPath){
      this.swimDataPath = message.swimDataPath;
    }
    return await SwimGraphMsgHandler.getCompressedData(this);
  };
  @viewApi()
  public bindComGraphJson = async () => {
    await SwimGraphMsgHandler.bindComGraphJson(this);
  };
  @viewApi()
  public unbindComGraph = async () => {
    await SwimGraphMsgHandler.unbindComGraph(this);
  };
  @viewApi()
  public jumpToComGraph = async (message: any) => {
    await SwimGraphMsgHandler.jumpToComGraph(this, message.paramObj);
  };
  @viewApi()
  public openBoundComGraph = async () => {
    await SwimGraphMsgHandler.openBoundComGraph(this);
  };
  @viewApi()
  public jumpRawMagic = async (message: any) => {
    await SwimGraphMsgHandler.jumpRawMagic(this, message.paramObj);
  };
  @viewApi()
  public showMessage = async (message: any) => {
    await SwimGraphMsgHandler.showMessage(this, message.paramObj);
  };
  @viewApi()
  public saveRendingMode = async (message: any) => {
    await SwimGraphMsgHandler.saveRendingMode(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgConnection = async (message: any) => {
    await SwimGraphMsgHandler.changeUserCfgConnection(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgPerformance = async (message: any) => {
    await SwimGraphMsgHandler.changeUserCfgPerformance(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgIsMixMode = async (message: any) => {
    await SwimGraphMsgHandler.changeUserCfgIsMixMode(this, message.paramObj);
  };
  @viewApi()
  public getShortCutKeyCfg = async () => {
    return await SwimGraphMsgHandler.getShortCutKeyCfg(this);
  };
  @viewApi()
  public selectPassPath = async (message: any) => {
    await ComGraphHandler.getFuncHashFileList(this, message.paramObj);
  };
  @viewApi()
  public openSearchMode = async (message) => {
    await ComGraphHandler.openSearchMode(message, this);
  };
  @viewApi()
  public setSaveDir = async () => {
  };
  @viewApi()
  public checkSys = async () => {
  };
  @viewApi()
  public saveFile = async (message) => {
  };
  @viewApi()
  public checkFilePath = async (message) => {
  };
  // 初始化自动关联路径
  async initRelativePath(
    codePath: string,
    swimPath: string | undefined,
    comPath: string | undefined,
  ): Promise<{ codePath: string; swimPath: string | undefined; comPath: string | undefined; runDataTitle: string | undefined }> {
    const ret = await new Fider(codePath).findByCodePath(swimPath, comPath);
    return { codePath, ...ret };
  }

  async initWebViewPanel() {
    try {
      await this.initPaths();
      this.refreshColumnMode();
      this.pushInitResult(false);
    } catch (error) {
      console.log(`Error initializing WebView panel:`, error);
    }
  }
  async initPaths() {
    if (!this.swimDataPath || !this.comPath) {
      const { swimPath, comPath, runDataTitle } = await this.initRelativePath(this.codePath, this.swimDataPath, this.comPath);
      if (swimPath) {
        this.updateSwimData(swimPath);
      }
      if (comPath) {
        this.updateComData(comPath);
      }
      if (runDataTitle) {
        this.headerTitle = runDataTitle;
        await this.fetchRunDataList(this.headerTitle);
      }
    }
  }
  async fetchRunDataList(headerTitle: string) {
    const params: GetOutputRecordParams = {
      page: 1, pageSize:20, isThreeColumnNotNull: true, titleKeyword: headerTitle
    };
    try {
      const res = await getRunDataList(params);
      const firstItem = res.data[0];
      this.recordCceDir = readRecordCceDir(firstItem?.directoryPath);
      if (firstItem.swimlaneGraphFilePath) {
        this.updateSwimData(firstItem.swimlaneGraphFilePath);
      }
      if (firstItem.controlFlowFilePath) {
        this.updateComData(firstItem.controlFlowFilePath);
      }
    } catch (error) {
      console.log('Failed to fetch run data: ', error);
    }
  }
  updateSwimData(path: string) {
    this.swimDataPath = path;
    this.swimData = new SwimData(Uri.file(path), path);
    this.refreshColumnMode();
  }
  updateComData(path: string, cceFuncHash?: string) {
    this.comPath = path;
    this.query = {
      fsPath: path,
      _path: this.initPath
    };
    // CCE 先打开场景暂存初始子图 hash；其它流程传 undefined 顺带清掉残留
    this.cceInitialFuncHash = cceFuncHash;
    this.refreshColumnMode();
  }
  refreshColumnMode() {
    const anchor = this.comPath || this.swimDataPath;
    if (!anchor && !this.recordCceDir) {
      // 无任何锚点：保留已解析的 cceDir（CCE 先选场景），仅补四栏壳与空态推送
      this.columnMode = 4;
      this.setRef('ColumnMode', { columnMode: this.columnMode, cceDir: this.cceDir });
      void this.pushDefaultCceCode();
      return;
    }
    const result = detectColumnMode(anchor, this.recordCceDir);
    this.columnMode = result.columnMode;
    this.cceDir = result.cceDir;
    this.setRef('ColumnMode', { columnMode: this.columnMode, cceDir: this.cceDir });
    void this.pushDefaultCceCode();
    if (anchor) {
      void this.ensureFourcolLoaded();
    }
  }
  /** 运行记录标题 → 该记录自己的 rundata 目录（store 里的 directoryPath） */
  private async findRecordDirByTitle(title: string | undefined): Promise<string | undefined> {
    if (!title) {
      return undefined;
    }
    try {
      const res = await getRunDataList({ page: 1, pageSize: 1, isThreeColumnNotNull: true, titleKeyword: title, isExactMatch: true });
      return res.data[0]?.directoryPath;
    } catch {
      return undefined;
    }
  }
  /** 换 py 算子文件 = 用新 codePath 重走一遍右击开启联动的发现流程 */
  private async reopenWithCodePath(path: string) {
    this.codePath = path;
    this.initPath = path;
    this.swimDataPath = undefined;
    this.swimData = undefined;
    this.comPath = undefined;
    this.recordCceDir = undefined;
    this.cceInitialFuncHash = undefined;
    this.pendingCceSwitch = undefined;
    this.pendingApply = undefined;
    try {
      const code = readFileSync(path, 'utf8');
      this.setRef('PyCode', { data: { code, codePath: path } });
    } catch (err) {
      console.error(`${path}读取 py 文件时发生错误`, err);
    }
    await this.initPaths();
    this.pushInitResult(true);
    await ComGraphHandler.pushSemanticObj(this);
  }
  private pushInitResult(forceEmpty: boolean) {
    if (!this.swimDataPath || !this.comPath) {
      this.refreshColumnMode();
      const pathMsg = { swimPath: this.swimDataPath || '', comPath: this.comPath || '', forceEmpty };
      this.setRef('returnInitPath', { data: pathMsg });
      return;
    }
    this.setRef('InitFlag', { runDataTitle: this.headerTitle });
    this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    // 重开（换 py）场景：returnInitPath 的 watcher 只加载当前缺省的栏，已加载的栏要靠
    // returnSearchPath 才会重载；首开无旧数据，不补推以免双重加载
    if (forceEmpty) {
      this.setRef('returnSearchPath', { data: { swimPath: this.swimDataPath || '', comPath: this.comPath || '' } });
    }
  }
  /**
   * 四栏默认 CCE 文件：cce_opmagic_map.json 首个 leafHash 绑定的 CCE 文件（尾块优先）；
   * 索引未就绪/无绑定时回退 _main/字典序首个
   */
  async pushDefaultCceCode() {
    if (this.columnMode !== 4 || !this.cceDir) {
      this.setRef('CceFileList', { data: { files: [] } });
      this.setRef('CceCode', { data: { code: '', fileName: '', filePath: '' } });
      return;
    }
    await this.ensureFourcolLoaded();
    const leafHash = await getFirstLeafHash(this.fourcolProgramId);
    const target = leafHash ? await getCceFile(this.fourcolProgramId, leafHash) : null;
    this.pushCceDir(this.cceDir, target ?? undefined);
  }
  /**
   * 联动模式下后台预载四联动索引（幂等、防重入、指纹跳过，per-program）。只要 comPath 就绪
   * 即加载（三栏/四栏均可——py 反查三接口只依赖计算图文件；CCE 两件缺失时对应表为空）。
   * load 失败只记日志 + setRef 提示，不 throw、不影响联动功能；加载完成后推 PyOpmagicMap
   * 供 py 栏逆映射消费（非四栏时 getPyOpmagicMap 自行短路）；查询侧未加载一律返回空。
   * 重入调用方（加载进行中再次调用）等待同一加载任务完成，避免查询打到未灌完的空表。
   */
  private async ensureFourcolLoaded(): Promise<void> {
    if (!this.comPath) {
      return;
    }
    const programId = toProgramId(this.comPath);
    if (programId === this.loadingProgramId && this.fourcolLoadingPromise) {
      await this.fourcolLoadingPromise;
      return;
    }
    const comPath = this.comPath;
    this.loadingProgramId = programId;
    this.fourcolLoadingPromise = this.loadFourcolDataAndNotify(programId, comPath);
    await this.fourcolLoadingPromise;
  }

  private async loadFourcolDataAndNotify(programId: string, comPath: string): Promise<void> {
    try {
      const stats = await loadFourColData(programId, comPath);
      this.setRef('FourcolLoaded', { data: { ...stats } });
      await this.getPyOpmagicMap();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fourcol] 加载 ${programId} 失败:`, error);
      this.setRef('FourcolLoadError', { data: { programId, message } });
    } finally {
      // 仅清理自己占用的槽位：comPath 中途切换时新任务的守卫不被旧任务误清
      if (this.loadingProgramId === programId) {
        this.loadingProgramId = undefined;
        this.fourcolLoadingPromise = undefined;
      }
    }
  }
  /** 四栏查询锚定的 programId（comPath 缺失时为空串，查询自然返回空结果） */
  private get fourcolProgramId(): string {
    return this.comPath ? toProgramId(this.comPath) : '';
  }
  @viewApi()
  public getPyOpmagicMap = async () => {
    const pyOpmagicMap = await buildPyOpmagicMap(this.fourcolProgramId);
    this.setRef('PyOpmagicMap', { pyOpmagicMap });
  };
  @viewApi()
  public resolveFromCce = async (message: { opmagic: number; hash: string }) => {
    const { opmagic, hash } = message;
    if (!opmagic || !hash) {
      return null;
    }
    await this.ensureFourcolLoaded();
    const programId = this.fourcolProgramId;
    const loc = await getCceLocation(programId, hash, String(opmagic));
    const tree = await getOpByCceTree(programId, loc?.fileName ?? '', loc?.lines?.[0] ?? 0);
    return { hash, opmagic: String(opmagic), label: tree?.label ?? null, pyFile: tree?.pyFile ?? null, pyLine: tree?.pyLine ?? null, cce: loc?.fileName ?? null, lines: loc?.lines ?? [] };
  };
  /** 泳道 task 悬停：leafHash → 该 leaf 全部 opmagic（CCE 行序），供 returnOpsFromCom 广播 */
  @viewApi()
  public resolveOpsFromLeaf = async (message: { leafHash: string }) => {
    const leafHash = message?.leafHash;
    if (!leafHash) {
      return { ops: [] };
    }
    await this.ensureFourcolLoaded();
    const seq = await getOpSequence(this.fourcolProgramId, leafHash);
    return { ops: seq.map((r) => Number(r.opmagic)) };
  };
  /**
   * 四联动泳道悬停/点击：按 (leafHash, label) 取该 leaf 的 opmagic 列表，
   * 回发 returnOpsFromCom 后由 py/CCE 栏反查各自落点（必须是 leaf 层编号，
   * root 层 CALL 的 opmagic 在 fourcol_py_impl 里没有实现行，下游反查不到）。
   * label 为空代表「整张子图」。
   */
  @viewApi()
  public resolveSwimOps = async (message: { leafHash?: string; label?: string }) => {
    const leafHash = message?.leafHash;
    if (!leafHash) {
      return { ops: [] as number[] };
    }
    await this.ensureFourcolLoaded();
    const ops = await getLeafOpsByLabel(this.fourcolProgramId, String(leafHash), message?.label ?? '');
    return { ops: ops.map((o) => Number(o)) };
  };
  /** CCE 文件行悬停：按行反查 label 块（区间命中），供 returnSemanticLabelFromCce */
  @viewApi()
  public getCceLabels = async (message: { fileName: string }) => {
    const fileName = message?.fileName;
    if (!fileName) {
      return { labels: [] };
    }
    await this.ensureFourcolLoaded();
    return { labels: await getLabelsByCceFile(this.fourcolProgramId, fileName) };
  };
  /** 计算图子图 hash → 强绑定的 CCE 文件名（尾块优先，无尾块回退主块）；无绑定时返回 null */
  @viewApi()
  public getCceFileBySubgraph = async (message: { hash: string }) => {
    const hash = message?.hash;
    if (!hash || !this.cceDir) {
      return { fileName: null };
    }
    await this.ensureFourcolLoaded();
    return { fileName: await getCceFile(this.fourcolProgramId, hash) };
  };
  @viewApi()
  public resolveFromPyLine = async (message: { file: string; line: number }) => {
    const { file, line } = message;
    if (!file || !line) {
      return [];
    }
    await this.ensureFourcolLoaded();
    return getOpsByPyLine(this.fourcolProgramId, file, line);
  };
  /** 计算图列自高亮：py 行 → 精确 op 落点（leafHash + opmagic + subgraphid + label） */
  @viewApi()
  public resolveOpsFromPyLine = async (message: { file: string; line: number }) => {
    const { file, line } = message;
    if (!file || !line) {
      return { leafHashes: [], ops: [] };
    }
    await this.ensureFourcolLoaded();
    const ops = await getOpSelectionByImplPyLine(this.fourcolProgramId, file, line);
    return { leafHashes: Array.from(new Set(ops.map((o) => o.leafHash))), ops };
  };
  @viewApi()
  public resolveActiveLock = async (message: {
    opmagic?: number | string;
    hash?: string;
    leafHash?: string;
    file?: string;
    line?: number;
    label?: string;
  }) => {
    await this.ensureFourcolLoaded();
    const programId = this.fourcolProgramId;
    let hash = message.hash ?? message.leafHash;
    // 泳道点击发的是 opmagic: ''（空串），与未提供同等处理；否则会带着空串往下走，
    // 使 getCceLocation 反查失败、载荷里的 opMagic 也变成空串
    let opmagic = message.opmagic == null || message.opmagic === '' ? undefined : Number(message.opmagic);
    if (opmagic == null) {
      if (message.file && typeof message.line === 'number') {
        const ops = await getOpsByPyLine(programId, message.file, message.line);
        if (!ops.length) {
          return null;
        }
        hash = ops[0][0];
        opmagic = Number(ops[0][1]);
      } else if (hash) {
        const seq = await getOpSequence(programId, hash);
        if (!seq.length) {
          return null;
        }
        opmagic = Number(seq[0].opmagic);
      }
    }
    if (!hash || opmagic == null) {
      return null;
    }
    const loc = await getCceLocation(programId, hash, String(opmagic));
    // loc 为空（不产码 / ROOT 层 op）时反查必然落空，跳过空查询
    const tree = loc ? await getOpByCceTree(programId, loc.fileName, loc.lines?.[0] ?? 0) : null;
    // candidate 全集：py = 该 leaf 命中 op 的去重文件；cce = 主块在前 + 尾块
    const [candidatePy, candidateCce] = await Promise.all([getPyFilesByLeaf(programId, hash), getCceFilesByLeaf(programId, hash)]);
    // label 优先级：来源明确给出（泳道 task 的 color）→ 落点反查 → py_semantic 按 op 键查询。
    // 最后一级保证 op 无精确落点（不产码 / ROOT 层 op）时载荷仍带 label，供 CCE 栏按当前文件兜底定位
    const label = message.label || tree?.label || (await getLabel(programId, hash, String(opmagic)));
    return {
      hash,
      opMagic: opmagic,
      label: label || null,
      // op 精确落点文件（尾块优先，与子图强绑同口径）；CCE 栏锁定须加载 op 实际所在的副本，
      // candidate.cce[0]（主块）可能缺该 op 行或 funcHash 不一致，导致锁定静默失败
      cce: loc?.fileName ?? null,
      candidate: { py: candidatePy, cce: candidateCce },
    };
  };
  @viewApi()
  public stepOp = async (message: { leafHash: string; opMagic: number; direction: -1 | 1 }) => {
    await this.ensureFourcolLoaded();
    const seq = await getOpSequence(this.fourcolProgramId, message.leafHash);
    const cur = seq.findIndex((r) => Number(r.opmagic) === message.opMagic);
    if (cur < 0) {
      return null;
    }
    const next = cur + message.direction;
    if (next < 0 || next >= seq.length) {
      return null;
    }
    return Number(seq[next].opmagic);
  };
  @viewApi()
  public getOpsByPyInfo = async (message: any) => {
    return await FourcolMsgHandler.getOpsByPyInfo(this, message);
  };
  @viewApi()
  public getPyLocationByOps = async (message: any) => {
    return await FourcolMsgHandler.getPyLocationByOps(this, message);
  };
  @viewApi()
  public getPyFileList = async () => {
    return await FourcolMsgHandler.getPyFileList(this);
  };
  @viewApi()
  public selectRunData = async (message: any) => {
    const { swimPath, comPath, runDataTitle } = message.runDataPaths;
    // 四栏比三栏多读的一个字段：该记录自己的 rundata.json 里的 kernel_aicore_path
    this.recordCceDir = readRecordCceDir(await this.findRecordDirByTitle(runDataTitle));

    if (swimPath) {
      this.updateSwimData(swimPath);
    }
    if (comPath) {
      this.updateComData(comPath);
    }
    const pathMsg = { swimPath: swimPath || "", comPath: comPath || "" };
    if (this.swimDataPath || this.comPath) {
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    }
    this.setRef('returnSearchPath', { data: pathMsg });
    this.updateFilePathsCache('', '', runDataTitle);
  }

  @viewApi()
  public selectFile = async (message: any) => {
    const graphType = message.graphType;
    const options = message.options
    const { swimPath, comPath } = await new Fider(this.codePath).handleUserSelect(graphType);
    const handlePaths = (initPath: string, selectPath: string, graphType: string) => {
      const paths = graphType === "swimGraph" ? { swimPath, comPath: initPath } : { swimPath: initPath, comPath };
      const replaceMsg = { graphType, paths, selectPath };
      this.setRef('returnReplace', { data: replaceMsg });
    };

    const updatePaths = (swimPath: string | undefined, comPath: string | undefined) => {
      if (swimPath) {
        this.updateSwimData(swimPath);
      }
      if (comPath) {
        this.updateComData(comPath);
      }
      if (this.swimDataPath || this.comPath) {
        this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
      }
      const pathMsg = { swimPath: swimPath || "", comPath: comPath || "" };
      this.setRef('returnSearchPath', { data: pathMsg });
      this.updateFilePathsCache(this.swimDataPath, this.comPath);
    };

    selectFileDispatch({
      graphType,
      options,
      swimPath,
      comPath,
      handlePaths,
      updatePaths,
    });
  }

  @viewApi()
  public replaceFile = async (message: any) => {
    const options = message.options;
    const srcCom = options.comPath || undefined;
    const srcSwim = options.swimPath || undefined;
    const missing = this.planOverwrite(srcCom, srcSwim);
    if (missing.length > 0) {
      this.pendingApply = { type: 'replace', options: { comPath: srcCom, swimPath: srcSwim }, missing };
      this.setRef('ResetPrompt', { data: { missing } });
      return;
    }
    this.applyOverwrite(srcCom, srcSwim, false);
  };
  /** 覆盖计划：源侧有值→替换；源侧缺而当前有→记入 missing 待二次确认；双方都缺→不动 */
  private planOverwrite(srcCom: string | undefined, srcSwim: string | undefined): string[] {
    const missing: string[] = [];
    if (!srcCom && this.comPath) {
      missing.push('comGraph');
    }
    if (!srcSwim && this.swimDataPath) {
      missing.push('swimGraph');
    }
    return missing;
  }
  private applyOverwrite(srcCom: string | undefined, srcSwim: string | undefined, resetMissing: boolean, cceFuncHash?: string) {
    this.recordCceDir = undefined;
    if (resetMissing) {
      if (!srcCom && this.comPath) {
        this.comPath = undefined;
      }
      if (!srcSwim && this.swimDataPath) {
        this.swimDataPath = undefined;
        this.swimData = undefined;
      }
    }
    if (srcCom) {
      this.updateComData(srcCom, cceFuncHash);
    }
    if (srcSwim) {
      this.updateSwimData(srcSwim);
    }
    if (this.swimDataPath || this.comPath) {
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    }
    const forceEmpty = resetMissing || (!this.swimDataPath && !this.comPath);
    this.setRef('returnSearchPath', {
      data: { swimPath: this.swimDataPath || '', comPath: this.comPath || '', forceEmpty },
    });
    this.updateFilePathsCache(this.swimDataPath, this.comPath, this.headerTitle);
  }
  @viewApi()
  public applyResetDecision = async (message: any) => {
    const pending = this.pendingApply;
    this.pendingApply = undefined;
    if (!pending) {
      return;
    }
    const reset = message?.paramObj?.reset === true;
    if (pending.type === 'cce') {
      const candidates = this.findComSwimByCceDir(pending.dir!);
      this.applyOverwrite(candidates.comPath || undefined, candidates.swimPath || undefined, reset, pending.cceFuncHash);
      this.pushCceDir(pending.dir!, pending.selectedFile);
    } else {
      this.applyOverwrite(pending.options?.comPath, pending.options?.swimPath, reset);
    }
  };
  @viewApi()
  public applySingleSide = async (message: any) => {
    const { graphType, path } = message.paramObj ?? {};
    this.recordCceDir = undefined;
    if (graphType === 'swimGraph' && path) {
      this.updateSwimData(path);
    } else if ((graphType === 'comGraph' || graphType === 'computeGraph') && path) {
      this.updateComData(path);
    } else {
      return;
    }
    if (this.swimDataPath || this.comPath) {
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    }
    this.setRef('returnSearchPath', { data: { swimPath: this.swimDataPath || '', comPath: this.comPath || '' } });
    this.updateFilePathsCache(this.swimDataPath, this.comPath, this.headerTitle);
  };
  @viewApi()
  public singleSelectFile = async (message: { graphType: string }) => {
    if (!message || !message.graphType) {
      return;
    }
    const validGraphTypes = ['editor', 'swimGraph', 'comGraph'];
    if (!validGraphTypes.includes(message.graphType)) {
      return;
    }
    try {
      const { path } = await new Fider(this.codePath).selectPath(message.graphType);
      if (!path) {
        return;
      }
      switch (message.graphType) {
        case 'editor':
          await this.reopenWithCodePath(path);
          break;
        case 'swimGraph':
          await this.handleSwimGraph(path);
          break;
        case 'comGraph':
          await this.handleComGraph(path);
          break;
      }
      this.setRef('SetVscodeState', { codePath: this.codePath, comPath: this.comPath, swimDataPath: this.swimDataPath });
    } catch (error) {
      console.log(`Error processing graphType ${message.graphType}:`, error)
    }
  };
  private async handleCodeGraph(path: string) {
    this.codePath = path;
    try {
      const code = readFileSync(path, 'utf8');
      this.setRef('PyCode', { data: { code, codePath: path } });
      this.updateFilePathsCache(this.swimDataPath, this.comPath);
    } catch (err) {
      console.error(`${path}读取 py 文件时发生错误:`, err);
    }
    // 切换 py 文件后重推语义高亮映射（缓存优先，前端 editor.vue watch CompleteData）
    await ComGraphHandler.pushSemanticObj(this);
  };
  private async handleComGraph(path: string) {
    this.updateComData(path);
    this.setRef('returnComPath', { data: { comPath: path } });
    this.updateFilePathsCache(this.swimDataPath, this.comPath);
  }
  private async handleSwimGraph(path: string) {
    this.updateSwimData(path);
    this.setRef('returnSwimPath', { data: { swimPath: path } });
    this.updateFilePathsCache(this.swimDataPath, this.comPath);
  };
  private async updateFilePathsCache(swimPath: string | undefined, comPath: string | undefined, runDataTitle: string = '') :Promise<void> {
    try {
      const cache = (await Util.readSwim2ComGraphMap(this.cachePath)) || {};
      if (!cache[this.codePath]) {
        cache[this.codePath] = {};
      }
      if (swimPath !== undefined) {
        cache[this.codePath].swimPath = swimPath;
      }
      if (comPath !== undefined) {
        cache[this.codePath].comPath = comPath;
      }
      cache[this.codePath].runDataTitle = runDataTitle;
      await Util.writeJsonCache(this.cachePath, cache);
    } catch (error) {
      console.error(`更新${this.cachePath}文件发生错误`, error);
    }
  }
  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}

type HandlePathsFn = (initPath: string, selectPath: string, graphType: string) => void;
type UpdatePathsFn = (swimPath: string | undefined, comPath: string | undefined) => void;

interface SelectFileContext {
  graphType: string;
  options: any;
  swimPath: string | undefined;
  comPath: string | undefined;
  handlePaths: HandlePathsFn;
  updatePaths: UpdatePathsFn;
}

// 路径冲突判定：选项中已有的路径与本次选择的路径不同时，需要触发替换流程
const hasPathConflict = (optionPath: string | undefined, selectedPath: string | undefined): boolean => {
  return Boolean(optionPath && selectedPath && optionPath !== selectedPath);
};

// swimGraph 选择分发：当 options.comPath 与选择的 comPath 冲突时走替换，否则按是否已有 comPath 走更新
const dispatchSwimGraphSelect = (ctx: SelectFileContext) => {
  const { options, swimPath, comPath, handlePaths, updatePaths } = ctx;
  if (hasPathConflict(options.comPath, comPath)) {
    handlePaths(options.comPath, comPath!, 'swimGraph');
    return;
  }
  updatePaths(swimPath, options.comPath ? undefined : comPath);
};

// comGraph 选择分发：当 options.swimPath 与选择的 swimPath 冲突时走替换，否则按是否已有 swimPath 走更新
const dispatchComGraphSelect = (ctx: SelectFileContext) => {
  const { options, swimPath, comPath, handlePaths, updatePaths } = ctx;
  if (hasPathConflict(options.swimPath, swimPath)) {
    handlePaths(options.swimPath, swimPath!, 'comGraph');
    return;
  }
  updatePaths(options.swimPath ? undefined : swimPath, comPath);
};

// selectFile 的纯逻辑分发：根据 graphType 决定走 swimGraph 还是 comGraph 的处理分支
const selectFileDispatch = (ctx: SelectFileContext) => {
  if (ctx.graphType === 'swimGraph') {
    dispatchSwimGraphSelect(ctx);
  } else if (ctx.graphType === 'computeGraph' || ctx.graphType === 'comGraph') {
    dispatchComGraphSelect(ctx);
  }
};

function removeSuffix(input: string): string {
  const pos = input.indexOf(' - ');
  if (pos !== -1) {
    return input.substring(0, pos);
  } else {
    return input;
  }
}

class codeMsgHandler {
  static getPyCode(server: any) {
    const codePath = server.codePath;
    let code = '';
    try {
      code = readFileSync(codePath, 'utf8');
    } catch (err) {
      console.error(`${codePath}读取 py 文件时发生错误:`, err);
    }
    server.setRef('PyCode', { data: { code, codePath } });
  }
}

export class ComGraphHandler extends SingleGraphHandler {
  static searchFuncHashInProject(server: any, funcHash: string) {
    vscode.workspace.findFiles(`**/*${funcHash}*.json`).then((fileList) => {
      const res = fileList.map((uri) => uri.fsPath);
      server.setRef('FuncHashFileList', { data: res });
    });
  }
  static override async loadMainData(server: any): Promise<boolean> {
    server.comGraphData = new SingleGraphData(server.comPath, undefined);
    const gd = server.comGraphData as SingleGraphData;

    try {
      const programId = toProgramId(gd.fsPath);
      const cached = await getCachedEntryHash(programId);
      let entryhash: string | undefined;
      if (cached) {
        entryhash = cached;
      } else {
        entryhash = (await SingleGraphData.getEntryHash(gd.fsPath)).entryhash;
      }
      server.entryHash = entryhash;
      gd.funcHash = await ComGraphHandler.resolveInitialFuncHash(server, entryhash);
    } catch (err: any) {
      if (err.code === 'FILE_READ_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.fileRead'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      } else if (err.code === 'JSON_PARSE_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.jsonParse'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      } else if (err.code === 'STREAM_PROCESSING_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.streaValues'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      } else {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.readJsonUnknown'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      }
    }
    return true
  }

  /**
   * 初始子图决策（一次性）：CCE 先打开场景消费待定的 CCE funcHash；
   * 四栏且未指定时定位到 cce_opmagic_map 首个 leafHash（等待索引就绪，未命中回退）。
   * hash 不在图中时回退 entryhash（可为 undefined）
   */
  static async resolveInitialFuncHash(server: any, entryhash?: string): Promise<string | undefined> {
    let cceFuncHash: string | undefined = server.cceInitialFuncHash;
    server.cceInitialFuncHash = undefined;
    if (!cceFuncHash && server.columnMode === 4 && server.comPath && typeof server.ensureFourcolLoaded === 'function') {
      await server.ensureFourcolLoaded();
      cceFuncHash = (await getFirstLeafHash(server.fourcolProgramId)) ?? undefined;
    }
    if (!cceFuncHash || !server.comPath) {
      return entryhash;
    }
    const inGraph = await ComGraphHandler.graphContainsFuncHash(server.comPath, cceFuncHash);
    if (inGraph) {
      // 钉定标记：fetchFuncData 据此跳过三栏 firstExecFuncHash 重定向，初始图保持在指定 funcHash
      server.comGraphData.cceInitialPinned = true;
      return cceFuncHash;
    }
    return entryhash;
  }

  /** 流式扫描 program.json 的 functions[].hash，避免为大图文件校验做整体 JSON.parse */
  static graphContainsFuncHash(fsPath: string, funcHash: string): Promise<boolean> {
    return new Promise((resolve) => {
      // 引号可选：兼容字符串（"hash": "123"）与数字字面量（"hash": 123）两种序列化
      const pattern = new RegExp(`"hash"\\s*:\\s*"?${funcHash}"?`);
      let tail = '';
      const stream = fs.createReadStream(fsPath, { encoding: 'utf8' });
      stream.on('data', (chunk) => {
        const combined = tail + chunk;
        if (pattern.test(combined)) {
          stream.destroy();
          resolve(true);
          return;
        }
        tail = combined.slice(-200);
      });
      stream.on('end', () => resolve(pattern.test(tail)));
      stream.on('error', () => resolve(false));
    });
  }

  /**
   * 语义高亮映射：three_column_semantic 缓存优先（mtime 严格相等命中）；
   * miss 时单遍读取计算图 JSON 构建并回填缓存；构建失败降级为空映射（语义高亮
   * 属辅助信息，不因图文件不可读/解析失败中断联动初始化）。打开联动与切换 py 文件均经此推送。
   */
  static async pushSemanticObj(server: any, graphPath?: string): Promise<void> {
    const pathToLoad = graphPath ?? this.getGrahpDataExtend(server)?.fsPath ?? server.comPath;
    if (!pathToLoad) {
      return;
    }
    const workspaces = vscode.workspace.workspaceFolders;
    if (!workspaces || !workspaces.length) {
      server.setRef('CompleteData', { semanticObj: {} });
      return;
    }
    const cached = await getSemanticFromCache(pathToLoad);
    if (cached) {
      server.setRef('CompleteData', { semanticObj: cached });
      return;
    }
    try {
      const semanticObj = await readAndBuildSemanticObj(pathToLoad, workspaces[0].uri.fsPath);
      server.setRef('CompleteData', { semanticObj });
      await saveSemanticToCache(pathToLoad, semanticObj);
    } catch (error) {
      server.setRef('CompleteData', { semanticObj: {} });
      console.error(`[semantic-cache] 构建失败，降级为空映射 ${pathToLoad}:`, error);
    }
  }

  static override async getInitialData(server: any) {
    await super.getInitialData(server);
    await this.pushSemanticObj(server);
  }

  static findSubDir(targetHash: string, curPath: string, extName: string, res: string[]) {
    const entryList = readdirSync(curPath, { withFileTypes: true });
    for (const entry of entryList) {
      const fullPath = resolve(curPath, entry.name);
      const isTargetFile = (entry.isFile() && entry.name.toLowerCase().endsWith(extName) && entry.name.includes(targetHash)) ? true : false;
      if (entry.isDirectory()) {
        this.findSubDir(targetHash, fullPath, extName, res);
      } else if (isTargetFile) {
        res.push(fullPath);
      }
    }
  }

  static async getFuncHashFileList(server: any, data: any) {
    const targetHash = data.calleehash;
    const graphData = this.getGraphData(server);
    let originPath = graphData.fsPath;
    const extName = extname(originPath);
    const dirName = dirname(originPath);

    const matchedFileList: string[] = [];
    this.findSubDir(targetHash, dirName, extName, matchedFileList);
    server.setRef('GetPassPath', { data: matchedFileList });
  }
}
