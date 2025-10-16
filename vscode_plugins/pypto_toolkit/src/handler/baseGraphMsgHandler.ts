// src/handler/baseGraphMsgHandler.ts
import { Uri, workspace, window, Position, Selection, ViewColumn, Range } from 'vscode';
import ElkConstructor from 'elkjs/lib/elk.bundled';
import { createReadStream, existsSync } from 'fs';
import { parser } from 'stream-json';
import { streamValues } from 'stream-json/streamers/StreamValues';
import { fork } from 'child_process';
import path from 'path';
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

const NODE_COUNT_LIMIT = 10000;
/* -------------------- 通用类型 -------------------- */
export interface readFileResult {
  isBigData: boolean;
}

/* -------------------- 抽象基类 -------------------- */
export abstract class BaseGraphMsgHandler {
  /* ---------- 全局 map，多面板共享 ---------- */
  public static readonly globalCallInOutTensorMap = new Map<string, any>();
  /** 允许前端调用的业务命令 */
  public static readonly WHITE_COMMANDS = new Set([
    'askLayout',
    'searchAllFunc',
    'jumpToCodeLine',
    'getHealthyReport',
    'getInitialData',
    'callInOutTensorMap',
    // 以后扩展再往里加
  ]);
  /* ===================================================
   * 1. 面板初始化：主题 / 语言 / 配置
   * =================================================== */
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
   * 2. 总入口：子类先调 super.getInitialData(panel)
   * =================================================== */
  static async getInitialData(panel: any) {
    console.debug('BaseGraphMsgHandler getInitialData 【开始】');
    // 1. 初始化
    await this.initTheme(panel);
    await this.loadMainData(panel);

    // 2-2 通用：函数哈希校验
    const gd = this.getGraphData(panel);
    if (!BaseGraphMsgHandler.checkFuncHash(panel, gd, 'pypto.canNotGetFuncHashOnOpenGraph')) return;

    // 2-3 缓存判断
    console.debug('BaseGraphMsgHandler getInitialData 开始读json数据');

    BaseGraphMsgHandler.postForReadJson(panel, 'initComGraph');
    let isBigFile = false;
    isBigFile = await BaseGraphMsgHandler.getJsonData(gd, panel, isBigFile);

    // 2-4 函数元信息
    await this.loadFuncHashMap(panel, gd);

    // 2-6 同步渲染
    await this.render(panel);

    // ✅ 监听布局请求（前端渲染完成后会发）
    BaseGraphMsgHandler.onDidReceiveMessage(panel);
    console.debug('BaseGraphMsgHandler getInitialData 【结束】');
  }

  protected static onDidReceiveMessage(panel: any) {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log(`[GraphView Handler] business command: ${message.command}`);
        await BaseGraphMsgHandler.CommonMessageActions(message, panel);
      },
      undefined,
      panel._disposables ?? [],
    );
  }

  static async CommonMessageActions(message: any, panel: any) {
    if (message.type === 'askLayout') {
      console.debug('BaseGraphMsgHandler getInitialData  监听到askLayout命令 准备elkLayout');
      void this.elkLayout(message.data, panel);
    }
    const filePath = panel.comGraphData.filePath;
    const funcHash = panel.comGraphData.funcHash;
    if (message.type === 'getJsonGraphData') {
      // 判断是否有最终结果
      let finalResult: any;
      let data: any;
      let isCached = false;
      if (panel.comGraphData.isUsedDB) {
        finalResult = await SQLiteCache.getInstance().comGraphFinalResultGet(filePath, funcHash);
      }
      if (finalResult) {
        data = finalResult; // 如果有缓存则发送最终数据
        isCached = true;
      } else {
        data = this.getJsonGraphData(message.data, panel);
      }
      BaseGraphMsgHandler.postJsonGraphData(panel, message, data, isCached);
    }
    if (message.type === 'setFinalResult') {
      // 插入sql
      const lastChangeTime = await getMTime(filePath);
      await SQLiteCache.getInstance().comGraphFinalResultSet(filePath, funcHash, message.data, lastChangeTime);
    }
  }

  static postJsonGraphData(panel: any, message: any, data: any, isCached: boolean) {
    panel.webview.postMessage({
      type: 'postJsonGraphData',
      data,
      isCached,
    });
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
      console.debug('BaseGraphMsgHandler getInitialData 当前是缓存模式');
      const hit = await SQLiteCache.getInstance().comGraphFuncDataGetCount(graphData.fsPath);
      if (hit === 0) {
        const ret = await graphData.readFileAndSetCache(graphData.fsPath, panel);
        isBigFile = ret.isBigFile;
      } else {
        console.debug('BaseGraphMsgHandler getInitialData FuncData命中缓存');
      }
    } else {
      console.debug('BaseGraphMsgHandler getInitialData 当前是纯内存模式');
      // 纯内存模式，强制读一次
      await graphData.readFileAndSetCache(graphData.fsPath, panel);
    }
    return isBigFile;
  }

  /* ===================================================
   * 3. 抽象：子类必须实现
   * =================================================== */
  /** 把「图数据」挂到 panel，可做多文件逻辑 */
  protected static async loadMainData(panel: any): Promise<void> {
    throw new Error('子类必须覆盖 loadMainData 方法');
  }

  /** 从 panel 取出「图数据」 */
  protected static getGraphData(panel: any): AbstractGraphData {
    throw new Error(`子类必须覆盖 getGraphData 方法`);
  }

  /* ===================================================
   * 4. 公共能力：elk 布局
   * =================================================== */
  static async elkLayout(graphData: any, panel: any) {
    console.debug('BaseGraphMsgHandler elkLayout 【开始】');
    const elkFactory = new ElkConstructor({ algorithms: ['layered'] });

    let comGraphData;
    comGraphData = BaseGraphMsgHandler.getElkLayoutComGraghData(comGraphData, panel, graphData, elkFactory);
    if (!comGraphData) return;

    const layoutDirection = graphData.layoutOptions['elk.direction'];
    const showtensor = graphData.layoutOptions['devkit.showTensor'];
    const filePath = comGraphData.fsPath;
    const renderMode = graphData.layoutOptions['devkit.renderMode'];
    let funcHash = comGraphData.funcHash!;

    // 构造缓存 key
    if (BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash)) {
      funcHash = funcHash + '_hasParent';
    }
    if (layoutDirection === 'DOWN') funcHash += '_down';
    if (showtensor !== 'true') funcHash += '_notshowtensor';

    const lastChangeTime = await getMTime(filePath);
    let cache: any;
    if (comGraphData.isUsedDB) {
      cache = await SQLiteCache.getInstance().comGraphLayoutGet(filePath, funcHash);
    }
    if (renderMode === 'path' || !cache) {
      const child = fork(path.join(__dirname, '../core/layoutWork.js'));
      child.send({ type: 'layout', graphData });
      child.on('message', async (res: { type: string; data?: any }) => {
        if (res.type === 'result') {
          const layoutJsonStr = JSON.stringify(res.data);
          if (comGraphData.isUsedDB && renderMode !== 'path') {
            await SQLiteCache.getInstance().comGraphLayoutSet(filePath, funcHash, layoutJsonStr, lastChangeTime);
          }
          this.postLayoutResult(panel, layoutJsonStr, graphData.layoutOptions['devkit.filePath']);
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
        this.postLayoutResult(panel, layoutJsonStr, graphData.layoutOptions['devkit.filePath']);
      } else {
        this.postLayoutResult(panel, cache.layout_result, graphData.layoutOptions['devkit.filePath']);
      }
    }
    console.debug('BaseGraphMsgHandler elkLayout 【结束】');
  }

  // graphData elkFactory 给子类重写预留
  static getElkLayoutComGraghData(comGraghData: any, panel: any, graphData: any, elkFactory: any) {
    comGraghData = panel.comGraphData;
    return comGraghData;
  }

  /* ===================================================
   * 5. 公共能力：搜索 / 跳转 / 健康报告
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

    new GraphView({ viewType: 'comItemDetailView', title: basename(comGraphData.fsPath) }, SingleGraphData, SingleGraphHandler).createPanel(
      comGraphData.fsPath,
      calleehash,
      curPath,
      undefined,
    );
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
    /* 1. 取“图数据”实例（单图 or diff 图） */
    const gd = this.getGraphData(panel);
    const fsPath = gd.fsPath;
    const isUsedDB = gd.isUsedDB;

    /* 2. 拿函数元信息映射（之前已缓存好） */
    const funcHashMap = graphFileHashMap[fsPath] as Record<string, { func_magicname: string }>;
    if (!funcHashMap) return panel.webview.postMessage({ command: 'globalSearchResult', data: {} });

    /* 3. 遍历每个函数，提取 JSON 并做搜索 */
    const resultMap: Record<string, any[]> = {};
    for (const [funcHash, funcMeta] of Object.entries(funcHashMap)) {
      /* 3-1 取单函数 JSON */
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

      /* 3-2 一次性提取四类映射（参数全部来自 jsonData） */
      const incasts = Extractor.extractIncasts(jsonData);
      const outcasts = Extractor.extractOutcasts(jsonData);
      const rawTensorMap = Extractor.extractRawTensors(jsonData);
      const tensorMap = Extractor.extractTensorNodes(jsonData, incasts, outcasts, rawTensorMap);
      const opMap = Extractor.extractOperationNodes(jsonData);
      const funcMap = Extractor.extractFuncMap(funcHashMap);

      /* 3-3 真正搜索 */
      const hits = Extractor.searchFunc(criteria, tensorMap, opMap, rawTensorMap, funcMap);
      if (hits.length) resultMap[funcHash] = hits;

      /* 3-4 如果只想搜函数本身，搜一次就够了 */
      if (criteria.category === 'Function') break;
    }

    /* 4. 把“函数级”模糊结果也合并进来 */
    if (!criteria.category) {
      const funcHits = Extractor.searchFunc({ ...criteria, category: 'Function' }, {}, {}, {}, Extractor.extractFuncMap(funcHashMap));
      if (funcHits.length) resultMap['totalFunction'] = funcHits;
    }

    /* 5. 回传前端 */
    panel.webview.postMessage({ command: 'globalSearchResult', data: resultMap });
  }

  static async getHealthyReport(panel: any) {
    const graphData = panel.comGraphData;
    const base = graphData.fsPath.replace(/\.json$/, '');
    const reports: any = {};
    for (const [key, suffix] of [
      ['TensorGraph', '_TensorGraphHealthReport.json'],
      ['TileGraph', '_TileGraphHealthReport.json'],
      ['ExecuteGraph', '_ExecuteGraph_Health_Report.json'],
      ['KernelGraph', '_Kernel_Graph_Health_Report.json'],
    ]) {
      const file = base + suffix;
      reports[key] = existsSync(file) ? await this.readHealthyJson(file) : null;
    }
    panel.webview.postMessage({ command: 'returnHealthyReport', data: reports });
  }

  /* ===================================================
   * 6. 工具： funcHashMap / healthyJson
   * =================================================== */

  protected static async loadFuncHashMap(panel: any, gd: AbstractGraphData) {
    console.debug('BaseGraphMsgHandler loadFuncHashMap 开始加载FuncHashMap到gd');
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

  private static async readHealthyJson(fsPath: string) {
    return new Promise<any>((resolve) => {
      const res: any = {};
      createReadStream(fsPath)
        .pipe(parser())
        .pipe(streamValues())
        .on('data', (d) => Object.assign(res, d.value))
        .on('end', () => resolve(res));
    });
  }
  static async openDiffViewer(panel: any) {
    const { DiffGraphHandler } = await import('../handler/diffGraphHandler');
    new GraphView(
      { viewType: 'itemDetailView', title: 'Computation Graph Diff', column: ViewColumn.One },
      DiffGraphData,
      DiffGraphHandler,
    ).createPanel(panel.comGraphData.fsPath, panel.comGraphData?.funcHash);
  }
  /* ===================================================
   * 7. 渲染：子类可 override
   * =================================================== */
  protected static async render(panel: any) {
    console.debug('BaseGraphMsgHandler render 【开始】');
    const gd = this.getGraphData(panel);
    // 1. 取数据
    const { json, io } = await this.fetchGraphJson(gd, panel);
    if (!json) {
      BaseGraphMsgHandler.returnError(panel, 'pypto.parseDataErrorOnRenderGraph');
      return;
    }
    // 挂 inouttensors
    if (io) json.inouttensors = io;
    // 2. 发送初始化消息
    await this.postInitMessages(panel, gd, json, false);

    // 3. 发图包
    await this.postRenderJson(panel, json, 'returnCom');
    console.debug('BaseGraphMsgHandler render 【结束】');
  }

  /* ===================================================
   * 8. 私有辅助
   * =================================================== */

  /* ===== 1. 取图 JSON + 辅助数据===== */
  protected static async fetchGraphJson(
    gd: AbstractGraphData,
    panel: any,
  ): Promise<{
    json: any;
    io?: any;
  }> {
    if (!gd) return { json: undefined };
    const ret = gd.isUsedDB
      ? await SQLiteCache.getInstance()
          .comGraphFuncDataGet(gd.fsPath, gd.funcHash!)
          .then((r) => (r?.big_data_file_path ? SQLiteCache.getInstance().readJsonFile(r.big_data_file_path) : r?.data ?? null))
      : gd.dataMap[gd.funcHash!];

    if (!ret) {
      BaseGraphMsgHandler.returnError(panel, 'pypto.parseDataErrorOnOpenGraph');
      return { json: undefined };
    }

    const json = JSON.parse(ret);
    // calleeMap
    await BaseGraphMsgHandler.returnCalleeMap(gd, panel);
    // inouttensors
    const io = BaseGraphMsgHandler.globalCallInOutTensorMap.get(gd.funcHash!);

    return { json, io };
  }

  private static async returnCalleeMap(gd: AbstractGraphData, panel: any) {
    const calleeMap = gd.isUsedDB
      ? JSON.parse(await SQLiteCache.getInstance().comGraphFileHashMapGet(gd.fsPath))
      : graphFileHashMap[gd.fsPath];
    panel.webview.postMessage({ command: 'returnCalleeMap', data: graphFileHashMap[gd.fsPath] || {} });
    return calleeMap;
  }

  /* ===== 2. 发图消息（单图/双图通用）===== */
  protected static async postRenderJson(panel: any, json: any, cmd: 'returnCom' | 'returnDiffCom' = 'returnCom'): Promise<void> {
    if (cmd == 'returnCom') {
      const nodeCount = json.operations.length + json.rawtensors.length + json.tensors.length;
      if (nodeCount > NODE_COUNT_LIMIT) {
        panel.webview.postMessage({ command: 'readJsonWarning' });
      }
      panel.webview.postMessage({
        command: cmd,
        step: 'convertData',
        data: json,
      });
    } else if (cmd == 'returnDiffCom') {
      panel.webview.postMessage({
        command: cmd,
        step: 'convertData',
        diffInfo: json,
      });
    }
  }

  // filePath 给子类重写预留
  protected static postLayoutResult(panel: any, jsonStr: string, filePath?: string) {
    panel.webview.postMessage({
      type: 'postLayoutResult',
      data: JSON.parse(jsonStr),
    });
  }

  protected static async postInitMessages(panel: any, gd: AbstractGraphData, json: any, isDiff: boolean): Promise<void> {
    /* 主题/语言  保证 前端初始状态 与当前主题一致，避免首帧闪白 */
    panel.webview.postMessage({ command: 'returnTheme', data: getIDETheme() });
    panel.webview.postMessage({ command: 'returnLang', data: getIDELang() });
  }

  protected static checkFuncHash(panel: any, gd: AbstractGraphData, cmd: string): boolean {
    if (gd && !gd.funcHash) {
      BaseGraphMsgHandler.returnError(panel, cmd);
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
    const map = BaseGraphMsgHandler.globalCallInOutTensorMap;
    for (const [funcHash, io] of Object.entries(data)) {
      map.set(funcHash, io);
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
}
