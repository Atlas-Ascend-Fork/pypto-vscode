import { Uri } from 'vscode';
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { SingleGraphHandler } from '../../handler/singleGraphHandler';
import { SwimGraphMsgHandler } from '../../handler/swimGraphMsgHandler';
import { SwimData } from '../swimGraphView';
import { Fider } from '../threeColumnEntry';
import { Util } from '../../util';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { isAbsolute, resolve, dirname, extname } from 'path';
import { SingleGraphData } from '../../core/graphData';
import { GetOutputRecordParams } from '../../services/run-data/api';
import { getRunDataList } from '../../services/run-data/api';
import * as vscode from 'vscode';
import { t } from 'i18next';

import * as fs from 'node:fs';
import * as stream from 'node:stream';
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
import { readFirstNLines } from '../../utils/file-system';

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
  'AccurancyReport',
  'AccurancyList',
  'AccurancyDetail',
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
  'dataError',
  'performanceWarn',
  'returnSwimData',
  'bindResult',
  'unbindResult',
  'JsonContent',
  'GetPassPath',
  'returnInitPath',
  'returnSearchPath',
  'returnReplace',
  'SetVscodeState',
  'returnSwimPath',
  'returnComPath',
])
export class ThreeColumnServer
  extends ViewServer<Apis, Refs>
  implements ICommonViewServer, IComViewServer, IThreeViewServer, ISwimViewServer {
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  codePath: string;
  initPath: string;
  swimDataPath?: string;
  comPath?: string;
  swimData?: SwimData;
  codeMsgHandler?: any;
  query?: any;
  cachePath?: any;
  headerTitle?: string

  constructor(ctx: ViewServerContext) {
    super(ctx);
  }

  public override created(ctx: ViewServerContext): void { 
    if (!ctx.fileUri) {
      return;
    }
    const oldQuery = typeof ctx.fileUri.query === 'string' ? JSON.parse(ctx.fileUri.query) : ctx.fileUri.query ?? {};
    this.codePath = removeSuffix(oldQuery._path);
    this.initPath = this.codePath;
    // 设置视图标题
    const titleNameMatch = ctx.fileUri.path.match(/\/([^\/]+)\.py$/);
    let titleName = 'linkage mode default';
    if (titleNameMatch) {
      titleName = titleNameMatch[1];
    }

    this.title = 'multiple graph';
    this.isReveal = false;
    this._disposables = [];
    const threeQuery = JSON.parse(ctx.fileUri?.query)  
    if (threeQuery.isBootStep) {
      this.swimDataPath = threeQuery.swim
      this.comPath = threeQuery.comput
    }
    this.cachePath = Util.getCachePath('threeViewFiles.json');
    this.initWebViewPanel();
  }

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
  public renderLayout = async (data, infoStr) => {
    await ComGraphHandler.renderLayout(data, infoStr, this);
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
  public getAccurancyReport = async () => {
    await ComGraphHandler.getAccurancyReport(this);
  };
  @viewApi()
  public searchAccurancySumList = async (message) => {
    await ComGraphHandler.searchAccurancySumList(this, message);
  };
  @viewApi()
  public getAccurancyDetail = async (message) => {
    await ComGraphHandler.getAccurancyDetail(this, message);
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
  public getSprottyGraphWithLevel = async (message) => {
    await ComGraphHandler.getSprottyGraphWithLevel(this, message);
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
        _path: this.initPath
      };
    }
    if (message.codePath) {
      this.codePath = message.codePath;
    }
  };
  @viewApi()
  public getSwimData = async (message) => {
    if (message.swimDataPath) {
      this.swimDataPath = message.swimDataPath;
    }
    if (!this.swimDataPath) {
      return;
    }
    const content = ((await readFirstNLines(this.swimDataPath, 10)) as string[]).join('');
    const isGoogleFormat = content.includes('traceEvents');
    if (!isGoogleFormat) {
      this.setRef('dataError', { msg: t('pypto.threeCol.notTraceFormat')});
      return;
    }
    const packages = await SwimGraphMsgHandler.getSwimData(this, true);
    if (packages) {
      return stream.Readable.toWeb(stream.Readable.from(packages));
    }
    return;
  };
  @viewApi()
  public getData = async (message) => {
    if (message.swimDataPath) {
      this.swimDataPath = message.swimDataPath;
    }
    if (!this.swimDataPath) {
      return;
    }
    const content = ((await readFirstNLines(this.swimDataPath, 10)) as string[]).join('');
    const isGoogleFormat = content.includes('traceEvents');
    if (!isGoogleFormat) {
      this.setRef('dataError', { msg: t('pypto.threeCol.notTraceFormat')});
      return;
    }
    const data = await SwimGraphMsgHandler.getData(this);
    if (Array.isArray(data)) {
      return stream.Readable.toWeb(stream.Readable.from(data!));
    }
    return data;
    return;
  };
  @viewApi()
  public getOtherData = async () => {
    return await SwimGraphMsgHandler.getOtherData(this);
  };
  @viewApi()
  public getPerformanceInfo = async () => {
    return await SwimGraphMsgHandler.getPerformanceInfo(this);
  };
  @viewApi()
  public getCompressedData = async (message) => {
    if(message.swimDataPath){
      this.swimDataPath = message.swimDataPath;
    }
    return await SwimGraphMsgHandler.getCompressedData(this);
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
  public changeUserCfgPerformance = async (message: any) => {
    await SwimGraphMsgHandler.changeUserCfgPerformance(this, message.paramObj);
  };
  @viewApi()
  public changeUserCfgIsMixMode = async (message: any) => {
    await SwimGraphMsgHandler.changeUserCfgIsMixMode(this, message.paramObj);
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
  @viewApi()
  public setSaveDir = async () => {
  };
  @viewApi()
  public checkSys = async () => {
  };
  @viewApi()
  public saveFile = async (message) => {
  };
  @viewApi()
  public checkFilePath = async (message) => {
  };
  // 初始化自动关联路径
  async initRelativePath(
    codePath: string,
    swimPath: string | undefined,
    comPath: string | undefined,
  ): Promise<{ codePath: string; swimPath: string | undefined; comPath: string | undefined; runDataTitle: string | undefined }> {
    const ret = await new Fider(codePath).findByCodePath(swimPath, comPath);
    return { codePath, ...ret };
  }

  async initWebViewPanel() {
    try {
      await this.initPaths();
      // 如果路径未初始化成功，有缺省页面
      if (!this.swimDataPath || !this.comPath) {
        const pathMsg = { swimPath: this.swimDataPath || "", comPath: this.comPath || "" };
        this.setRef('returnInitPath', { data: pathMsg });
        return ;
      }
      // 路径初始化成功
      this.setRef('InitFlag', {runDataTitle: this.headerTitle});
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    } catch (error) {
      console.log(`Error initializing WebView panel:`, error);
    }
  }
  async initPaths() {
    if (!this.swimDataPath || !this.comPath) {
      const { swimPath, comPath, runDataTitle } = await this.initRelativePath(this.codePath, this.swimDataPath, this.comPath);
      if (swimPath) {
        this.updateSwimData(swimPath);
      }
      if (comPath) {
        this.updateComData(comPath);
      }
      if (runDataTitle) {
        this.headerTitle = runDataTitle;
        await this.fetchRunDataList(this.headerTitle);
      }
    }
  }
  async fetchRunDataList(headerTitle: string) {
    const params: GetOutputRecordParams = {
      page: 1, pageSize:20, isThreeColumnNotNull: true, titleKeyword: headerTitle
    };
    try {
      const res = await getRunDataList(params);
      const firstItem = res.data[0];
      if (firstItem.swimlaneGraphFilePath) {
        this.updateSwimData(firstItem.swimlaneGraphFilePath);
      }
      if (firstItem.controlFlowFilePath) {
        this.updateComData(firstItem.controlFlowFilePath);
      }
    } catch (error) {
      console.log('Failed to fetch run data: ', error);
    }
  }
  updateSwimData(path: string) {
    this.swimDataPath = path;
    this.swimData = new SwimData(Uri.file(path), path);
  }
  updateComData(path: string) {
    this.comPath = path;
    this.query = {
      fsPath: path,
      _path: this.initPath
    };
  }
  @viewApi()
  public selectRunData = async (message: any) => {
    const { swimPath, comPath, runDataTitle } = message.runDataPaths;

    if (swimPath) {
      this.updateSwimData(swimPath);
    }
    if (comPath) {
      this.updateComData(comPath);
    }
    const pathMsg = { swimPath: swimPath || "", comPath: comPath || "" };
    if (this.swimDataPath || this.comPath) {
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    }
    this.setRef('returnSearchPath', { data: pathMsg });
    this.updateFilePathsCache('', '', runDataTitle);
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
        this.updateSwimData(swimPath);
      }
      if (comPath) {
        this.updateComData(comPath);
      }
      if (this.swimDataPath || this.comPath) {
        this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
      }
      const pathMsg = { swimPath: swimPath || "", comPath: comPath || "" };
      this.setRef('returnSearchPath', { data: pathMsg });
      this.updateFilePathsCache(this.swimDataPath, this.comPath);
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
    } else if (graphType === "computeGraph" || graphType === "comGraph") {
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
  }

  @viewApi()
  public replaceFile = async (message: any) => {
    const options = message.options;
    const { swimPath, comPath } = options;
    if (swimPath) {
      this.updateSwimData(swimPath);
    }
    if (comPath) {
      this.updateComData(comPath);
    }
    if (this.swimDataPath || this.comPath) {
      this.setRef('SetVscodeState', { comPath: this.comPath, swimDataPath: this.swimDataPath });
    }
    const pathMsg = { swimPath: swimPath || "", comPath: comPath || "" };
    this.setRef('returnSearchPath', { data: pathMsg });
    this.updateFilePathsCache(this.swimDataPath, this.comPath);
  };
  @viewApi()
  public singleSelectFile = async (message: { graphType: string }) => {
    if (!message || !message.graphType) {
      return;
    }
    const validGraphTypes = ['editor', 'swimGraph', 'comGraph'];
    if (!validGraphTypes.includes(message.graphType)) {
      return;
    }
    try {
      const { path } = await new Fider(this.codePath).selectPath(message.graphType);
      if (!path) {
        return;
      }
      switch (message.graphType) {
        case 'editor':
          await this.handleCodeGraph(path);
          const graphData = ComGraphHandler.getGrahpDataExtend(this);
          if (graphData) {
            const fullData = await graphData.getCompleteData(graphData.fsPath);
            ComGraphHandler.getSemanticObj(this, fullData);
          }
          break;
        case 'swimGraph':
          await this.handleSwimGraph(path);
          break;
        case 'comGraph':
          await this.handleComGraph(path);
          break;
      }
      this.setRef('SetVscodeState', { codePath: this.codePath, comPath: this.comPath, swimDataPath: this.swimDataPath });
    } catch (error) {
      console.log(`Error processing graphType ${message.graphType}:`, error)
    }
  };
  private async handleCodeGraph(path: string) {
    this.codePath = path;
    try {
      const code = readFileSync(path, 'utf8');
      this.setRef('PyCode', { data: { code, codePath: path } });
      this.updateFilePathsCache(this.swimDataPath, this.comPath);
    } catch (err) {
      console.error(`${path}读取 py 文件时发生错误:`, err);
    }
  };
  private async handleComGraph(path: string) {
    this.updateComData(path);
    this.setRef('returnComPath', { data: { comPath: path } });
    this.updateFilePathsCache(this.swimDataPath, this.comPath);
  }
  private async handleSwimGraph(path: string) {
    this.updateSwimData(path);
    this.setRef('returnSwimPath', { data: { swimPath: path } });
    this.updateFilePathsCache(this.swimDataPath, this.comPath);
  };
  private async updateFilePathsCache(swimPath: string | undefined, comPath: string | undefined, runDataTitle: string = '') :Promise<void> {
    try {
      const cache = (await Util.readSwim2ComGraphMap(this.cachePath)) || {};
      if (!cache[this.codePath]) {
        cache[this.codePath] = {};
      }
      if (swimPath !== undefined) {
        cache[this.codePath].swimPath = swimPath;
      }
      if (comPath !== undefined) {
        cache[this.codePath].comPath = comPath;
      }
      cache[this.codePath].runDataTitle = runDataTitle;
      await Util.writeJsonCache(this.cachePath, cache);
    } catch (error) {
      console.error(`更新${this.cachePath}文件发生错误`, error);
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
      const { entryhash } = await SingleGraphData.getEntryHash(gd.fsPath);
      server.entryHash = entryhash;
      gd.funcHash = entryhash;
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
