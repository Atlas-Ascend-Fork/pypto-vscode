import { Uri, workspace, window, Position, Selection, ViewColumn, Range, commands } from 'vscode';
import ElkConstructor from 'elkjs/lib/elk.bundled';
import { fork } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import { SQLiteCache, getMTime } from '../core/sqliteCache';
import { globalConfig } from '../config/config';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';
import { t } from 'i18next';
import { Util } from '../util';
import { graphFileHashMap } from '../common/graphFileHashMap';
import * as Extractor from '../utils/graphExtractor';
import { AbstractGraphData, SingleGraphData, DiffGraphData } from '../core/graphData';
import { basename } from 'path';
import { hismartliteEx } from '../hismarliteEx';
import { GraphView } from '../view/graphView';
import { AscppDagBuilder } from '../core/json-graph/jsonGraph';
import { getHealthReport } from '../utils/health-report';

const NODE_COUNT_LIMIT = 10000;
/* -------------------- 通用类型 -------------------- */
export interface readFileResult {
  isBigData: boolean;
}

/* -------------------- 抽象基类 -------------------- */
export abstract class BaseGraphMsgHandler {
  /* ---------- 全局 map，多面板共享 ---------- */
  public static globalCallInOutTensorMap = new Map();
  /** 允许前端调用的业务命令 */
  public static readonly WHITE_COMMANDS = new Set([
    'askLayout',
    'searchAllFunc',
    'jumpToCodeLine',
    'getHealthyReport',
    'getInitialData',
    'callInOutTensorMap',
    'getSubgraph',
    // 以后扩展再往里加
  ]);

  static async initTheme(panel: any) {
    panel.webview.postMessage({
      command: 'returnTheme',
      data: getIDETheme(),
    });
    panel.webview.postMessage({
      command: 'returnLang',
      data: getIDELang(),
    });
  }

  /* ===================================================
   * 1. 总入口：子类可重写
   * =================================================== */
  static async getInitialData(panel: any) {
    // 1. 初始化
    await this.initTheme(panel);
    await this.loadMainData(panel);

    // 2. 校验
    const gd = this.getGraphData(panel);
    if (!this.checkFuncHash(panel, gd, 'pypto.canNotGetFuncHashOnOpenGraph')) return;

    // 3. 缓存判断&读取文件数据
    this.postForReadJson(panel, 'initComGraph');
    let isBigFile = false;
    isBigFile = await this.getJsonData(gd, panel, isBigFile);

    // 4. 加载FuncHashMap
    await this.loadFuncHashMap(panel, gd);

    // 5. 同步渲染
    await this.render(panel);

    // 6. 监听前端消息
    this.onDidReceiveMessage(panel);
  }

  protected static onDidReceiveMessage(panel: any) {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log(`[GraphView Handler] business command: ${message.command} type: ${message.type}`);
        await this.CommonMessageActions(message, panel);
      },
      undefined,
      panel._disposables ?? [],
    );
  }

  static async CommonMessageActions(message: any, panel: any) {
    if (message.type === 'askLayout') {
      void this.elkLayout(message.data, panel);
    }
    if (message.type === 'getJsonGraphData') {
      // 判断是否有最终结果
      const filePath = message.data.filePath === 'after' ? panel.diffGraphData?.fsPath : panel.comGraphData.fsPath;
      let funcHash = message.data.filePath === 'after' ? panel.diffGraphData?.funcHash : panel.comGraphData.funcHash;
      let finalResult: any;
      let data: any;
      let isCached = false;
      const layout = message.data.layout;
      // 构造缓存 key
      if (BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash)) {
        funcHash = funcHash + '_hasParent';
      }
      if (layout.direction === 'DOWN') funcHash += '_down';
      if (!layout.showTensor) funcHash += '_notshowtensor';
      funcHash += message.data.filePath || '';
      if (panel.comGraphData.isUsedDB && !message.data.nodeMagic && filePath) {
        finalResult = await SQLiteCache.getInstance().comGraphFinalResultGet(filePath, funcHash);
      }
      if (finalResult) {
        data = JSON.parse(finalResult.final_result); // 如果有缓存则发送最终数据
        data['isFinial'] = true;
        isCached = true;
      } else {
        data = this.getJsonGraphData(message.data, panel);
      }
      this.postJsonGraphData(panel, message, data, isCached);
    }
    if (message.type === 'setFinalResult') {
      // 插入sql
      const filePath = message.data.filePath === 'after' ? panel.diffGraphData?.fsPath : panel.comGraphData.fsPath;
      let funcHash = message.data.filePath === 'after' ? panel.diffGraphData?.funcHash : panel.comGraphData.funcHash;
      if (!filePath) {
        return;
      }
       const layout = message.layout;
      if (BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash)) {
        funcHash = funcHash + '_hasParent';
      }
      if (layout.direction === 'DOWN') funcHash += '_down';
      if (!layout.showTensor) funcHash += '_notshowtensor';
      funcHash += message.data.filePath || '';
      const lastChangeTime = await getMTime(filePath);
      const result = JSON.stringify(message.data);
      await SQLiteCache.getInstance().comGraphFinalResultSet(filePath, funcHash, result, lastChangeTime);
    }

    if (message.type === "openDiffViewer") {
      this.openDiffViewer(panel);
    }
  }

  static getJsonGraphData(data, panel) {
    const { comGraphData, currentData, showTensorNodes, showSyncNodes, colorBySubgraph, isDark, selectedSubgraphId, nodeMagic } = data;
    const dagBuilder = new AscppDagBuilder(comGraphData, panel, this.callInOutTensorMap);

    const sprottyGraph = dagBuilder.createSprottyGraph(
      currentData,
      showTensorNodes,
      showSyncNodes,
      colorBySubgraph,
      isDark,
      selectedSubgraphId,
      nodeMagic,
    );

    return sprottyGraph;
  }

  protected static postForReadJson(panel: any, cmd: string) {
    const config = Util.getComGraphCustomCfg();
    panel.webview.postMessage({
      command: cmd,
      step: 'readJson',
      configration: config,
    });
  }

  protected static async getJsonData(graphData: AbstractGraphData, panel: any, isBigFile: boolean) {
    graphData.isUsedDB = globalConfig.IS_USE_DB;
    if (graphData.isUsedDB) {
      const hit = await SQLiteCache.getInstance().comGraphFuncDataGetCount(graphData.fsPath);
      if (hit === 0) {
        const ret = await graphData.readFileAndSetCache(graphData.fsPath, panel);
        isBigFile = ret.isBigFile;
      } else {
        console.debug('BaseGraphMsgHandler getInitialData FuncData命中缓存');
      }
    } else {
      await graphData.readFileAndSetCache(graphData.fsPath, panel);
    }
    return isBigFile;
  }

  /* ===================================================
   * 2. 抽象：子类必须实现
   * =================================================== */
  protected static async loadMainData(panel: any): Promise<void> {
    throw new Error('子类必须覆盖 loadMainData 方法');
  }

  protected static getGraphData(panel: any): AbstractGraphData {
    throw new Error(`子类必须覆盖 getGraphData 方法`);
  }

  /* ===================================================
   * 3. 公共能力：elk 布局
   * =================================================== */
  static async elkLayout(graphData: any, panel: any) {
    const elkFactory = new ElkConstructor({ algorithms: ['layered'] });

    let comGraphData;
    comGraphData = this.getElkLayoutComGraghData(panel, graphData, elkFactory);

    const layoutDirection = graphData.layoutOptions['elk.direction'];
    const showtensor = graphData.layoutOptions['PyPTO.showTensor'];
    const filePath = comGraphData?.fsPath;
    const renderMode = graphData.layoutOptions['PyPTO.renderMode'];
    let funcHash = comGraphData?.funcHash!;

    // 构造缓存 key
    if (BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash)) {
      funcHash = funcHash + '_hasParent';
    }
    if (layoutDirection === 'DOWN') funcHash += '_down';
    if (showtensor !== 'true') funcHash += '_notshowtensor';
    funcHash += graphData.layoutOptions['PyPTO.filePath'] || '';
    let lastChangeTime;
    if(filePath) {
      lastChangeTime = await getMTime(filePath);
    }
    
    let cache: any;
    if (comGraphData?.isUsedDB) {
      cache = await SQLiteCache.getInstance().comGraphLayoutGet(filePath, funcHash);
    }
    if (renderMode === 'path' || !cache) {
      const child = fork(path.join(__dirname, '../core/layoutWork.js'));
      child.send({ type: 'layout', graphData });
      child.on('message', async (res: { type: string; data?: any }) => {
        if (res.type === 'result') {
          const layoutJsonStr = JSON.stringify(res.data);
          if (comGraphData?.isUsedDB && renderMode !== 'path') {
            await SQLiteCache.getInstance().comGraphLayoutSet(filePath, funcHash, layoutJsonStr, lastChangeTime);
          }
          this.postLayoutResult(panel, layoutJsonStr, graphData.layoutOptions['PyPTO.filePath']);
          child.kill();
        }
      });
      child.on('error', (_err) => child.kill());
    } else {
      if (lastChangeTime !== cache.last_change_time) {
        await SQLiteCache.getInstance().comGraphLayoutDel(filePath);
        const result = await elkFactory.layout(graphData);
        const layoutJsonStr = JSON.stringify(result);
        await SQLiteCache.getInstance().comGraphLayoutSet(filePath, funcHash, layoutJsonStr, lastChangeTime);
        this.postLayoutResult(panel, layoutJsonStr, graphData.layoutOptions['PyPTO.filePath']);
      } else {
        this.postLayoutResult(panel, cache.layout_result, graphData.layoutOptions['PyPTO.filePath']);
      }
    }
  }

  /* ===================================================
   * 4. 公共能力
   * =================================================== */
  static async getSubgraph(
    panel: any,
    subInfo: { calleehash: string; subFuncmagicname: string; curPath: string; calleeOpMagic?: string; calleeOpSubgraphId?: string },
  ) {
    const { calleehash, subFuncmagicname, curPath, calleeOpMagic, calleeOpSubgraphId } = subInfo;
    const webviews: any = hismartliteEx.webviews;
    const comGraphData = panel.comGraphData;
    let existPanel;
    if (panel.entryHash == calleehash) {
      const title = basename(comGraphData.fsPath);
      existPanel = webviews[title];
      existPanel.reveal(existPanel.ViewColumn);
      return;
    }
    if (Object.keys(webviews).includes(subFuncmagicname)) {
      existPanel = webviews[subFuncmagicname];
      existPanel.reveal(existPanel.ViewColumn);
      return;
    }
    const { SingleGraphHandler } = await import('../handler/singleGraphHandler');

    let targetPath = comGraphData.fsPath;
    let targetCurPath = JSON.parse(curPath);
    const rootFilePath = comGraphData.fsPath;
    const extName = path.extname(rootFilePath);
    const rootBaseName = path.basename(rootFilePath, extName);
    if (rootBaseName.endsWith('ROOT')) {
      const splitIdx = rootBaseName.indexOf('_');
      const filePrefix = rootBaseName.slice(0, splitIdx);

      const fileDir =  path.dirname(rootFilePath);
      const fileList = fs.readdirSync(fileDir);
      for (let matchedFile of fileList) {
        if (matchedFile.endsWith(extName) && matchedFile.includes(calleehash) && matchedFile.startsWith(filePrefix)) {
          targetPath = path.join(fileDir, matchedFile);
          targetCurPath = targetCurPath.filter(func => func === calleehash);
          break;
        }
      }
    }
    targetCurPath = JSON.stringify(targetCurPath);
    commands.executeCommand('PyPTO.OpenRenderGraphForCurrent', Uri.file(targetPath));
  }

  static async jumpToCodeLine(_panel: any, data: any) {
    try {
      const doc = await workspace.openTextDocument(Uri.file(data.file));
      const editor = await window.showTextDocument(doc);
      const pos = new Position(data.line - 1, 0);
      editor.selection = new Selection(pos, pos);
      editor.revealRange(new Range(pos, pos));
    } catch (err: any) {
      window.showWarningMessage(`无法打开文件: ${data.file} (${err.message})`);
    }
  }

  /**
   * 全局搜索入口
   * @param panel        当前 webview 面板
   * @param criteria     来自前端的发送体
   */
  static async searchAllFunc(panel: any, criteria: any) {
    const gd = this.getGraphData(panel);
    const fsPath = gd.fsPath;
    const isUsedDB = gd.isUsedDB;

    const funcHashMap = graphFileHashMap[fsPath] as Record<string, { func_magicname: string }>;
    if (!funcHashMap) return panel.webview.postMessage({ command: 'globalSearchResult', data: {} });

    const resultMap: Record<string, any[]> = {};
    for (const [funcHash, funcMeta] of Object.entries(funcHashMap)) {
      let jsonData: any;
      if (isUsedDB) {
        const row = await SQLiteCache.getInstance().comGraphFuncDataGet(fsPath, funcHash);
        if (!row) continue;
        const raw = row.big_data_file_path ? await SQLiteCache.getInstance().readJsonFile(row.big_data_file_path) : row.data;
        jsonData = JSON.parse(raw);
      } else {
        const raw = gd.dataMap[funcHash]; // 内存模式
        if (!raw) continue;
        jsonData = JSON.parse(raw);
      }

      const incasts = Extractor.extractIncasts(jsonData);
      const outcasts = Extractor.extractOutcasts(jsonData);
      const rawTensorMap = Extractor.extractRawTensors(jsonData);
      const tensorMap = Extractor.extractTensorNodes(jsonData, incasts, outcasts, rawTensorMap);
      const opMap = Extractor.extractOperationNodes(jsonData);
      const funcMap = Extractor.extractFuncMap(funcHashMap);

      const hits = Extractor.searchFunc(criteria, tensorMap, opMap, rawTensorMap, funcMap);
      if (hits.length) resultMap[funcHash] = hits;

      if (criteria.category === 'Function') break;
    }

    /* 把“函数级”模糊结果也合并进来 */
    if (!criteria.category) {
      const funcHits = Extractor.searchFunc({ ...criteria, category: 'Function' }, {}, {}, {}, Extractor.extractFuncMap(funcHashMap));
      if (funcHits.length) resultMap['totalFunction'] = funcHits;
    }

    panel.webview.postMessage({ command: 'globalSearchResult', data: resultMap });
  }

  static async getHealthyReport(panel: any) {
    const graphData = panel.comGraphData;
    const reports = await getHealthReport(graphData.fsPath);
    panel.webview.postMessage({ command: 'returnHealthyReport', data: reports });
  }

  /* ===================================================
   * 5. 公共方法：
   * =================================================== */
  protected static async fetchGraphJson(
    gd: AbstractGraphData,
    panel: any,
  ): Promise<{
    json: any;
    io?: any;
  }> {
    if (!gd) return { json: undefined };
    let ret: string | null = null;

    /* 1️⃣ 数据库模式：带延迟重试 */
    if (gd.isUsedDB) {
      const maxRetry = 5;
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

      for (let i = 0; i < maxRetry; i++) {
        const row = await SQLiteCache.getInstance().comGraphFuncDataGet(gd.fsPath, gd.funcHash!);
        ret = row?.big_data_file_path
          ? await SQLiteCache.getInstance().readJsonFile(row.big_data_file_path)
          : row?.data ?? null;

        if (ret) {console.debug(`fetchGraphJson comGraphFuncDataGet 拿到数据`); break;}
        console.debug(`fetchGraphJson comGraphFuncDataGet 未拿到数据 重试第${i+1}次`);
        await delay(100);      
      }
    } else {
      /* 2️⃣ 内存模式：一次拿完 */
      ret = gd.dataMap[gd.funcHash!] ?? null;
    }
    
    if (!ret) {
      this.returnError(panel, 'pypto.parseDataErrorOnOpenComGraph');
      return { json: undefined };
    }

    const json = JSON.parse(ret);
    await this.returnCalleeMap(gd, panel, json);
    const io = BaseGraphMsgHandler.globalCallInOutTensorMap.get(gd.funcHash!);

    return { json, io };
  }

  private static searchSubFunc(funcHash: string, filePrefix: string, dirName: string, 
                                tempCalleemap: Record<string, { functype: string, func_magicname: string }>) : Record<string, { functype: string, func_magicname: string }> {
    const fileList = fs.readdirSync(dirName);
    const matchedFiles = fileList.filter(
      f => 
        f.endsWith('.json') && f.includes(funcHash) && f.startsWith(filePrefix)
    );

    for (const matchedFile of matchedFiles) {
      const targetPath = path.join(dirName, matchedFile);
      const targetFile = fs.readFileSync(targetPath, 'utf8');
      const targetJson = JSON.parse(targetFile);
      const targetFunctype = targetJson.functions?.[0]?.functype;
      const targetFuncMagicname = targetJson.functions?.[0]?.func_magicname;
      tempCalleemap[funcHash] = {functype: targetFunctype, func_magicname: targetFuncMagicname};
    }
    return tempCalleemap;
  }

  private static subGraphFileSearch(fileJson: any, gd: AbstractGraphData, calleeMap: any) : Record<string, { functype: string, func_magicname: string }> {
    const filePath = gd.fsPath;
    const extName = path.extname(filePath);
    const baseName = path.basename(filePath, extName);
    const dirName = path.dirname(filePath);
    const splitIdx = baseName.indexOf('_');
    const filePrefix = baseName.slice(0, splitIdx);
    const isRoot: boolean = baseName.endsWith('ROOT');
    const tempCalleemap: Record<string, { functype: string, func_magicname: string }> = {};
    if(!isRoot) {
      return calleeMap;
    } else {
      Object.assign(tempCalleemap, calleeMap);
      for (let subFunc of fileJson.operations) {
        const funcHash = subFunc.calleehash;
        this.searchSubFunc(funcHash, filePrefix, dirName, tempCalleemap);
      }
    }
    return tempCalleemap;
  }

  private static async returnCalleeMap(gd: AbstractGraphData, panel: any, filejson: any) {
    let calleeMap = gd.isUsedDB
      ? JSON.parse(await SQLiteCache.getInstance().comGraphFileHashMapGet(gd.fsPath))
      : graphFileHashMap[gd.fsPath];
    calleeMap = this.subGraphFileSearch(filejson, gd, calleeMap);
    graphFileHashMap[gd.fsPath] = calleeMap;
    panel.webview.postMessage({ command: 'returnCalleeMap', data: graphFileHashMap[gd.fsPath] || {} });
    return calleeMap;
  }

  protected static async postRenderJson(panel: any, json: any, cmd: 'returnCom' | 'returnDiffCom' = 'returnCom'): Promise<void> {
    if (cmd == 'returnCom') {
      const nodeCount = json.operations.length + json.rawtensors.length + json.tensors.length;
      if (nodeCount > NODE_COUNT_LIMIT) {
        panel.webview.postMessage({ command: 'readJsonWarning' });
      }
      /** Pass目录名称正则 */
      const passDirectoryRegExp = /Pass_(\d+)_(\w+)/;
      const [_, passIndex, __] = panel.fsPath?.match(passDirectoryRegExp) ?? [];
      panel.webview.postMessage({
        command: cmd,
        step: 'convertData',
        data: json,
        outputDirPath: panel.outputDirPath,
        passIndex,
        pathName: panel.pathName,
        fileName: basename(panel.fsPath || panel.comPath)
      });
    } else if (cmd == 'returnDiffCom') {
      panel.webview.postMessage({
        command: cmd,
        step: 'convertData',
        diffInfo: json,
      });
    }
  }

  protected static async loadFuncHashMap(panel: any, gd: AbstractGraphData) {
    gd.isUsedDB = globalConfig.IS_USE_DB;

    if (!graphFileHashMap[gd.fsPath] && gd.funcHashMap && Object.keys(gd.funcHashMap).length > 0) {
      graphFileHashMap[gd.fsPath] = gd.funcHashMap;
    } else {
      graphFileHashMap[gd.fsPath] = JSON.parse(await SQLiteCache.getInstance().comGraphFileHashMapGet(gd.fsPath));
    }
    if (!gd.funcHash) {
      gd.funcHash = panel.entryHash;
    }
  }

  static async openDiffViewer(panel: any) {
    const { DiffGraphHandler } = await import('../handler/diffGraphHandler');
    new GraphView(
      { viewType: 'itemDetailView', title: 'Computation Graph Diff', column: ViewColumn.One },
      DiffGraphData,
      DiffGraphHandler,
    ).createPanel(panel.comGraphData.fsPath, panel.comGraphData?.funcHash);
  }

  protected static async postInitMessages(panel: any, gd: AbstractGraphData, json: any, isDiff: boolean): Promise<void> {
    /* 主题/语言  保证 前端初始状态 与当前主题一致，避免首帧闪白 */
    panel.webview.postMessage({ command: 'returnTheme', data: getIDETheme() });
    panel.webview.postMessage({ command: 'returnLang', data: getIDELang() });
    /* 设置state 让 VS Code 下次能反序列化 */
    panel.webview.postMessage({ command: 'returnInitData', fsPath: gd.fsPath, funcHash: gd.funcHash, magicName: json.func_magicname });

  }

  protected static checkFuncHash(panel: any, gd: AbstractGraphData, cmd: string): boolean {
    if (gd && !gd.funcHash) {
      this.returnError(panel, cmd);
      return false;
    }
    return true;
  }
  protected static returnError(panel: any, cmd: string) {
    panel.webview.postMessage({
      command: 'returnError',
      data: t(cmd),
    });
  }

  /** 前端一次性把整图的张量输入输出关系推过来 */
  static callInOutTensorMap(data: any) {
    const map = new Map(Object.entries(data));
    for (const [k, v] of map) {
      BaseGraphMsgHandler.globalCallInOutTensorMap.set(k, v);
    }
  }

  protected static async generateFucTree(hash: string, gd: AbstractGraphData): Promise<any> {
    const subHashes = await this.getSubHash(hash, gd); // 沿用原实现
    const node: any = {};
    if (!Array.isArray(subHashes)) return node;
    for (const h of subHashes) {
      node[h] = await this.generateFucTree(h, gd);
    }
    return node;
  }

  protected static async getSubHash(curHash, comGraphData) {
    let comGraphFuncData: any;
    let resStr = '';
    if (comGraphData.isUsedDB) {
      comGraphFuncData = await SQLiteCache.getInstance().comGraphFuncDataGet(comGraphData.fsPath, curHash);
      resStr = comGraphFuncData?.call_hash_arr;
    } else {
      resStr = comGraphData.callHashArrMap[curHash];
    }

    if (resStr == '') {
      return [];
    }
    return resStr?.split(',');
  }
  /* ===================================================
   * 6. 子类会重写的方法：
   * =================================================== */
  protected static async render(panel: any) {
    const gd = this.getGraphData(panel);
    // 1. 取数据
    const { json, io } = await this.fetchGraphJson(gd, panel);
    if (!json) {
      this.returnError(panel, 'pypto.parseDataErrorOnOpenComGraph');
      return;
    }
    // 挂 inouttensors
    if (io) json.inouttensors = io;
    // 2. 发送初始化消息
    await this.postInitMessages(panel, gd, json, false);

    // 3. 发图包
    await this.postRenderJson(panel, json, 'returnCom');
  }

  // filePath 给子类重写预留
  protected static postLayoutResult(panel: any, jsonStr: string, filePath?: string) {
    panel.webview.postMessage({
      type: 'postLayoutResult',
      data: JSON.parse(jsonStr),
    });
  }

  static postJsonGraphData(panel: any, message: any, data: any, isCached: boolean) {
    panel.webview.postMessage({
      type: 'postJsonGraphData',
      data,
      isCached,
    });
  }

  // graphData elkFactory 给子类重写预留
  static getElkLayoutComGraghData(panel: any, graphData: any, elkFactory: any) {
    return panel.comGraphData;
  }
}
