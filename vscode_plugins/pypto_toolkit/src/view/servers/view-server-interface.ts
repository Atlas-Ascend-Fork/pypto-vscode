import { ViewServer } from '../../core/view/view-server';
export type IComApis =
  | 'askLayout'
  | 'getJsonGraphData'
  | 'getHealthyReport'
  | 'getInitialData'
  | 'getSubgraph'
  | 'jumpToCodeLine'
  | 'openDiffViewer'
  | 'setFinalResult'
  | 'searchAllFunc'
  | 'innerGetSubgraph'
  | 'returnFuncTree';
export type IComRefs = {
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
  IDETheme: unknown;
  JsonGraphData: unknown;
  LayoutResult: unknown;
  PathNodesSet: unknown;
  ReadJsonWarning: unknown;
  InitComFlag: unknown;
};

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
  innerGetSubgraph: (message: { paramObj: any }) => Promise<void>;
  returnFuncTree: () => Promise<void>;
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
  | 'searchAllFunc'
  | 'selectPassPath'
  | 'returnFuncTree'
  | 'replaceFile'
  | 'getInitialComData'
  | 'getInitialSwimData'
  | 'resetSwimData'
  | 'selectFile';
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
  IDETheme: unknown;
  JsonGraphData: unknown;
  LayoutResult: unknown;
  PathNodesSet: unknown;
  ReadJsonWarning: unknown;
  validateSwimFile: unknown;
  JsonContent: unknown;
  GetPassPath: unknown;
  returnInitPath: unknown;
  returnReplace: unknown;
  returnSearchPath: unknown;
};

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
  returnFuncTree: () => Promise<void>;
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
export type ISwimRefs = {
  returnSwim: unknown;
  returnTheme: unknown;
  noSwimFile: unknown;
  returnSwimData: unknown;
  bindResult: unknown;
  unbindResult: unknown;
};
export interface ISwimViewServer extends ViewServer<ISwimApis, ISwimRefs> {
  getInitialData: () => Promise<void>;
  getSwimData: () => Promise<any>;
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
export type ICommonRefs = {};
export interface ICommonViewServer extends ViewServer<ICommonApis, ICommonRefs> {
  getInitialData: () => Promise<void>;
}
