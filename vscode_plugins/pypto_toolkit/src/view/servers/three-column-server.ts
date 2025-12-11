import { Uri } from 'vscode';
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { SwimGraphMsgHandler } from '../../handler/swimGraphMsgHandler';
import { SwimData } from '../swimGraphView';
import { Fider } from '../threeColumnEntry';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { isAbsolute, resolve, dirname, extname } from 'path';
import { SingleGraphData } from '../../core/graphData';
import * as vscode from 'vscode';
import { t } from 'i18next';

import {
  ICommonViewServer,
  IComViewServer,
  IThreeViewServer,
  ISwimViewServer,
  IComApis,
  IComRefs,
  ICommonApis,
  ICommonRefs,
  IThreeApis,
  IThreeRefs,
  ISwimApis,
  ISwimRefs,
} from './view-server-interface';

type Apis = IComApis | ICommonApis | IThreeApis | ISwimApis;

type Refs = IComRefs & ICommonRefs & IThreeRefs & ISwimRefs;

@viewRefs([
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
  'JsonGraphData',
  'LayoutResult',
  'PathNodesSet',
  'ReadJsonWarning',
  'PathOriginMode',
  'nodeErrorList',
  'returnSwim',
  'noSwimFile',
  'validateSwimFile',
  'returnSwimData',
  'bindResult',
  'unbindResult',
  'JsonContent',
  'GetPassPath',
  'returnInitPath',
  'returnSearchPath',
  'returnReplace',
  'SetVscodeState'
])
export class ThreeColumnServer
  extends ViewServer<Apis, Refs>
  implements ICommonViewServer, IComViewServer, IThreeViewServer, ISwimViewServer {
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  codePath: string;
  swimDataPath?: string;
  comPath?: string;
  swimData?: SwimData;
  codeMsgHandler?: any;

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
  public override created(ctx: ViewServerContext): void { }

  @viewApi()
  public getInitialData = async () => {
    this.setRef('SetThreeColumnMode', '');
    await ComGraphHandler.getInitialData(this);
    await SwimGraphMsgHandler.getInitialData(this);
  };
  @viewApi()
  public getInitialComData = async () => {
    this.setRef('SetThreeColumnMode', '');
    await ComGraphHandler.getInitialData(this);
  };
  @viewApi()
  public getInitialSwimData = async () => {
    this.setRef('SetThreeColumnMode', '');
    await SwimGraphMsgHandler.getInitialData(this);
  };
  @viewApi()
  public resetSwimData = async () => {
    const swimData = await SwimGraphMsgHandler.getSwimData(this);
    return swimData;
  };
  @viewApi()
  public getPyCode = async () => {
    await codeMsgHandler.getPyCode(this);
  };
  @viewApi()
  public savePyCode = async (message) => {
    await codeMsgHandler.savePyCode(this, message);
  };
  @viewApi()
  public askLayout = async (message) => {
    await ComGraphHandler.elkLayout(message.data, this);
  };
  @viewApi()
  public getJsonGraphData = async (message) => {
    await ComGraphHandler.getJsonGraphData(message, this);
  };
  @viewApi()
  public setFinalResult = async (message) => {
    await ComGraphHandler.setFinalResult(message, this);
  };
  @viewApi()
  public openDiffViewer = async () => {
    await ComGraphHandler.openDiffViewer(this, this.query);
  };
  @viewApi()
  public getSubgraph = async (message: any) => {
    await ComGraphHandler.getSubgraph(this, message.paramObj, this.query);
  };
  @viewApi()
  public searchAllFunc = async (message) => {
    await ComGraphHandler.searchAllFunc(this, message);
  };
  @viewApi()
  public jumpToCodeLine = async (message) => {
    await ComGraphHandler.jumpToCodeLine(message);
  };
  @viewApi()
  public getHealthyReport = async () => {
    await ComGraphHandler.getHealthyReport(this);
  };
  @viewApi()
  public innerGetSubgraph = async (message) => {
    await ComGraphHandler.innerGetSubgraph(this, message.paramObj);
  };
  @viewApi()
  public returnFuncTree = async () => {
    await ComGraphHandler.returnFuncTree(this);
  };
  @viewApi()
  public fetchVscodeState = async (message) => {
    if (message.swimDataPath) {
      this.swimDataPath = message.swimDataPath;
      this.swimData = new SwimData(Uri.file(message.swimDataPath), message.swimDataPath);
    }
    if (message.comPath) {
      this.comPath = message.comPath;
      this.query = {
        fsPath: message.comPath,
      };
    }
  };
  @viewApi()
  public getSwimData = async () => {
    return await SwimGraphMsgHandler.getSwimData(this);
  };
  @viewApi()
  public validateSwimFile = async () => {
    return await SwimGraphMsgHandler.validateFile(this);
  };
  @viewApi()
  public bindComGraphJson = async () => {
    await SwimGraphMsgHandler.bindComGraphJson(this);
  };
  @viewApi()
  public unbindComGraph = async () => {
    await SwimGraphMsgHandler.unbindComGraph(this);
  };
  @viewApi()
  public jumpToComGraph = async (message: any) => {
    await SwimGraphMsgHandler.jumpToComGraph(this, message.paramObj);
  };
  @viewApi()
  public openBoundComGraph = async () => {
    await SwimGraphMsgHandler.openBoundComGraph(this);
  };
  @viewApi()
  public jumpRawMagic = async (message: any) => {
    await SwimGraphMsgHandler.jumpRawMagic(this, message.paramObj);
  };
  @viewApi()
  public showMessage = async (message: any) => {
    await SwimGraphMsgHandler.showMessage(this, message.paramObj);
  };
  @viewApi()
  public saveRendingMode = async (message: any) => {
    await SwimGraphMsgHandler.saveRendingMode(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgConnection = async (message: any) => {
    await SwimGraphMsgHandler.changeUserCfgConnection(this, message.paramObj);
  };
  @viewApi()
  public getShortCutKeyCfg = async () => {
    return await SwimGraphMsgHandler.getShortCutKeyCfg(this);
  };
  @viewApi()
  public selectPassPath = async (message: any) => {
    await ComGraphHandler.getFuncHashFileList(this, message.paramObj);
  };
  @viewApi()
  public openSearchMode = async (message) => {
    await ComGraphHandler.openSearchMode(message, this);
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
      if (swimPath) {
        this.swimDataPath = swimPath;
        this.swimData = new SwimData(Uri.file(swimPath), swimPath);
      }
      if (comPath) {
        this.comPath = comPath;
        this.query = {
          fsPath: comPath,
        };
      }   
      if (!this.swimDataPath || !this.comPath) {
        const pathMsg = { swimPath: this.swimDataPath || "", comPath: this.comPath || "" };
        this.setRef('returnInitPath', { data: pathMsg });
      }
    }
    if (this.swimDataPath && this.comPath) {
      this.setRef('InitFlag', 'true');
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    }
  }

  @viewApi()
  public selectFile = async (message: any) => {
    const graphType = message.graphType;
    const options = message.options
    const { swimPath, comPath } = await new Fider(this.codePath).handleUserSelect(graphType);
    const handlePaths = (initPath: string, selectPath: string, graphType: string) => {
      const paths = graphType === "swimGraph" ? { swimPath, comPath: initPath } : { swimPath: initPath, comPath };
      const replaceMsg = { graphType, paths, selectPath };
      this.setRef('returnReplace', { data: replaceMsg });
    };

    const updatePaths = (swimPath: string | undefined, comPath: string | undefined) => {
      if (swimPath) {
        this.swimDataPath = swimPath;
        this.swimData = new SwimData(Uri.file(swimPath), swimPath);
      }
      if (comPath) {
        this.comPath = comPath;
        this.query = {
          fsPath: comPath,
        };
      }
      const pathMsg = { swimPath: swimPath || "", comPath: comPath || "" };
      this.setRef('returnSearchPath', { data: pathMsg });
    };

    if (graphType === "swimGraph") {
      if (options.comPath && comPath && options.comPath !== comPath) {
        handlePaths(options.comPath, comPath, graphType);
      } else {
        if (options.comPath) {
          updatePaths(swimPath, undefined);
        } else {
          updatePaths(swimPath, comPath);
        }
      }
    } else if (graphType === "computeGraph") {
      if (options.swimPath && swimPath && options.swimPath !== swimPath) {
        handlePaths(options.swimPath, swimPath, graphType);
      } else {
        if (options.swimPath) {
          updatePaths(undefined, comPath);
        } else {
          updatePaths(swimPath, comPath);
        }
      }
    }

    if (this.swimDataPath && this.comPath) {
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    }
  }

  @viewApi()
  public replaceFile = async (message: any) => {
    const options = message.options;
    const { swimPath, comPath } = options;
    if (swimPath) {
      this.swimDataPath = swimPath;
      this.swimData = new SwimData(Uri.file(swimPath), swimPath);
    }
    if (comPath) {
      this.comPath = comPath;
      this.query = {
        fsPath: comPath,
      };
    }
    const pathMsg = { swimPath: swimPath || "", comPath: comPath || "" };
    this.setRef('returnSearchPath', { data: pathMsg });
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
  static searchFuncHashInProject(server: any, funcHash: string) {
    vscode.workspace.findFiles(`**/*${funcHash}*.json`).then((fileList) => {
      const res = fileList.map((uri) => uri.fsPath);
      server.setRef('FuncHashFileList', { data: res });
    });
  }
  static override async loadMainData(server: any): Promise<boolean> {
    server.comGraphData = new SingleGraphData(server.comPath, undefined);
    const gd = server.comGraphData as SingleGraphData;

    try {
      const { entryhash, version } = await SingleGraphData.getEntryHashAndVersion(gd.fsPath);
      server.entryHash = entryhash;
      gd.funcHash = entryhash;
      gd.version = version;
    } catch (err: any) {
      if (err.code === 'FILE_READ_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.fileRead'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      } else if (err.code === 'JSON_PARSE_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.jsonParse'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      } else if (err.code === 'STREAM_PROCESSING_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.streaValues'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      } else {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.readJsonUnknown'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' }); return false;
      }
    }
    return true
  }

  static getSemanticByType(semanticInfo: any, op: any) {
    let lineno = undefined;
    let label = undefined;
    let filename = undefined;
    if (Array.isArray(semanticInfo)) {
      if (op.file) {
        lineno = op.line;
        filename = op.file;
        label = semanticInfo.find(label => label && label.trim() !== '');
        return { lineno, label, filename };
      }
    } else if (typeof (semanticInfo) === 'object') {
      return semanticInfo;
    }
  }

  static async getSemanticObj(server: any, jsonData: any) {
    const semanticObj = {};
    const workspaces = vscode.workspace.workspaceFolders;
    if (!workspaces || !workspaces.length) {
      server.setRef('SemanticObj', { semanticObj });
      return;
    }
    const rootPath = workspaces[0].uri.fsPath;
    if (jsonData.functions && Array.isArray(jsonData.functions)) {
      jsonData.functions.forEach((func: any) => {
        if (func.operations && Array.isArray(func.operations)) {
          func.operations.forEach((op: any) => {
            const semanticInfo = op.semantic_label;
            if (!semanticInfo) {
              // TODO：抛错
              return;
            }
            const result = ComGraphHandler.getSemanticByType(semanticInfo, op);
            if (!result) {
              return;
            }
            let { lineno, filename, label } = result;
            if (!isAbsolute(filename)) {
              filename = resolve(rootPath, filename);
            }
            if (filename.includes('\\')) {
              const driveLetter = filename[0].toLowerCase();
              const _path = filename.slice(1);
              filename = `${driveLetter}${_path}`;
            }
            if (!semanticObj[filename]) {
              semanticObj[filename] = {};
            }
            semanticObj[filename][lineno] = label;
          });
        }
      });
    }
    server.setRef('CompleteData', { semanticObj });
  }

  static override async getInitialData(server: any) {
    await super.getInitialData(server);
    const graphData = this.getGraphData(server);
    const fullData = await graphData.getCompleteData(graphData.fsPath);
    ComGraphHandler.getSemanticObj(server, fullData);
  }

  static findSubDir(targetHash: string, curPath: string, extName: string, res: string[]) {
    const entryList = readdirSync(curPath, { withFileTypes: true });
    for (const entry of entryList) {
      const fullPath = resolve(curPath, entry.name);
      const isTargetFile = (entry.isFile() && entry.name.toLowerCase().endsWith(extName) && entry.name.includes(targetHash)) ? true : false;
      if (entry.isDirectory()) {
        this.findSubDir(targetHash, fullPath, extName, res);
      } else if (isTargetFile) {
        res.push(fullPath);
      }
    }
  }

  static async getFuncHashFileList(server: any, data: any) {
    const targetHash = data.calleehash;
    const graphData = this.getGraphData(server);
    let originPath = graphData.fsPath;
    const extName = extname(originPath);
    const dirName = dirname(originPath);

    const matchedFileList: string[] = [];
    this.findSubDir(targetHash, dirName, extName, matchedFileList);
    server.setRef('GetPassPath', { data: matchedFileList });
  }
}
