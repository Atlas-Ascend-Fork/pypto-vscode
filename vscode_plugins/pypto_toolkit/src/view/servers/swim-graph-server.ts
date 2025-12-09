import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { SwimGraphMsgHandler } from '../../handler/swimGraphMsgHandler';
import { ISwimViewServer, ICommonViewServer, ISwimApis, ISwimRefs, ICommonApis, ICommonRefs } from './view-server-interface';

type Apis = ISwimApis | ICommonApis;

type Refs = ISwimRefs & ICommonRefs & { validateSwimFile: unknown };

@viewRefs(['returnSwim', 'noSwimFile', 'validateSwimFile', 'returnSwimData', 'bindResult', 'unbindResult'])
export class SwimGraphServer extends ViewServer<Apis, Refs> implements ICommonViewServer, ISwimViewServer {
  swimDataPath: string;
  title: string;
  isReveal: boolean;
  _disposables: any[];

  entryHash: string;
  viewType?: string;

  handler: typeof SwimGraphMsgHandler;
  query?: any;

  constructor(ctx: ViewServerContext) {
    super(ctx);
    this.title = 'Swim Lane Graph';
    this.isReveal = false;
    this._disposables = [];
    this.viewType = ctx.viewType;
    this.query = typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : ctx.fileUri?.query ?? {};
    this.swimDataPath = this.query._path;
    this.handler = SwimGraphMsgHandler;
  }
  public override created(ctx: ViewServerContext): void {}

  @viewApi()
  public getInitialData = async () => {
    await this.handler.getInitialData(this);
  };
  @viewApi()
  public getSwimData = async () => {
    return await this.handler.getSwimData(this);
  };
  @viewApi()
  public bindComGraphJson = async () => {
    await this.handler.bindComGraphJson(this);
  };
  @viewApi()
  public unbindComGraph = async () => {
    await this.handler.unbindComGraph(this);
  };
  @viewApi()
  public jumpToComGraph = async (message: any) => {
    await this.handler.jumpToComGraph(this, message.paramObj);
  };
  @viewApi()
  public openBoundComGraph = async () => {
    await this.handler.openBoundComGraph(this);
  };
  @viewApi()
  public jumpRawMagic = async (message: any) => {
    await this.handler.jumpRawMagic(this, message.paramObj);
  };
  @viewApi()
  public showMessage = async (message: any) => {
    await this.handler.showMessage(this, message.paramObj);
  };
  @viewApi()
  public saveRendingMode = async (message: any) => {
    await this.handler.saveRendingMode(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgConnection = async (message: any) => {
    await this.handler.changeUserCfgConnection(this, message.paramObj);
  };
  @viewApi()
  public getShortCutKeyCfg = async () => {
    return await this.handler.getShortCutKeyCfg(this);
  };

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
