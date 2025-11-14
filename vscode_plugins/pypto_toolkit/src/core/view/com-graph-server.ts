import { ViewServer } from './view-server';
import { ViewServerContext } from './view-server-context';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';
import { AbstractGraphData } from '../../core/graphData';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { DiffGraphHandler } from '../../handler/diffGraphHandler';
import { IComViewServer,ICommonViewServer,IComApis,IComRefs } from './view-server-interface';


export class ComputeGraphServer extends ViewServer<any, any> implements IComViewServer,ICommonViewServer {
  /** 客户端可以访问的方法名 */
  static override _apis: string[] = [
    'askLayout',
    'getJsonGraphData',
    'getHealthyReport',
    'getInitialData',
    'getSubgraph',
    'jumpToCodeLine',
    'openDiffViewer',
    'setFinalResult',
    'searchAllFunc',
    'innerGetSubgraph',
  ];

  /** 客户端可以使用的响应式对象名 */
  static override _refs: string[] = [
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
    'IDETheme',
    'JsonGraphData',
    'LayoutResult',
    'PathNodesSet',
    'ReadJsonWarning',
  ];
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

  constructor(ctx: ViewServerContext) {
    super(ctx);
    this.viewType = ctx.viewType;
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : ctx.fileUri?.query ?? {};
    if (this.viewType === 'computeGraph') {
      this.handler = SingleGraphHandler;
    } else if (this.viewType === 'diffGraph') {
      this.handler = DiffGraphHandler;
    }
  }
  public override created(ctx: ViewServerContext): void {}

  public getInitialData = async () => {
    await this.handler.getInitialData(this);
  };
  public askLayout = async (message) => {
    await this.handler.elkLayout(message.data, this);
  };
  public getJsonGraphData = async (message) => {
    await this.handler.getJsonGraphData(message, this);
  };
  public setFinalResult = async (message) => {
    await this.handler.setFinalResult(message, this);
  };
  public openDiffViewer = async () => {
    await this.handler.openDiffViewer(this, this.query);
  };
  public getSubgraph = async (message: any) => {
    await this.handler.getSubgraph(this, message.paramObj, this.query);
  };
  public searchAllFunc = async (message) => {
    await this.handler.searchAllFunc(this, message);
  };
  public jumpToCodeLine = async (message) => {
    await this.handler.jumpToCodeLine(message);
  };
  public getHealthyReport = async () => {
    await this.handler.getHealthyReport(this);
  };
  public innerGetSubgraph = async (message) => {
    await this.handler.innerGetSubgraph(this,message);
  };

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}

