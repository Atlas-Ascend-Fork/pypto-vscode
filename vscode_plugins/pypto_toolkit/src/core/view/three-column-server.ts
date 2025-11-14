import { Uri, ViewColumn, commands, window, WebviewPanel, workspace } from 'vscode';
import { ViewServer } from './view-server';
import { ViewServerContext } from './view-server-context';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { MsgHandler, SwimData } from '../../view/swimGraphView';
import { Fider } from '../../view/threeColumnEntry';
import { readFileSync, writeFileSync } from 'fs';
import { SingleGraphData } from '../graphData';
import * as vscode from 'vscode';
import { ICommonViewServer,IComViewServer,IThreeViewServer,IThreeApis,IThreeRefs } from './view-server-interface';

export class ThreeColumnServer extends ViewServer<any, any> implements ICommonViewServer,IComViewServer,IThreeViewServer {
  /** 客户端可以访问的方法名 */
  static override _apis: string[] = [
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

  ];
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  codePath: string;
  swimPath?: string;
  comPath?: string;
  swimData?: SwimData;
  codeMsgHandler?: any;
  comgraphHanlder?: SingleGraphHandler;
  swimgraphHandler?: MsgHandler;
  query?: {};
  constructor(ctx: ViewServerContext) {
    super(ctx);
    if (!ctx.fileUri) {
      return;
    }
    const oldQuery = typeof ctx.fileUri.query === 'string' ? JSON.parse(ctx.fileUri.query) : ctx.fileUri.query ?? {};
    this.codePath = removeSuffix(oldQuery._path);

    // this.viewType = ctx.viewType;
    // 设置视图标题
    const titleNameMatch = ctx.fileUri.path.match(/\/([^\/]+)\.py$/);
    let titleName = 'linkage mode default';
    if (titleNameMatch) {
      titleName = titleNameMatch[1];
    }

    this.title = 'multiple graph';
    this.isReveal = false;
    this._disposables = [];

    // this.swimPath = swimUri?.fsPath;
    // this.comPath = comgraphUri?.fsPath;

    // this.codeMsgHandler = codeMsgHandler;
    // this.comgraphHanlder = comGraphHandler;
    // this.swimgraphHandler = swimGrapHandler;
    // this.codePath = this.codePath;
    this.initWebViewPanel();
  }
  public override created(ctx: ViewServerContext): void {}

  public getInitialData = async () => {
    // await waitForVariableWhileLoop(() => this.comPath);
    this.setRef('SetThreeColumnMode', '');
    await comGraphHandler.getInitialData(this);
    // await swimGrapHandler.getInitialData(this);
  };
  public getPyCode = async () => {
    await codeMsgHandler.getPyCode(this);
  };
  public savePyCode = async (message) => {
    await codeMsgHandler.savePyCode(this, message);
  };

  public askLayout = async (message) => {
    await comGraphHandler.elkLayout(message.data, this);
  };
  public getJsonGraphData = async (message) => {
    await comGraphHandler.getJsonGraphData(message, this);
  };
  public setFinalResult = async (message) => {
    await comGraphHandler.setFinalResult(message, this);
  };
  public openDiffViewer = async () => {
    await comGraphHandler.openDiffViewer(this, this.query);
  };
  public getSubgraph = async (message: any) => {
    await comGraphHandler.getSubgraph(this, message.paramObj, this.query);
  };
  public searchAllFunc = async (message) => {
    await comGraphHandler.searchAllFunc(this, message);
  };
  public jumpToCodeLine = async (message) => {
    await comGraphHandler.jumpToCodeLine(message);
  };
  public getHealthyReport = async () => {
    await comGraphHandler.getHealthyReport(this);
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
    if (!this.swimPath || !this.comPath) {
      const { swimPath, comPath } = await this.initRelativePath(this.codePath, this.swimPath, this.comPath);
      if (!swimPath || !comPath) {
        // this.server.dispose();
        return;
      }
      this.swimPath = swimPath;
      this.comPath = comPath;
      this.swimData = new SwimData(Uri.file(swimPath), swimPath);
      this.query = {
        fsPath: comPath,
      };
      this.setRef('InitFlag','true');
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
async function waitForVariableWhileLoop<T>(
  checkCondition: () => T | null | undefined,
  interval: number = 100,
  timeout: number = 50000,
): Promise<T> {
  const startTime = Date.now();
  let i = 0;
  while (true) {
    const result = checkCondition();
    if (result !== null && result !== undefined) {
      return result;
    }
    console.debug(`等待:第`, i++,`次`);
    if (Date.now() - startTime > timeout) {
      throw new Error('等待超时');
    }

    // 等待指定时间后继续检查
    await new Promise((resolve) => setTimeout(resolve, interval));
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

class comGraphHandler extends SingleGraphHandler {
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

class swimGrapHandler extends MsgHandler {}
