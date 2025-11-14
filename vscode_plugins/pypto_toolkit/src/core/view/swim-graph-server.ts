import { ViewServer } from './view-server';
import { ViewServerContext } from './view-server-context';
import { SwimGraphMsgHandler } from '../../handler/swimGraphMsgHandler';
import { ISwimViewServer,ICommonViewServer,ISwimApis,ISwimRefs } from './view-server-interface';

export class SwimGraphServer extends ViewServer<any, any> implements ICommonViewServer, ISwimViewServer {
  /** 客户端可以访问的方法名 */
  static override _apis: string[] = [
    'getInitialData',
    'getSwimData',
    'bindComGraphJson',
    'unbindComGraph',
    'jumpToComGraph',
    'openBoundComGraph',
    'jumpRawMagic',
    'showMessage',
    'saveRendingMode',
    'changeUserCfgConnection',
  ];

  /** 客户端可以使用的响应式对象名 */
  static override _refs: string[] = [
    'returnSwim',
    'returnTheme',
    'noSwimFile',
    'returnSwimData',
    'bindResult',
    'unbindResult',
  ];
    
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
  
    public getInitialData = async () => {
      await this.handler.getInitialData(this);
    };
    public getSwimData = async () => {
      await this.handler.getSwimData(this);
    };
    public bindComGraphJson = async () => {
      await this.handler.bindComGraphJson(this);
    };
    public unbindComGraph = async () => {
      await this.handler.unbindComGraph(this);
    };
    public jumpToComGraph = async (message: any) => {
      await this.handler.jumpToComGraph(this, message.paramObj);
    };
    public openBoundComGraph = async () => {
      await this.handler.openBoundComGraph(this);
    };
    public jumpRawMagic = async (message: any) => {
      await this.handler.jumpRawMagic(this, message.paramObj);
    };
    public showMessage = async (message: any) => {
      await this.handler.showMessage(this, message.paramObj);
    };
    public saveRendingMode = async (message: any) => {
      await this.handler.saveRendingMode(this, message.paramObj);
    }; 
    public changeUserCfgConnection = async (message: any) => {
      await this.handler.changeUserCfgConnection(this, message.paramObj);
    }; 

    safeParse(str) {
      try {
        return JSON.parse(str);
      } catch {
        return {};
      }
    }
}