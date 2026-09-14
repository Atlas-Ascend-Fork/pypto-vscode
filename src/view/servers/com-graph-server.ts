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
import { window, Uri } from 'vscode';
import { exists, t } from 'i18next';
import { basename } from 'path';
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';
import { AbstractGraphData } from '../../core/graphData';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { DiffGraphHandler } from '../../handler/diffGraphHandler';
import { IComViewServer, ICommonViewServer, IComApis, IComRefs, ICommonApis, ICommonRefs } from './view-server-interface';
import { setSaveDir, getCurrentPlatform, saveFile, checkFilePath } from '../../common/downloadFileCheck';
import { MemoryTraceHandler } from '../../handler/memoryTraceHandler';
import { SQLiteCache } from '../../core/sqliteCache';
import { getCmpDiffList, getAccuFilePath, getCmpErrorList, getPrecisionExceptList, getTaskCmpList } from '../../common/accurancyAnylasis';
import * as fs from 'fs';
type Apis = IComApis | ICommonApis;

type Refs = IComRefs & ICommonRefs;

@viewRefs([
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
  'AccuFilePath',
  'CmpDiffList',
  'cmpErrorList',
  'taskCmpErrorList',
  'precisionExceptList',
  'InitComGraph',
  'InitDiffComGraph',
  'IDELang',
  'JsonGraphData',
  'LayoutResult',
  'PathNodesSet',
  'ReadJsonWarning',
  'InitComFlag',
  'PathOriginMode',
  'nodeErrorList',
  'SameDiffFile',
  'AfterDiffData',
  'JsonContent',
  'SaveFileResult',
  'CheckSysResult',
  'SaveDirPath',
  'CheckFilePathResult',
  'Metadata',
  'Timeline',
  'InitMemoryTraceFlag',
  'MemTraceFileFlag',
])
export class ComputeGraphServer extends ViewServer<Apis, Refs> implements IComViewServer, ICommonViewServer {
  comGraphData: AbstractGraphData;
  entryHash: string;
  viewType?: string;
  dataCtor: new (
    fsPath: string,
    funcHash?: string,
    calleeOpMagic?: string,
    calleeOpSubgraphId?: string,
    outputDirPath?: string,
    pathName?: string,
    curPath?: string,
    magicName?: string,
  ) => AbstractGraphData;
  handler: typeof BaseGraphMsgHandler;
  query?: any;

  public override created(ctx: ViewServerContext): void {
    this.viewType = ctx.viewType;
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : (ctx.fileUri?.query ?? {});
    if (this.viewType === 'computeGraph') {
      this.handler = SingleGraphHandler;
    } else if (this.viewType === 'diffGraph') {
      this.handler = DiffGraphHandler;
    }
  }

  @viewApi()
  public getInitialData = async () => {
    await this.handler.getInitialData(this);
    this.setRef('InitComFlag', 'true');
  };
  @viewApi()
  public askLayout = async (message) => {
    await this.handler.layout(message.data, this);
  };
  @viewApi()
  public renderLayout = async (data, infoStr: string) => {
    await this.handler.renderLayout(data, infoStr, this);
  };
  @viewApi()
  public getJsonGraphData = async (message) => {
    await this.handler.getJsonGraphData(message, this);
  };
  @viewApi()
  public openSearchMode = async (message) => {
    await this.handler.openSearchMode(message, this);
  };
  @viewApi()
  public setFinalResult = async (message) => {
    await this.handler.setFinalResult(message, this);
  };
  @viewApi()
  public openDiffViewer = async () => {
    await this.handler.openDiffViewer(this, this.query);
  };
  @viewApi()
  public getSubgraph = async (message: any) => {
    let query = this.query;
    if (typeof query === 'object' && message.query) {
      query = { ...(query as Object), ...message.query };
    }
    await this.handler.getSubgraph(this, message.paramObj, query);
  };
  @viewApi()
  public searchAllFunc = async (message) => {
    await this.handler.searchAllFunc(this, message);
  };
  @viewApi()
  public jumpToCodeLine = async (message) => {
    await this.handler.jumpToCodeLine(message.paramObj);
  };
  @viewApi()
  public getHealthyReport = async () => {
    await this.handler.getHealthyReport(this);
  };
  @viewApi()
  public getAccurancyReport = async () => {
    await this.handler.getAccurancyReport(this);
  };
  @viewApi()
  public searchAccurancySumList = async (message) => {
    await this.handler.searchAccurancySumList(this, message);
  };
  @viewApi()
  public getAccurancyDetail = async (message) => {
    await this.handler.getAccurancyDetail(this, message);
  };
  @viewApi()
  public innerGetSubgraph = async (message) => {
    await this.handler.innerGetSubgraph(this, message);
  };

  @viewApi()
  public getSprottyGraphWithLevel = async (message) => {
    await this.handler.getSprottyGraphWithLevel(this, message);
  };

  @viewApi()
  public returnFuncTree = async () => {
    await SingleGraphHandler.returnFuncTree(this);
  };
  @viewApi()
  public setSaveDir = async () => {
    const dir = await setSaveDir();
    this.setRef('SaveDirPath', { dir: dir });
  };
  @viewApi()
  public checkSys = async () => {
    this.setRef('CheckSysResult', { sustem: getCurrentPlatform() });
  };
  @viewApi()
  public saveFile = async (message) => {
    const result = await saveFile(message);
    this.setRef('SaveFileResult', result);
  };
  @viewApi()
  public checkFilePath = async (message) => {
    const result = await checkFilePath(message);
    this.setRef('CheckFilePathResult', result);
  };
  @viewApi()
  public selectFile = async (beforeFilePath: string) => {
    const fileName = basename(beforeFilePath);
    const fileUris = await window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      defaultUri: Uri.file(beforeFilePath.replace(fileName, '')),
      openLabel: t('pypto.selectDiffFile') as string,
      filters: {
        [t('pypto.jsonFile')]: ['json'],
        [t('pypto.allFile')]: ['*'],
      },
      title: t('pypto.selectDiffFile') as string,
    });

    if (fileUris && fileUris.length > 0) {
      if (beforeFilePath === fileUris[0].fsPath) {
        this.setRef('SameDiffFile', '');
        return;
      }
      this.handler.loadDiffData(this, fileUris[0].fsPath);
    }
  };

  @viewApi()
  public getMemTraceFile = async () => {
    let fsPath = this.query?._path ?? '';
    const memoryPath = this.query?.memoryPath;
    if (fsPath == '') return;
    if (/_OoO_Memory_Trace\.json$/.test(memoryPath)) {
      this.setRef('MemTraceFileFlag', { isComFile: false, existTraceFile: true });
      return;
    } else {
      let memTracePath = fsPath.replace('.json', '_OoO_Memory_Trace.json');
      if (fs.existsSync(memTracePath)) {
        this.setRef('MemTraceFileFlag', { isComFile: true, existTraceFile: true });
      }else{
        this.setRef('MemTraceFileFlag', { isComFile: true, existTraceFile: false });
      }
    }
  };

  @viewApi()
  public getInitialMemoryData = async () => {
    let fsPath = this.query?._path ?? '';
    if (fsPath == '') return;
    if (!/_OoO_Memory_Trace\.json$/.test(fsPath)) {
      fsPath = fsPath.replace(/\.json$/, '_OoO_Memory_Trace.json');
    }
    if (fs.existsSync(fsPath)) {
      await MemoryTraceHandler.parse(fsPath);
      const metadata = await MemoryTraceHandler.getMetadata(fsPath);
      this.setRef('Metadata', metadata);
      this.setRef('InitMemoryTraceFlag', 'true');
    }
  };

  @viewApi()
  public getMetadata = async () => {
    let fsPath = this.query?._path ?? '';
    if (fsPath == '') return;
    if (!/_OoO_Memory_Trace\.json$/.test(fsPath)) {
      fsPath = fsPath.replace(/\.json$/, '_OoO_Memory_Trace.json');
    }
    const metadata = await MemoryTraceHandler.getMetadata(fsPath);
    this.setRef('Metadata', metadata);
  };

  // 按clock分好事件
  @viewApi()
  public getTimelineEvents = async () => {
    let fsPath = this.query?._path ?? '';
    if (fsPath == '') return;
    if (!/_OoO_Memory_Trace\.json$/.test(fsPath)) {
      fsPath = fsPath.replace(/\.json$/, '_OoO_Memory_Trace.json');
    }
    const events = await MemoryTraceHandler.getTimelineEvents(fsPath);
    this.setRef('Timeline', events);
  };

  @viewApi()
  public accuFilePathGet = async () => {
    const result = await getAccuFilePath();
    this.setRef('AccuFilePath', result);
    return result;
  };

  @viewApi()
  public getCmpDiffListData = async (data: {
    cmpCsvPath: string;
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
  }) => {
    const { cmpCsvPath, pageSize = 50, startOffset = 0, res, keyword } = data;
    const result = await getCmpDiffList(cmpCsvPath, true, pageSize, startOffset, res, keyword);
    this.setRef('CmpDiffList', result);
  };

  @viewApi()
  public getCmpErrorListData = async (data: {
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
    readFlag?: boolean;
    cmpCsvPath?: string;
    comgraphPath?: string;
    rootFuncHash?: string;
    oriLoopInfo?: string;
  }) => {
    const cmpCsvInfo = await getAccuFilePath();
    const filePath = data.cmpCsvPath || '';
    const comgraphPath = data.comgraphPath || '';
    
    const { pageSize = 50, startOffset = 0, res, keyword, readFlag = true, rootFuncHash = '', oriLoopInfo = '' } = data;
    const result = await getCmpErrorList(filePath, comgraphPath, readFlag, pageSize, startOffset, keyword, rootFuncHash, oriLoopInfo);
    this.setRef('cmpErrorList', result);
  };

  @viewApi()
  public getTaskCmpErrorListData = async (data: {
    pageSize?: number;
    startOffset?: number;
    keyword?: string;
    readFlag?: boolean;
    cmpCsvPath?: string;
    comgraphPath?: string;
    filterWord?: { rawMagic?: string; opMagic?: string; tensorAddr?: string; symbol?: string; funchash?: string };
    rootFuncHash?: string;
    oriLoopInfo?: string;
    pathFunchash?: string;
    leafFunchash?: string;
  }) => {
    const filePath = data.cmpCsvPath || '';
    const { pageSize = 50, startOffset = 0, keyword, readFlag = false, filterWord, rootFuncHash, oriLoopInfo = '', pathFunchash, leafFunchash } = data;
    const result = await getTaskCmpList(filePath, readFlag, pageSize, startOffset, 'FAIL', keyword, undefined, leafFunchash, filterWord, rootFuncHash, oriLoopInfo, pathFunchash);
    this.setRef('taskCmpErrorList', result);
  };

  @viewApi()
  public getPrecisionExceptList = async (data: {
    filePath: string;
    fileName: string;
  }) => {
    const { filePath, fileName } = data;

    try {
      const result = await getPrecisionExceptList(filePath, fileName);
      this.setRef('precisionExceptList', result);
    } catch (error) {
      this.setRef('precisionExceptList', null);
    }
  };

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
