import { ViewServer } from '../../core/view/view-server';
export type IComApis =
  | 'askLayout'
  | 'renderLayout'
  | 'getJsonGraphData'
  | 'openSearchMode'
  | 'getHealthyReport'
  | 'getInitialData'
  | 'getSubgraph'
  | 'jumpToCodeLine'
  | 'openDiffViewer'
  | 'setFinalResult'
  | 'searchAllFunc'
  | 'innerGetSubgraph'
  | 'selectFile'
  | 'returnFuncTree'
  | 'getSprottyGraphWithLevel';
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
};

export interface IComViewServer extends ViewServer<IComApis, IComRefs> {
  // getInitialData :()=> Promise<void> ;
  askLayout: (message: { data: any }) => Promise<void>;
  renderLayout?: (data: any, infoStr: string) => void;
  getJsonGraphData: (message: { data: any }) => Promise<void>;
  openSearchMode?: (message: { data: any }) => Promise<void>;
  setFinalResult: (message: { data: any }) => Promise<void>;
  openDiffViewer: () => Promise<void>;
  getSubgraph: (message: { paramObj: any, query?: any }) => Promise<void>;
  searchAllFunc: (message: { data: any }) => Promise<void>;
  jumpToCodeLine: (message: { data: any }) => Promise<void>;
  getHealthyReport: () => Promise<void>;
  innerGetSubgraph: (message: { paramObj: any }) => Promise<void>;
  returnFuncTree: () => Promise<void>;
  selectFile: (beforeFilePath: string) => Promise<void>;
  getSprottyGraphWithLevel: (message: { data: any }) => Promise<void>;
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
  | 'getSwimData'
  | 'bindComGraphJson'
  | 'unbindComGraph'
  | 'jumpToComGraph'
  | 'openBoundComGraph'
  | 'jumpRawMagic'
  | 'showMessage'
  | 'saveRendingMode'
  | 'changeUserCfgConnection'
  | 'getShortCutKeyCfg';
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
  getSwimData: (message: { swimDataPath: any }) => Promise<any>;
  getOtherData: () => Promise<any>;
  bindComGraphJson: () => Promise<void>;
  unbindComGraph: () => Promise<void>;
  jumpToComGraph: (message: { paramObj: any }) => Promise<void>;
  openBoundComGraph: () => Promise<void>;
  jumpRawMagic: (message: { paramObj: any }) => Promise<void>;
  showMessage: (message: { paramObj: any }) => Promise<void>;
  saveRendingMode: (message: { paramObj: any }) => Promise<void>;
  changeUserCfgConnection: (message: { paramObj: any }) => Promise<void>;
  getShortCutKeyCfg: () => Promise<any>;
}

export type ICommonApis = 'getInitialData'
  | 'setSaveDir'
  | 'checkSys'
  | 'saveFile';
export type ICommonRefs = {
  SaveDirPath: unknown;
  CheckSysResult: unknown;
  SaveFileResult: unknown;
};
export interface ICommonViewServer extends ViewServer<ICommonApis, ICommonRefs> {
  getInitialData: () => Promise<void>;
  setSaveDir: () => Promise<void>;
  checkSys: () => Promise<void>;
  saveFile: (message: { dataUrl: any, fileName?: any, filePath?: any, }) => Promise<void>;
}
