import { window, Uri } from 'vscode';
import { t } from 'i18next';
import { basename } from 'path';
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';
import { AbstractGraphData } from '../../core/graphData';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { DiffGraphHandler } from '../../handler/diffGraphHandler';
import { IComViewServer, ICommonViewServer, IComApis, IComRefs, ICommonApis, ICommonRefs } from './view-server-interface';
import { setSaveDir, getCurrentPlatform, saveFile } from '../../common/downloadFileCheck';

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
  'SaveDirPath'
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
  query?: string;

  public override created(ctx: ViewServerContext): void {
    this.viewType = ctx.viewType;
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : ctx.fileUri?.query ?? {};
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
    await this.handler.elkLayout(message.data, this);
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
    const dir = await setSaveDir()
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

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
