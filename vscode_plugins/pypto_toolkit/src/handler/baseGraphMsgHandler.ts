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
import { basename, join } from 'path';
import { hismartliteEx } from '../hismarliteEx';
import { GraphView } from '../view/graphView';
import { AscppDagBuilder } from '../core/json-graph/jsonGraph';
import { getHealthReport } from '../utils/health-report';
import * as vscode from 'vscode';

enum RequestSourceType {
  NodeOverLimit = 1,
  SearchNoMagic = 2,
  SearchMagic = 3,
}

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
    'innerGetSubgraph',
    // 以后扩展再往里加
  ]);

  static async initTheme(server: any) {
    server.setRef('IDELang', { data: getIDELang() });
  }

  /* ===================================================
   * 1. 总入口：子类可重写
   * =================================================== */
  static async getInitialData(server: any) {
    // 1. 初始化
    await this.initTheme(server);
    const result = await this.loadMainData(server);
    if (!result) return;
    // 2. 校验
    const gd = this.getGraphData(server);
    if (!this.checkFuncHash(server, gd, 'pypto.comGraph.errorMessage.canNotGetFuncHashOnOpenOriginGraph')) return;

    // 3. 缓存判断&读取文件数据
    this.postForReadJson(server, 'InitComGraph');
    const jsonDataResult = await this.getJsonData(gd, server);
    if (!jsonDataResult) return;
    // 4. 加载FuncHashMap
    await this.loadFuncHashMap(server, gd);

    // 5. 同步渲染
    await this.render(server);
  }

  static async setFinalResult(message: any, server: any) {
    const filePath = message.data.filePath === 'after' ? server.diffGraphData?.fsPath : server.comGraphData.fsPath;
    let funcHash = message.data.filePath === 'after' ? server.diffGraphData?.funcHash : server.comGraphData.funcHash;
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
    if (message.threeMode) {
      funcHash = funcHash + '_threeMode';
    }
    const lastChangeTime = await getMTime(filePath);
    const result = JSON.stringify(message.data);
    await SQLiteCache.getInstance().comGraphFinalResultSet(filePath, funcHash, result, lastChangeTime);
  }

  static async getJsonGraphData(message: any, server: any) {
    const filePath = message.data.filePath === 'after' ? server.diffGraphData?.fsPath : server.comGraphData.fsPath;
    let funcHash = message.data.filePath === 'after' ? server.diffGraphData?.funcHash : server.comGraphData.funcHash;
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
    if (message.data.threeMode) {
      funcHash = funcHash + '_threeMode';
    }
    if (server.comGraphData.isUsedDB && !message.data.nodeMagic && filePath) {
      finalResult = await SQLiteCache.getInstance().comGraphFinalResultGet(filePath, funcHash);
    }
    if (finalResult) {
      data = JSON.parse(finalResult.final_result); // 如果有缓存则发送最终数据
      data['isFinial'] = true;
      isCached = true;
    } else {
      data = this.createJsonGraphData(message.data, server);
    }
    this.postJsonGraphData(server, message, data, isCached);
  }

  static createJsonGraphData(data, server) {
    const { comGraphData, currentData, showTensorNodes, showSyncNodes, colorBySubgraph, isDark, selectedSubgraphId, nodeMagic, version, threeMode } = data;
    const dagBuilder = new AscppDagBuilder(comGraphData, server, version, this.callInOutTensorMap);

    const sprottyGraph = dagBuilder.createSprottyGraph(
      currentData,
      showTensorNodes,
      showSyncNodes,
      colorBySubgraph,
      isDark,
      selectedSubgraphId,
      nodeMagic,
      threeMode,
    );

    return sprottyGraph;
  }

  protected static postForReadJson(server: any, cmd: string) {
    server.setRef(cmd, { step: 'readJson' });
  }

  protected static async getJsonData(gd: AbstractGraphData, server: any) {
    gd.isUsedDB = globalConfig.IS_USE_DB;
    try {
      if (gd.isUsedDB) {
        const hit = await SQLiteCache.getInstance().comGraphFuncDataGetCount(gd.fsPath);
        if (hit === 0) {
          await gd.readFileAndSetCache(gd.fsPath);
        } else {
          console.debug('BaseGraphMsgHandler getInitialData FuncData命中缓存');
        }
      } else {
        await gd.readFileAndSetCache(gd.fsPath);
      }
    } catch (err: any) {
      if (err.code === 'FILE_READ_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.fileRead'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' });
        return;
      } else if (err.code === 'JSON_PARSE_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.jsonParse'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' })
        return;
      } else {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.readJsonUnknown'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' })
        return;
      }
    }
    return true;
  }


  static async openSearchMode(message: any, server: any) {
    const nodeMagic: number = message.data?.nodeMagic;
    const funcHash = message.data?.funcHash;
    const gd = server.comGraphData;
    commands.executeCommand('PyPTO.OpenComGraphForNodeSearch', Uri.file(gd.fsPath), funcHash, nodeMagic);
  }

  /* ===================================================
   * 2. 抽象：子类必须实现
   * =================================================== */
  protected static async loadMainData(server: any): Promise<boolean> {
    throw new Error('子类必须覆盖 loadMainData 方法');
  }

  protected static getGraphData(server: any): AbstractGraphData {
    throw new Error(`子类必须覆盖 getGraphData 方法`);
  }


  static async layoutByLocal(server: any, gd:any, lastChangeTime: string, funcHash: string) {
    const renderMode = gd.layoutOptions['PyPTO.renderMode'];
    const comGraphData = this.getElkLayoutComGraghData(server, gd);
    const filePath = comGraphData?.fsPath;
    const child = fork(path.join(__dirname, '../core/layoutWork.js'));
    child.send({ type: 'layout', graphData: gd });
    child.on('message', async (res: { type: string; message?: any, data?: any }) => {
      if (res.type === 'result') {
        const layoutJsonStr = JSON.stringify(res.data);
        if (comGraphData?.isUsedDB && renderMode !== 'path') {
          await SQLiteCache.getInstance().comGraphLayoutSet(filePath, funcHash, layoutJsonStr, lastChangeTime);
        }
        this.postLayoutResult(server, layoutJsonStr, gd.layoutOptions['PyPTO.filePath']);
        child.kill();
      }
      if (res.type === 'error') {
        this.returnError(server, 'pypto.comGraph.errorMessage.layout', {}, 'pypto.comGraph.errorLogMessage.error', { logText: res.data });
        return;
      }
    });
    // 添加对子进程异常的监听
    child.on('error', (err) => {
      console.error('子进程发生错误:', err);
      child.kill();
    });

    // 监听子进程退出事件
    child.on('exit', () => { });
  }

  /* ===================================================
   * 3. 公共能力：elk 布局
   * =================================================== */
  static async elkLayout(gd: any, server: any) {
    const elkFactory = new ElkConstructor({ algorithms: ['layered'] });
    const comGraphData = this.getElkLayoutComGraghData(server, gd, elkFactory);
    const layoutDirection = gd.layoutOptions['elk.direction'];
    const showtensor = gd.layoutOptions['PyPTO.showTensor'];
    const filePath = comGraphData?.fsPath;
    const renderMode = gd.layoutOptions['PyPTO.renderMode'];
    let funcHash = comGraphData?.funcHash!;

    // 构造缓存 key
    if (BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash)) {
      funcHash = funcHash + '_hasParent';
    }
    if (layoutDirection === 'DOWN') funcHash += '_down';
    if (showtensor !== 'true') funcHash += '_notshowtensor';
    funcHash += gd.layoutOptions['PyPTO.filePath'] || '';
    let lastChangeTime;
    if (filePath) {
      lastChangeTime = await getMTime(filePath);
    }

    let cache: any;
    if (comGraphData?.isUsedDB) {
      cache = await SQLiteCache.getInstance().comGraphLayoutGet(filePath, funcHash);
    }
    if (renderMode === 'path' || !cache || lastChangeTime !== cache.last_change_time) {
      if (vscode.extensions.getExtension('undefined_publisher.elk-java-layout-ext')) {
        vscode.commands.executeCommand('PyPTO.elkLayout', `${comGraphData.fsPath}_${server.query.funcHash || ''}_${server.query.nodeMagic || ''}`, JSON.stringify(gd), 'PyPto.postLayoutData')
      } else {
        this.layoutByLocal(server, gd, lastChangeTime, funcHash);
      }
    } else {
      this.postLayoutResult(server, cache.layout_result, gd.layoutOptions['PyPTO.filePath']);
    }
  }

  static async renderLayout(layoutJsonStr: string, server: any) {
    const gd = JSON.parse(layoutJsonStr);
    const comGraphData = this.getElkLayoutComGraghData(server, gd);
    const renderMode = gd.layoutOptions['PyPTO.renderMode'];
    const filePath = comGraphData?.fsPath;
    const layoutDirection = gd.layoutOptions['elk.direction'];
    const showtensor = gd.layoutOptions['PyPTO.showTensor'];
    let funcHash = comGraphData?.funcHash!;
    const lastChangeTime = await getMTime(filePath);
    // 构造缓存 key
    if (BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash)) {
      funcHash = funcHash + '_hasParent';
    }
    if (layoutDirection === 'DOWN') funcHash += '_down';
    if (showtensor !== 'true') funcHash += '_notshowtensor';
    funcHash += gd.layoutOptions['PyPTO.filePath'] || '';
    this.postLayoutResult(server, layoutJsonStr, gd.layoutOptions['PyPTO.filePath']);
    if (comGraphData?.isUsedDB && renderMode !== 'path') {
      await SQLiteCache.getInstance().comGraphLayoutSet(filePath, funcHash, layoutJsonStr, lastChangeTime);
    }
  }

  /* ===================================================
   * 4. 公共能力
   * =================================================== */
  static async getSubgraph(
    server: any,
    subInfo: { calleehash: string; subFuncmagicname: string; curPath: string; calleeOpMagic?: string; calleeOpSubgraphId?: string },
    query: any,
  ) {
    let { calleehash, subFuncmagicname, curPath, calleeOpMagic, calleeOpSubgraphId } = subInfo;
    const webviews: any = hismartliteEx.webviews;
    const gd = server.comGraphData;
    let existPanel;
    if (server.entryHash == gd.calleehash) {
      const title = basename(gd.fsPath);
      existPanel = webviews[title];
      existPanel.reveal(existPanel.ViewColumn);
      return;
    }
    if (Object.keys(webviews).includes(gd.subFuncmagicname)) {
      existPanel = webviews[gd.subFuncmagicname];
      existPanel.reveal(existPanel.ViewColumn);
      return;
    }

    let targetPath = gd.fsPath;
    let targetCurPath = JSON.parse(curPath);
    const rootFilePath = gd.fsPath;
    const extName = path.extname(rootFilePath);
    const rootBaseName = path.basename(rootFilePath, extName);
    if (rootBaseName.endsWith('ROOT')) {
      const splitIdx = rootBaseName.indexOf('_');
      const filePrefix = rootBaseName.slice(0, splitIdx);
      const fileDir = path.dirname(rootFilePath);
      const fileList = fs.readdirSync(fileDir);
      for (let matchedFile of fileList) {
        if (matchedFile.endsWith(extName) && matchedFile.includes(calleehash) && matchedFile.startsWith(filePrefix)) {
          targetPath = path.join(fileDir, matchedFile);
          targetCurPath = targetCurPath.filter((func) => func === calleehash);
          break;
        }
      }
      targetCurPath = JSON.stringify(targetCurPath);
      commands.executeCommand('PyPTO.OpenRenderGraphForCurrent', Uri.file(targetPath), subFuncmagicname);
    } else {
      const { useView } = await import('../view');
      const { editorView } = useView();
      // 统一处理 query 输入
      const oldQuery = typeof query === 'string' ? JSON.parse(query) : query ?? {};

      // 初始化 parentInfo：优先使用已有，否则新建 level=0
      let parentInfo = oldQuery.parentInfo
        ? { ...oldQuery.parentInfo }
        : { level: 0 };

      // 处理非根节点图的 parentInfo 补全（仅当有 calleeOpMagic + calleeOpSubgraphId）
      if (oldQuery.calleeOpMagic && oldQuery.calleeOpSubgraphId) {
        parentInfo.calleeOpMagic = oldQuery.calleeOpMagic;
        parentInfo.calleeOpSubgraphId = oldQuery.calleeOpSubgraphId;
      }

      // 判断是否为“返回上一级”操作：calleeOpMagic/calleeOpSubgraphId 未传入
      const isGoBack = !calleeOpMagic && !calleeOpSubgraphId;

      if (isGoBack) {
        // 返回上一级：使用 parentInfo 中的信息，并减少 level
        calleeOpMagic = parentInfo.calleeOpMagic;
        calleeOpSubgraphId = parentInfo.calleeOpSubgraphId;
        parentInfo.level -= 1;

        // 如果回到第一级（level=1），清空 calleeOp 信息
        if (parentInfo.level === 1) {
          delete parentInfo.calleeOpMagic;
          delete parentInfo.calleeOpSubgraphId;
        }
      } else {
        // 进入下一级：增加 level
        parentInfo.level += 1;
      }

      // 构造最终 query
      const finalQuery = {
        ...oldQuery,
        funcHash: server.entryHash === calleehash ? undefined : calleehash,
        subFuncmagicname: server.entryHash === calleehash ? undefined : subFuncmagicname,
        curPath: server.entryHash === calleehash ? undefined : curPath,
        calleeOpMagic: server.entryHash === calleehash ? undefined : calleeOpMagic,
        calleeOpSubgraphId: server.entryHash === calleehash ? undefined : calleeOpSubgraphId,
        isSearch: server.entryHash === calleehash ? undefined : oldQuery.isSearch,
        parentInfo: server.entryHash === calleehash ? undefined : parentInfo,
      };

      editorView.open('computeGraph', vscode.Uri.file(gd.fsPath), { query: finalQuery, title: subFuncmagicname });

    }
  }

  static async loadEntryFunction(filePath: string, server: any): Promise<void> {
    try {
      const text = await SQLiteCache.getInstance().readJsonFile(filePath);

      const json = JSON.parse(text) as {
        functions: Array<{ hash: string }>;
        entryhash: string;
      };

      const entryFunc = json.functions.find(f => f.hash === json.entryhash);
      if (!entryFunc) {
        throw new Error(`Entry function(${json.entryhash}) not found`);
      }
      server.setRef('JsonContent', { data: entryFunc });
    } catch (err) {
      console.error('[loadEntryFunction] failed, path=', filePath, err);
      throw err;
    }
  }

  static async innerGetSubgraph(server: any, data: any) {
    const gd = this.getGraphData(server);
    const isCalleeHash = /^\d+$/.test(data.calleehash);
    gd.funcHash = data.calleehash;

    let ret: string | null = null;
    if (!isCalleeHash) {
      await this.loadEntryFunction(data.calleehash, server);
      return;
    } else {
      if (gd.isUsedDB) {
        const maxRetry = 5;
        const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

        for (let i = 0; i < maxRetry; i++) {
          const row = await SQLiteCache.getInstance().comGraphFuncDataGet(gd.fsPath, gd.funcHash!);
          ret = row?.big_data_file_path ? await SQLiteCache.getInstance().readJsonFile(row.big_data_file_path) : row?.data ?? null;

          if (ret) {
            break;
          }
          await delay(100);  // 未拿到数据 重试
        }
      } else {
        /* 2️⃣ 内存模式：一次拿完 */
        ret = gd.dataMap[gd.funcHash!] ?? null;
      }
    }
    if (!ret) {
      this.returnError(server, 'pypto.comGraph.errorMessage.parseDataErrorOnOpenComGraph', {}, 'pypto.comGraph.errorLogMessage.funcHash', { funcHash: gd.funcHash ? gd.funcHash : 'not found', message: '' });
      return { json: undefined };
    }
    const json = JSON.parse(ret);
    server.setRef('JsonContent', { data: json });
  }

  static async jumpToCodeLine(data: any) {
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
   * @param server        当前 webview 面板
   * @param criteria     来自前端的发送体
   */
  static async searchAllFunc(server: any, criteria: any) {
    const gd = this.getGraphData(server);
    const fsPath = gd.fsPath;
    const isUsedDB = gd.isUsedDB;

    const funcHashMap = graphFileHashMap[fsPath] as Record<string, { func_magicname: string }>;
    if (!funcHashMap) {
      server.setRef('GlobalSearchResult', { data: {} });
      return;
    }
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
    server.setRef('GlobalSearchResult', { data: resultMap });
  }

  static async getHealthyReport(server: any) {
    const graphData = server.comGraphData;
    const reports = await getHealthReport(graphData.fsPath);
    server.setRef('HealthyReport', { data: reports });
  }

  /* ===================================================
   * 5. 公共方法：
   * =================================================== */
  protected static async fetchGraphJson(
    gd: AbstractGraphData,
    server: any,
  ): Promise<{
    json: any;
    io?: any;
  }> {
    if (!gd) return { json: undefined };
    let ret: string | null = null;

    /* 1️⃣ 数据库模式：带延迟重试 */
    if (gd.isUsedDB) {
      const maxRetry = 5;
      const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

      for (let i = 0; i < maxRetry; i++) {
        const row = await SQLiteCache.getInstance().comGraphFuncDataGet(gd.fsPath, gd.funcHash!);
        ret = row?.big_data_file_path ? await SQLiteCache.getInstance().readJsonFile(row.big_data_file_path) : row?.data ?? null;

        if (ret) {
          break;
        }
        console.debug(`fetchGraphJson comGraphFuncDataGet 未拿到数据 重试第${i + 1}次`);
        await delay(100);
      }
    } else {
      /* 2️⃣ 内存模式：一次拿完 */
      ret = gd.dataMap[gd.funcHash!] ?? null;
    }

    if (!ret) {
      if (gd.isUsedDB) {
        this.returnError(server, 'pypto.comGraph.errorMessage.dbQueryError', {}, 'pypto.comGraph.errorLogMessage.funcHash', { funcHash: gd.funcHash ? gd.funcHash : 'not found', message: '' });
      } else {
        this.returnError(server, 'pypto.comGraph.errorMessage.parseDataErrorOnOpenComGraph', {}, 'pypto.comGraph.errorLogMessage.funcHash', { funcHash: gd.funcHash ? gd.funcHash : 'not found', message: '' });
      }
      return { json: undefined };
    }

    const json = JSON.parse(ret);
    await this.returnCalleeMap(gd, server, json);
    const io = BaseGraphMsgHandler.globalCallInOutTensorMap.get(gd.funcHash!);

    return { json, io };
  }

  private static searchSubFunc(
    funcHash: string,
    filePrefix: string,
    dirName: string,
    tempCalleemap: Record<string, { functype: string; func_magicname: string }>,
  ): Record<string, { functype: string; func_magicname: string }> {
    const fileList = fs.readdirSync(dirName);
    const matchedFiles = fileList.filter((f) => f.endsWith('.json') && f.includes(funcHash) && f.startsWith(filePrefix));

    for (const matchedFile of matchedFiles) {
      const targetPath = path.join(dirName, matchedFile);
      const targetFile = fs.readFileSync(targetPath, 'utf8');
      const targetJson = JSON.parse(targetFile);
      const targetFunctype = targetJson.functions?.[0]?.functype;
      const targetFuncMagicname = targetJson.functions?.[0]?.func_magicname;
      tempCalleemap[funcHash] = { functype: targetFunctype, func_magicname: targetFuncMagicname };
    }
    return tempCalleemap;
  }

  private static subGraphFileSearch(
    fileJson: any,
    gd: AbstractGraphData,
    calleeMap: any,
  ): Record<string, { functype: string; func_magicname: string }> {
    const filePath = gd.fsPath;
    const extName = path.extname(filePath);
    const baseName = path.basename(filePath, extName);
    const dirName = path.dirname(filePath);
    const splitIdx = baseName.indexOf('_');
    const filePrefix = baseName.slice(0, splitIdx);
    const isRoot: boolean = baseName.endsWith('ROOT');
    const tempCalleemap: Record<string, { functype: string; func_magicname: string }> = {};
    if (!isRoot) {
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

  private static async returnCalleeMap(gd: AbstractGraphData, server: any, filejson: any) {
    let calleeMap = gd.isUsedDB
      ? JSON.parse(await SQLiteCache.getInstance().comGraphFileHashMapGet(gd.fsPath))
      : graphFileHashMap[gd.fsPath];
    calleeMap = this.subGraphFileSearch(filejson, gd, calleeMap);
    graphFileHashMap[gd.fsPath] = calleeMap;
    server.setRef('CalleeMap', { data: graphFileHashMap[gd.fsPath] || {} });
    return calleeMap;
  }

  protected static async postRenderJson(server: any, json: any, cmd: 'returnCom' | 'returnDiffCom' = 'returnCom'): Promise<void> {
    if (cmd == 'returnCom') {
      const nodeCount = json.operations.length + json.rawtensors.length + json.tensors.length;
      const isNodeSearch = server.query?.isSearch === true;
      const nodesMagic = server.query?.nodeMagic;
      if (nodeCount > NODE_COUNT_LIMIT || isNodeSearch || nodesMagic != null) {
        const mode = isNodeSearch
          ? (nodesMagic === -1 ? RequestSourceType.SearchNoMagic : RequestSourceType.SearchMagic)
          : RequestSourceType.NodeOverLimit;

        server.setRef('PathOriginMode', { data: mode, nodeMagic: nodesMagic });
      }
      server.query.isSearch = false;
      server.query.nodeMagic = undefined;
      /** Pass目录名称正则 */
      const passDirectoryRegExp = /Pass_(\d+)_(\w+)/;
      const [_, passIndex, __] = server.comGraphData.fsPath?.match(passDirectoryRegExp) ?? [];
      server.setRef('ComData', {
        data: json,
        step: 'convertData',
        outputDirPath: server.comGraphData.outputDirPath,
        passIndex,
        pathName: server.comGraphData.pathName,
        fileName: basename(server.comGraphData.fsPath || server.comGraphData.comPath),
        version: server.comGraphData.version,
      });
    } else if (cmd == 'returnDiffCom') {
      server.setRef('DiffComData', { step: 'convertData', diffInfo: json });
    }
  }

  protected static async loadFuncHashMap(server: any, gd: AbstractGraphData) {
    gd.isUsedDB = globalConfig.IS_USE_DB;

    if (!graphFileHashMap[gd.fsPath] && gd.funcHashMap && Object.keys(gd.funcHashMap).length > 0) {
      graphFileHashMap[gd.fsPath] = gd.funcHashMap;
    } else {
      graphFileHashMap[gd.fsPath] = JSON.parse(await SQLiteCache.getInstance().comGraphFileHashMapGet(gd.fsPath));
    }
  }

  static async openDiffViewer(server: any, query: any) {
    const { useView } = await import('../view');
    const { editorView } = useView();
    const oldQuery = typeof query === 'string' ? JSON.parse(query) : query ?? {};
    const finalQuery = {
      ...oldQuery,
      funcHash: server.comGraphData?.funcHash,
    };
    editorView.open('diffGraph', vscode.Uri.file(server.comGraphData.fsPath), { query: finalQuery });
  }

  protected static async postInitMessages(server: any, gd: AbstractGraphData, json: any, isDiff: boolean): Promise<void> {
    /* 主题/语言  保证 前端初始状态 与当前主题一致，避免首帧闪白 */
    this.initTheme(server);
  }

  protected static checkFuncHash(server: any, gd: AbstractGraphData, cmd: string): boolean {
    if (gd && !gd.funcHash) {
      this.returnError(server, cmd, {}, 'pypto.comGraph.errorLogMessage.funcHash', { funcHash: 'not found', message: '' });
      return false;
    }
    return true;
  }
  public static returnError(server: any, cmd: string, cmdArgs?: Record<string, any>, logCmd?: string, logCmdArgs?: Record<string, any>) {
    const data = cmdArgs ? t(cmd, cmdArgs) : t(cmd);
    const log = logCmd ? (logCmdArgs ? t(logCmd, logCmdArgs) : t(logCmd)) : null;
    server.setRef('ErrorMessage', { data: data, log: log });
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
  protected static async render(server: any) {
    const gd = this.getGraphData(server);
    // 1. 取数据
    const { json, io } = await this.fetchGraphJson(gd, server);
    if (!json) return;
    // 挂 inouttensors
    if (io) json.inouttensors = io;
    // 2. 发送初始化消息
    await this.postInitMessages(server, gd, json, false);

    // 3. 发图包
    await this.postRenderJson(server, json, 'returnCom');
  }

  // filePath 给子类重写预留
  protected static postLayoutResult(server: any, jsonStr: string, filePath?: string) {
    server.setRef('LayoutResult', { data: JSON.parse(jsonStr) });
  }

  static postJsonGraphData(server: any, message: any, data: any, isCached: boolean) {
    server.setRef('JsonGraphData', { data, isCached });
  }

  // graphData elkFactory 给子类重写预留
  static getElkLayoutComGraghData(server: any, graphData: any, elkFactory?: any) {
    return server.comGraphData;
  }
}
