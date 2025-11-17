import { ViewServer } from './view-server';
export type IComApis =
  | 'askLayout'
  | 'getJsonGraphData'
  | 'getHealthyReport'
  | 'getInitialData'
  | 'getSubgraph'
  | 'jumpToCodeLine'
  | 'openDiffViewer'
  | 'setFinalResult'
  | 'searchAllFunc';
export type IComRefs =
  | 'CalleeMap'
  | 'CalleeOpAttrMap'
  | 'ComData'
  | 'DiffComData'
  | 'ErrorMessage'
  | 'FuncTree'
  | 'GlobalSearchResult'
  | 'HealthyReport'
  | 'InitComGraph'
  | 'InitDiffComGraph'
  | 'IDELang'
  | 'IDETheme'
  | 'JsonGraphData'
  | 'LayoutResult'
  | 'PathNodesSet'
  | 'ReadJsonWarning';

export interface IComViewServer extends ViewServer<IComApis, IComRefs> {
  // getInitialData :()=> Promise<void> ;
  askLayout: (message: { data: any }) => Promise<void>;
  getJsonGraphData: (message: { data: any }) => Promise<void>;
  setFinalResult: (message: { data: any }) => Promise<void>;
  openDiffViewer: () => Promise<void>;
  getSubgraph: (message: { paramObj: any }) => Promise<void>;
  searchAllFunc: (message: { data: any }) => Promise<void>;
  jumpToCodeLine: (message: { data: any }) => Promise<void>;
  getHealthyReport: () => Promise<void>;
}

export type IThreeApis =
  | 'getPyCode'
  | 'savePyCode'
  | 'getInitialData'
  | 'askLayout'
  | 'getJsonGraphData'
  | 'getHealthyReport'
  | 'getSubgraph'
  | 'jumpToCodeLine'
  | 'openDiffViewer'
  | 'setFinalResult'
  | 'searchAllFunc';
export type IThreeRefs =
  | 'InitFlag'
  | 'SetThreeColumnMode'
  | 'FuncHashFileList'
  | 'CompleteData'
  | 'PyCode'
  | 'SaveSuccess'
  | 'SaveError'
  | 'CalleeMap'
  | 'CalleeOpAttrMap'
  | 'ComData'
  | 'DiffComData'
  | 'ErrorMessage'
  | 'FuncTree'
  | 'GlobalSearchResult'
  | 'HealthyReport'
  | 'InitComGraph'
  | 'InitDiffComGraph'
  | 'IDELang'
  | 'IDETheme'
  | 'JsonGraphData'
  | 'LayoutResult'
  | 'PathNodesSet'
  | 'ReadJsonWarning';

export interface IThreeViewServer extends ViewServer<IThreeApis, IThreeRefs> {
  // getInitialData :()=> Promise<void> ;
  askLayout: (message: { data: any }) => Promise<void>;
  getJsonGraphData: (message: { data: any }) => Promise<void>;
  setFinalResult: (message: { data: any }) => Promise<void>;
  openDiffViewer: () => Promise<void>;
  getSubgraph: (message: { paramObj: any }) => Promise<void>;
  searchAllFunc: (message: { data: any }) => Promise<void>;
  jumpToCodeLine: (message: { data: any }) => Promise<void>;
  getHealthyReport: () => Promise<void>;
}

export type ISwimApis =
  | 'getInitialData'
  | 'getSwimData'
  | 'bindComGraphJson'
  | 'unbindComGraph'
  | 'jumpToComGraph'
  | 'openBoundComGraph'
  | 'jumpRawMagic'
  | 'showMessage'
  | 'saveRendingMode'
  | 'changeUserCfgConnection';
export type ISwimRefs =
  | 'returnSwim'
  | 'returnTheme'
  | 'noSwimFile'
  | 'returnSwimData'
  | 'bindResult'
  | 'unbindResult'
export interface ISwimViewServer extends ViewServer<ISwimApis, ISwimRefs> {
  getInitialData: () => Promise<void>;
  getSwimData: () => Promise<void>;
  bindComGraphJson: () => Promise<void>;
  unbindComGraph: () => Promise<void>;
  jumpToComGraph: (message: { paramObj: any }) => Promise<void>;
  openBoundComGraph: () => Promise<void>;
  jumpRawMagic: (message: { paramObj: any }) => Promise<void>;
  showMessage: (message: { paramObj: any }) => Promise<void>;
  saveRendingMode: (message: { paramObj: any }) => Promise<void>;
  changeUserCfgConnection: (message: { paramObj: any }) => Promise<void>;
}

export type ICommonApis = 'getInitialData';
export type ICommonRefs = '';
export interface ICommonViewServer extends ViewServer<ICommonApis, ICommonRefs> {
  getInitialData: () => Promise<void>;
}
