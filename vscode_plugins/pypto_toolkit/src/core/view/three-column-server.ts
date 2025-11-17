import { Uri, ViewColumn, commands, window, WebviewPanel, workspace } from 'vscode';
import { ViewServer } from './view-server';
import { ViewServerContext } from './view-server-context';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { SwimGraphMsgHandler } from '../../handler/swimGraphMsgHandler';
import { SwimData } from '../../view/swimGraphView';
import { Fider } from '../../view/threeColumnEntry';
import { readFileSync, writeFileSync } from 'fs';
import { SingleGraphData } from '../graphData';
import * as vscode from 'vscode';
import { ICommonViewServer, IComViewServer, IThreeViewServer, ISwimViewServer } from './view-server-interface';

export class ThreeColumnServer
  extends ViewServer<any, any>
  implements ICommonViewServer, IComViewServer, IThreeViewServer, ISwimViewServer
{
  /** 客户端可以访问的方法名 */
  static override _apis: string[] = [
    'pageInit',
    'getPyCode',
    'savePyCode',
    'getInitialData',
    'askLayout',
    'getJsonGraphData',
    'getHealthyReport',
    'getSubgraph',
    'jumpToCodeLine',
    'openDiffViewer',
    'setFinalResult',
    'searchAllFunc',
    'getSwimData',
    'bindComGraphJson',
    'unbindComGraph',
    'jumpToComGraph',
    'openBoundComGraph',
    'jumpRawMagic',
    'showMessage',
    'saveRendingMode',
    'changeUserCfgConnection',
    'innerGetSubgraph',
    'returnFuncTree',
  ];

  /** 客户端可以使用的响应式对象名 */
  static override _refs: string[] = [
    'InitFlag',
    'SetThreeColumnMode',
    'FuncHashFileList',
    'CompleteData',
    'PyCode',
    'SaveSuccess',
    'SaveError',
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
    'returnSwim',
    'returnTheme',
    'noSwimFile',
    'validateSwimFile',
    'returnSwimData',
    'bindResult',
    'unbindResult',
    'JsonContent'
  ];
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  codePath: string;
  swimDataPath?: string;
  comPath?: string;
  swimData?: SwimData;
  codeMsgHandler?: any;
  sendFlag = false;

  query?: {};
  constructor(ctx: ViewServerContext) {
    super(ctx);
    if (!ctx.fileUri) {
      return;
    }
    const oldQuery = typeof ctx.fileUri.query === 'string' ? JSON.parse(ctx.fileUri.query) : ctx.fileUri.query ?? {};
    this.codePath = removeSuffix(oldQuery._path);

    // 设置视图标题
    const titleNameMatch = ctx.fileUri.path.match(/\/([^\/]+)\.py$/);
    let titleName = 'linkage mode default';
    if (titleNameMatch) {
      titleName = titleNameMatch[1];
    }

    this.title = 'multiple graph';
    this.isReveal = false;
    this._disposables = [];

    this.initWebViewPanel();
  }
  public override created(ctx: ViewServerContext): void {}

  public getInitialData = async () => {
    this.setRef('SetThreeColumnMode', '');
    await ComGraphHandler.getInitialData(this);
    await SwimGraphMsgHandler.getInitialData(this);
    await SwimGraphMsgHandler.getSwimData(this);
  };
  public getPyCode = async () => {
    await codeMsgHandler.getPyCode(this);
  };
  public savePyCode = async (message) => {
    await codeMsgHandler.savePyCode(this, message);
  };

  public askLayout = async (message) => {
    await ComGraphHandler.elkLayout(message.data, this);
  };
  public getJsonGraphData = async (message) => {
    await ComGraphHandler.getJsonGraphData(message, this);
  };
  public setFinalResult = async (message) => {
    await ComGraphHandler.setFinalResult(message, this);
  };
  public openDiffViewer = async () => {
    await ComGraphHandler.openDiffViewer(this, this.query);
  };
  public getSubgraph = async (message: any) => {
    await ComGraphHandler.getSubgraph(this, message.paramObj, this.query);
  };
  public searchAllFunc = async (message) => {
    await ComGraphHandler.searchAllFunc(this, message);
  };
  public jumpToCodeLine = async (message) => {
    await ComGraphHandler.jumpToCodeLine(message);
  };
  public getHealthyReport = async () => {
    await ComGraphHandler.getHealthyReport(this);
  };
  public innerGetSubgraph = async (message) => {
    await ComGraphHandler.innerGetSubgraph(this, message.paramObj);
  };
  public returnFuncTree = async () => {
    await ComGraphHandler.returnFuncTree(this);
  };
  public getSwimData = async () => {
    await SwimGraphMsgHandler.getSwimData(this);
  };
  public bindComGraphJson = async () => {
    await SwimGraphMsgHandler.bindComGraphJson(this);
  };
  public unbindComGraph = async () => {
    await SwimGraphMsgHandler.unbindComGraph(this);
  };
  public jumpToComGraph = async (message: any) => {
    await SwimGraphMsgHandler.jumpToComGraph(this, message.paramObj);
  };
  public openBoundComGraph = async () => {
    await SwimGraphMsgHandler.openBoundComGraph(this);
  };
  public jumpRawMagic = async (message: any) => {
    await SwimGraphMsgHandler.jumpRawMagic(this, message.paramObj);
  };
  public showMessage = async (message: any) => {
    await SwimGraphMsgHandler.showMessage(this, message.paramObj);
  };
  public saveRendingMode = async (message: any) => {
    await SwimGraphMsgHandler.saveRendingMode(this, message.paramObj);
  };
  public changeUserCfgConnection = async (message: any) => {
    await SwimGraphMsgHandler.changeUserCfgConnection(this, message.paramObj);
  };

  // 初始化自动关联路径
  async initRelativePath(
    codePath: string,
    swimPath: string | undefined,
    comPath: string | undefined,
  ): Promise<{ codePath: string; swimPath: string | undefined; comPath: string | undefined }> {
    const ret = await new Fider(codePath).findByCodePath(swimPath, comPath);
    return { codePath, ...ret };
  }

  async initWebViewPanel() {
    if (!this.swimDataPath || !this.comPath) {
      const { swimPath, comPath } = await this.initRelativePath(this.codePath, this.swimDataPath, this.comPath);
      if (!swimPath || !comPath) {
        // this.server.dispose();
        return;
      }
      this.swimDataPath = swimPath;
      this.comPath = comPath;
      this.swimData = new SwimData(Uri.file(swimPath), swimPath);
      this.query = {
        fsPath: comPath,
      };
      if (!this.sendFlag) {
        this.setRef('InitFlag', 'true');
      }
    }
  }

  public pageInit() {
    if (!this.sendFlag && this.swimDataPath && this.comPath) {
      this.setRef('InitFlag', 'true');
      this.sendFlag = true;
    }
  }

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
function removeSuffix(input: string): string {
  const pos = input.indexOf(' - ');
  if (pos !== -1) {
    return input.substring(0, pos);
  } else {
    return input;
  }
}

class codeMsgHandler {
  static getPyCode(server: any) {
    const codePath = server.codePath;
    let code = '';
    try {
      code = readFileSync(codePath, 'utf8');
    } catch (err) {
      console.error(`${codePath}读取 py 文件时发生错误:`, err);
    }
    server.setRef('PyCode', { data: { code, codePath } });
  }

  static savePyCode(server: any, code: string) {
    const codePath = server.codePath;

    try {
      // 保存代码到文件
      writeFileSync(codePath, code, 'utf8');

      // 通知前端保存成功
      server.setRef('SaveSuccess', { data: 'Code saved successfully' });

      console.log(`Code saved to: ${codePath}`);
    } catch (err: any) {
      console.error(`保存文件时发生错误:`, err);

      // 通知前端保存失败
      server.setRef('SaveError', { data: err.message });
    }
  }
}

class ComGraphHandler extends SingleGraphHandler {
  static searchFuncHashInProject(server, funcHash: string) {
    vscode.workspace.findFiles(`**/*${funcHash}*.json`).then((fileList) => {
      const res = fileList.map((uri) => uri.fsPath);
      server.setRef('FuncHashFileList', { data: res });
    });
  }
  static override async loadMainData(server: any): Promise<void> {
    if (!server.comGraphData) {
      server.comGraphData = new SingleGraphData(server.comPath, undefined);
    }

    const gd = server.comGraphData as SingleGraphData;
    if (!gd.funcHash) {
      gd.funcHash = await SingleGraphData.getEntryHash(gd.fsPath);
    }
  }

  static override async getInitialData(server: any) {
    await super.getInitialData(server);
    const graphData = this.getGraphData(server);
    const fullData = await graphData.getCompleteData(graphData.fsPath);
    server.setRef('CompleteData', { data: fullData });
  }
}
