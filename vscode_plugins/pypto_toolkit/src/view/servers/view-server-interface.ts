/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { accuFilePathData } from '../../core/sqliteCache';
import { ViewServer } from '../../core/view/view-server';
export type IComApis =
  | 'askLayout'
  | 'renderLayout'
  | 'getJsonGraphData'
  | 'openSearchMode'
  | 'getHealthyReport'
  | 'getAccurancyReport'
  | 'searchAccurancySumList'
  | 'getAccurancyDetail'
  | 'getInitialData'
  | 'getSubgraph'
  | 'jumpToCodeLine'
  | 'openDiffViewer'
  | 'setFinalResult'
  | 'searchAllFunc'
  | 'innerGetSubgraph'
  | 'selectFile'
  | 'returnFuncTree'
  | 'getSprottyGraphWithLevel'
  | 'getMetadata'
  | 'getMemTraceFile'
  | 'getTimelineEvents'
  | 'getInitialMemoryData'
  | 'accuFilePathGet'
  | 'getCmpDiffListData'
  | 'getCmpErrorListData'
  | 'getPrecisionExceptList';
export type IComRefs = {
  CalleeMap: unknown;
  CalleeOpAttrMap: unknown;
  ComData: unknown;
  DiffComData: unknown;
  ErrorMessage: unknown;
  FuncTree: unknown;
  GlobalSearchResult: unknown;
  HealthyReport: unknown;
  AccurancyReport: unknown,
  AccurancyList: unknown,
  AccurancyDetail: unknown,
  AccuFilePath: unknown,
  CmpDiffList: unknown,
  cmpErrorList: unknown;
  precisionExceptList: unknown;
  InitComGraph: unknown;
  InitDiffComGraph: unknown;
  IDELang: unknown;
  JsonGraphData: unknown;
  LayoutResult: unknown;
  PathNodesSet: unknown;
  ReadJsonWarning: unknown;
  PathOriginMode: unknown;
  nodeErrorList: unknown;
  InitComFlag: unknown;
  SameDiffFile: unknown;
  AfterDiffData: unknown;
  JsonContent: unknown;
  Metadata: unknown;
  Timeline: unknown;
  InitMemoryTraceFlag: unknown;
  MemTraceFileFlag: unknown;
};

export interface IComViewServer extends ViewServer<IComApis, IComRefs> {
  // getInitialData :()=> Promise<void> ;
  askLayout: (message: { data: any }) => Promise<void>;
  renderLayout?: (data: any, infoStr: string) => void;
  getJsonGraphData: (message: { data: any, diffType?: 'before' | 'after' }) => Promise<void>;
  openSearchMode?: (message: { data: any }) => Promise<void>;
  setFinalResult: (message: { data: any }) => Promise<void>;
  openDiffViewer: () => Promise<void>;
  getSubgraph: (message: { paramObj: any, query?: any }) => Promise<void>;
  searchAllFunc: (message: { data: any }) => Promise<void>;
  jumpToCodeLine: (message: { data: any }) => Promise<void>;
  getHealthyReport: () => Promise<void>;
  getAccurancyReport: () => Promise<void>;
  searchAccurancySumList: (message: { data: any }) => Promise<void>;
  getAccurancyDetail: (message: { data: any }) => Promise<void>;
  innerGetSubgraph: (message: { paramObj: any }) => Promise<void>;
  returnFuncTree: () => Promise<void>;
  selectFile: (beforeFilePath: string) => Promise<void>;
  getSprottyGraphWithLevel: (message: { data: any }) => Promise<void>;
  getMetadata: () => Promise<void>;
  getMemTraceFile: () => Promise<void>;
  getTimelineEvents: () => Promise<void>;
  getInitialMemoryData: () => Promise<void>;
  accuFilePathGet?: () => Promise<accuFilePathData | undefined>;
  getCmpDiffListData?: (data: {
    cmpCsvPath: string;
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
  }) => Promise<void>;
  getCmpErrorListData?: (data: {
    res?: string;
    pageSize?: number;
    startOffset?: number;
    keyword?: string;
    readFlag?: boolean;
  }) => Promise<void>;
  getPrecisionExceptList?: (data: {
    filePath: string;
    fileName: string;
  }) => Promise<void>;
}

export type IThreeApis =
  | 'getPyCode'
  | 'savePyCode'
  | 'getInitialData'
  | 'askLayout'
  | 'renderLayout'
  | 'getJsonGraphData'
  | 'openSearchMode'
  | 'getHealthyReport'
  | 'getSubgraph'
  | 'jumpToCodeLine'
  | 'openDiffViewer'
  | 'setFinalResult'
  | 'searchAllFunc'
  | 'selectPassPath'
  | 'returnFuncTree'
  | 'replaceFile'
  | 'getInitialComData'
  | 'getInitialSwimData'
  | 'selectFile'
  | 'selectRunData'
  | 'singleSelectFile'
  | 'fetchVscodeState';
export type IThreeRefs = {
  InitFlag: unknown;
  SetThreeColumnMode: unknown;
  FuncHashFileList: unknown;
  CompleteData: unknown;
  PyCode: unknown;
  SaveSuccess: unknown;
  SaveError: unknown;
  CalleeMap: unknown;
  CalleeOpAttrMap: unknown;
  ComData: unknown;
  DiffComData: unknown;
  ErrorMessage: unknown;
  FuncTree: unknown;
  GlobalSearchResult: unknown;
  HealthyReport: unknown;
  InitComGraph: unknown;
  InitDiffComGraph: unknown;
  IDELang: unknown;
  JsonGraphData: unknown;
  LayoutResult: unknown;
  PathNodesSet: unknown;
  ReadJsonWarning: unknown;
  PathOriginMode: unknown;
  nodeErrorList: unknown;
  performanceWarn: unknown;
  JsonContent: unknown;
  GetPassPath: unknown;
  returnInitPath: unknown;
  returnReplace: unknown;
  returnSwimPath: unknown,
  returnComPath: unknown,
  returnSearchPath: unknown;
  SetVscodeState: unknown;
};

export interface IThreeViewServer extends ViewServer<IThreeApis, IThreeRefs> {
  // getInitialData :()=> Promise<void> ;
  askLayout: (message: { data: any }) => Promise<void>;
  renderLayout?: (data: any, infoStr: string) => void;
  getJsonGraphData: (message: { data: any }) => Promise<void>;
  openSearchMode?: (message: { data: any }) => Promise<void>;
  setFinalResult: (message: { data: any }) => Promise<void>;
  openDiffViewer: () => Promise<void>;
  getSubgraph: (message: { paramObj: any }) => Promise<void>;
  searchAllFunc: (message: { data: any }) => Promise<void>;
  jumpToCodeLine: (message: { data: any }) => Promise<void>;
  getHealthyReport: () => Promise<void>;
  returnFuncTree: () => Promise<void>;
  fetchVscodeState: (message: {}) => Promise<void>;
}

export type ISwimApis =
  | 'getInitialData'
  | 'getOtherData'
  | 'getPerformanceInfo'
  | 'getSwimData'
  | 'getData'
  | 'bindComGraphJson'
  | 'unbindComGraph'
  | 'jumpToComGraph'
  | 'openBoundComGraph'
  | 'jumpRawMagic'
  | 'showMessage'
  | 'saveRendingMode'
  | 'changeUserCfgConnection'
  | 'changeUserCfgPerformance'
  | 'changeUserCfgIsMixMode'
  | 'getShortCutKeyCfg'
  | 'getCompressedData';
export type ISwimRefs = {
  returnSwim: unknown;
  noSwimFile: unknown;
  returnSwimData: unknown;
  bindResult: unknown;
  unbindResult: unknown;
  dataError: unknown;
  performanceWarn: unknown;
};
export interface ISwimViewServer extends ViewServer<ISwimApis, ISwimRefs> {
  getInitialData: () => Promise<void>;
  getData: (message: { swimDataPath: any }) => Promise<any>;
  getSwimData: (message: { swimDataPath: any }) => Promise<any>;
  getCompressedData: (message: { swimDataPath: any }) => Promise<any>;
  getOtherData: () => Promise<any>;
  getPerformanceInfo: () => Promise<any>;
  bindComGraphJson: () => Promise<void>;
  unbindComGraph: () => Promise<void>;
  jumpToComGraph: (message: { paramObj: any }) => Promise<void>;
  openBoundComGraph: () => Promise<void>;
  jumpRawMagic: (message: { paramObj: any }) => Promise<void>;
  showMessage: (message: { paramObj: any }) => Promise<void>;
  saveRendingMode: (message: { paramObj: any }) => Promise<void>;
  changeUserCfgConnection: (message: { paramObj: any }) => Promise<void>;
  changeUserCfgPerformance: (message: { paramObj: any }) => Promise<void>;
  changeUserCfgIsMixMode: (message: { paramObj: any }) => Promise<void>;
  getShortCutKeyCfg: () => Promise<any>;
}

export type ICommonApis = 'getInitialData'
  | 'setSaveDir'
  | 'checkSys'
  | 'saveFile'
  | 'checkFilePath';
export type ICommonRefs = {
  SaveDirPath: unknown;
  CheckSysResult: unknown;
  SaveFileResult: unknown;
  CheckFilePathResult: unknown;
};
export interface ICommonViewServer extends ViewServer<ICommonApis, ICommonRefs> {
  getInitialData: () => Promise<void>;
  setSaveDir: () => Promise<void>;
  checkSys: () => Promise<void>;
  saveFile: (message: { dataUrl: any, fileName?: any, filePath?: any, }) => Promise<void>;
  checkFilePath: (message: { filePath: any, }) => Promise<void>;
}

export type IControlFlowApis =
  | 'getAccurancyResult'
  | 'getPathPassResult'
  | 'savePyCode'
  | 'getInitialData'
  | 'fetchVscodeState'
  | 'setCurAccuFilePathApi';
export type IControlFlowRefs = {
  parseFlag: unknown;
  SetParsingMode: unknown;
  accurancyResult: unknown;
  pathPassResult: unknown;
};

export interface IControlFlowViewServer extends ViewServer<IControlFlowApis, IControlFlowRefs> {
  getAccurancyResult: (data: {controwFlowFilePath: string}) => Promise<void>;
  getPathPassResult: (data: {controwFlowFilePath: string}) => Promise<void>;
  setCurAccuFilePathApi: (data: {
    filePath: string;
    fileType: string;
  }) => Promise<void>;
}

// 内存追踪视图服务接口
export type IMemoryTraceApis =
  | 'getMetadata'
  | 'getTimeline'
  | 'getTimelineEvents'
  | 'getEventDetail'
  | 'getBufferState'
  | 'getBufferStateAt'
  | 'searchOps'
  | 'getInitialData'
  | 'getClockList'
  | 'getEventsAtClock';

export type IMemoryTraceRefs = {
  Metadata: unknown;
  Timeline: unknown;
  BufferState: unknown;
  ErrorMessage: unknown;
  InitMemoryTraceFlag: unknown;
  ClockList: unknown;
  EventsAtClock: unknown;
};

export interface IMemoryTraceViewServer extends ViewServer<IMemoryTraceApis, IMemoryTraceRefs> {
  getMetadata: () => Promise<any>;
  getTimeline: (message: { start?: number; limit?: number }) => Promise<any[]>;
  getTimelineEvents: () => Promise<any[]>;
  getEventDetail: (message: { clock: number }) => Promise<any>;
  getBufferState: (message: { clock: number }) => Promise<any[]>;
  getBufferStateAt: (message: { clock: number }) => Promise<any[]>;
  searchOps: (message: { opMagic: number }) => Promise<any>;
  getInitialData: () => Promise<void>;
  getClockList: () => Promise<any[]>;
  getEventsAtClock: (message: { clock: number }) => Promise<any[]>;
}

export type IGmMemoryVisualApis = 'getGmMemoryVisualData';
export type IGmMemoryVisualRefs = {
  GmMemoryVisualData: unknown;
};

export interface IGmMemoryVisualServer extends ViewServer<IGmMemoryVisualApis, IGmMemoryVisualRefs> {
  getGmMemoryVisualData: () => Promise<any>;
}
export type IOpCheckApis =
  | 'getCmpDiffListData'
  | 'getPrecisionExceptList'
  | 'setCurAccuFilePathApi'
  | 'openCmpDiffComGraphApi'
  | 'getCmpErrorListData';

export type IOpCheckRefs = {
  cmpDiffList: unknown;
  precisionExceptList: unknown;
  cmpErrorList: unknown;
};

export interface IOpCheckViewServer extends ViewServer<IOpCheckApis, IOpCheckRefs> {
  getCmpDiffListData: (data: {
    cmpCsvPath: string;
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
  }) => Promise<void>;
  getPrecisionExceptList: (data: {
    filePath: string;
    fileName: string;
  }) => Promise<void>;
  setCurAccuFilePathApi: (data: {
    filePath: string;
    fileType: string;
  }) => Promise<void>;
  openCmpDiffComGraphApi: (data: {
    filePath: string;
    funcHash: string;
    rootFuncHash?: string;
    passName: string;
    funcMagicName: string;
  }) => Promise<void>;
  getCmpErrorListData: (data: {
    cmpCsvPath: string;
    pageSize?: number;
    startOffset?: number;
    res?: string;
    keyword?: string;
  }) => Promise<void>;
}
