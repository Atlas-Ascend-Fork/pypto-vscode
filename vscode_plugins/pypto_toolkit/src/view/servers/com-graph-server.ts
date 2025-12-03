import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';
import { AbstractGraphData } from '../../core/graphData';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { DiffGraphHandler } from '../../handler/diffGraphHandler';
import { IComViewServer, ICommonViewServer, IComApis, IComRefs, ICommonApis, ICommonRefs } from './view-server-interface';

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
  public getJsonGraphData = async (message) => {
    await this.handler.getJsonGraphData(message, this);
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
    await this.handler.getSubgraph(this, message.paramObj, this.query);
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
  public returnFuncTree = async () => {
    await SingleGraphHandler.returnFuncTree(this);
  };

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
