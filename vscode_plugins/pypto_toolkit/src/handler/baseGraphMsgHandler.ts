/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { Uri, workspace, window, Position, Selection, ViewColumn, Range, commands } from 'vscode';
import path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { t } from 'i18next';
import { globalConfig } from '../config/config';
import { getIDELang } from '../lang';
import { graphFileHashMap } from '../common/graphFileHashMap';
import * as Extractor from '../utils/graphExtractor';
import { AbstractGraphData } from '../core/graphData';
import { basename } from 'path';
import { hismartliteEx } from '../hismarliteEx';
import { AscppDagBuilder } from '../core/json-graph/jsonGraph';
import { getHealthReport } from '../utils/health-report';
import { promises } from 'fs';
import { getComGraphFinalResultStore, getComGraphFuncDataStore, getComGraphFileHashMapStore} from '../core/sqlInit';
import { getFailMagicList } from '../common/accurancyAnylasis';

// Extracted modules
import { RequestSourceType, OpError, NODE_COUNT_LIMIT, WHITE_COMMANDS } from './handler-types';
import { buildLayoutCacheKey } from './graph-cache-key';
import { collectOpMagic, getErrorMessage } from './error-log-parser';
import { getAccurancyReport, searchAccurancySumList, getAccurancyDetail } from './accuracy-report-service';
import { layout as nativeOrElkLayout, layoutByLocal, renderLayout } from './elk-layout-service';
import { retryUntil, getMTime } from '../core/cache-query-helper';
import { buildSubgraphQuery, applyFailMagicResults } from './subgraph-helpers';

/* -------------------- 抽象基类 -------------------- */
export abstract class BaseGraphMsgHandler {
  /* ---------- 全局 map，多面板共享 ---------- */
  public static globalCallInOutTensorMap = new Map();

  /** 允许前端调用的业务命令 — 委托到 handler-types.ts */
  public static readonly WHITE_COMMANDS = WHITE_COMMANDS;

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

    // 使用 buildLayoutCacheKey 替代原来的手动拼接
    funcHash = buildLayoutCacheKey(funcHash, {
      hasParent: BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash),
      direction: layout.direction,
      showTensor: layout.showTensor,
      filePath: message.data.filePath,
      threeMode: message.threeMode,
    });

    const lastChangeTime = await getMTime(filePath);
    const result = JSON.stringify(message.data);
    await getComGraphFinalResultStore().set({ filePath: filePath, funcHash: funcHash, lastChangeTime: lastChangeTime, finalResult: result });
  }

  static async getJsonGraphData(message: any, server: any) {
    const filePath = message.data.filePath === 'after' ? server.diffGraphData?.fsPath : server.comGraphData.fsPath;
    let funcHash = message.data.filePath === 'after' ? server.diffGraphData?.funcHash : server.comGraphData.funcHash;
    let finalResult: any;
    let data: any;
    let isCached = false;
    const layout = message.data.layout;
    // 构造缓存 key
    funcHash = buildLayoutCacheKey(funcHash, {
      hasParent: BaseGraphMsgHandler.globalCallInOutTensorMap.has(funcHash),
      direction: layout.direction,
      showTensor: layout.showTensor,
      filePath: message.data.filePath,
      threeMode: message.data.threeMode,
    });
    // get errorNode info
    let errNodeList = new Set<number>();
    if (message.data?.threeMode === false) {
      const errTraceList = await this.getErrorMessage(message, server);
      errNodeList = await this.collectOpMagic(server, errTraceList, message.data.currentData.funcmagic);
    }
    if (server.comGraphData.isUsedDB && !message.data.nodeMagic && filePath && !message.data.filePath) {
      finalResult = await getComGraphFinalResultStore().find({ filePath: filePath, funcHash: funcHash });
    }
    let lastChangeTime;
    if (filePath) {
      lastChangeTime = await getMTime(filePath);
    }
    if (finalResult && lastChangeTime === finalResult.lastChangeTime) {
      data = JSON.parse(finalResult.finalResult); // 如果有缓存则发送最终数据
      data['isFinial'] = true;
      isCached = true;
    } else {
      data = this.createJsonGraphData(message.data, server, errNodeList, message.diffType);
    }
    const wrongRawMagicList = server.comGraphData.wrongRawMagicList ? server.comGraphData.wrongRawMagicList : {};
    const failOpMagicList = server.comGraphData.failOpMagicList ? server.comGraphData.failOpMagicList : [];
    const failMagicList = server.comGraphData.failMagicList ? server.comGraphData.failMagicList : [];
    this.postJsonGraphData(server, message, data, isCached, wrongRawMagicList, failOpMagicList, failMagicList);
  }

  static createJsonGraphData(data, server, errNodeList, diffType?: 'before' | 'after') {
    const { comGraphData, currentData, showTensorNodes, showSyncNodes, colorBySubgraph, isDark, selectedSubgraphId, nodeMagic, searchLevel, version, threeMode } = data;
    const dagBuilder = new AscppDagBuilder(comGraphData, server, version, this.callInOutTensorMap, diffType);
    const wrongRawMagicList = server.comGraphData.wrongRawMagicList;
    const isLeaf = comGraphData.isLeaf ?? false;

    const sprottyGraph = dagBuilder.createSprottyGraph(
      currentData,
      showTensorNodes,
      showSyncNodes,
      colorBySubgraph,
      isDark,
      isLeaf,
      selectedSubgraphId,
      nodeMagic,
      searchLevel,
      threeMode,
      errNodeList,
      wrongRawMagicList,
    );

    (this as any).graphLastRenderData = data;

    return sprottyGraph;
  }

  protected static postForReadJson(server: any, cmd: string) {
    server.setRef(cmd, { step: 'readJson' });
  }

  protected static async getJsonData(gd: AbstractGraphData, server: any, diffType?: 'before' | 'after') {
    gd.isUsedDB = globalConfig.IS_USE_DB;
    try {
      if (gd.isUsedDB) {
        const result = await getComGraphFuncDataStore().query().filter({ filePath: gd.fsPath }).count();
        const hashFuncItem = (await getComGraphFuncDataStore().query().filter({ filePath: gd.fsPath }).exec()).filter(
          t => t.firstEntryHash !== '' && t.funcHash === '0');
        server.comGraphData.firstExecFuncHash = hashFuncItem?.[0]?.firstEntryHash;
        if (result === 0) {
          await gd.readFileAndSetCache(gd.fsPath);
        } else {
          // BaseGraphMsgHandler getInitialData FuncData 命中缓存
        }
      } else {
        await gd.readFileAndSetCache(gd.fsPath);
      }
    } catch (err: any) {
      if (err.code === 'FILE_READ_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.fileRead'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph', diffType });
        return;
      } else if (err.code === 'JSON_PARSE_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.jsonParse'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph', diffType })
        return;
      } else if (err.code === 'STREAM_PROCESSING_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.streamProcessing'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph', diffType })
        return;
      } else if (err.code === 'DATA_VALIDATION_OP_MAGIC_ERROR') {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.dataOpMagicDuplication'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph', diffType })
        return;
      } else {
        server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.readJsonUnknown'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph', diffType })
        return;
      }
    }
    return true;
  }

  static async openSearchMode(message: any, server: any) {
    const nodeMagic: string = message.data?.nodeMagic;
    const funcHash = message.data?.funcHash;
    const gd = server.comGraphData;
    commands.executeCommand('PyPTO.Open.OpenComGraphForNodeSearch', Uri.file(gd.fsPath), funcHash, nodeMagic);
  }

  /* ===================================================
   * 2. 抽象：子类必须实现
   * =================================================== */
  protected static async loadMainData(server: any): Promise<boolean> {
    throw new Error('子类必须覆盖 loadMainData 方法');
  }

  static async loadDiffData(server: any, otherFsPath: string) {
    throw new Error('子类必须覆盖 loadDiffData 方法');
  }

  protected static getGraphData(server: any): AbstractGraphData {
    throw new Error(`子类必须覆盖 getGraphData 方法`);
  }

  static async getSprottyGraphWithLevel(server: any, message: any) {
    throw new Error('comgraph子类必须覆盖 getSprottyGraphWithLevel 方法');
  }

  /* ===================================================
   * 3. 公共能力：elk 布局（委托）
   * =================================================== */
  static async layoutByLocal(server: any, gd: any, lastChangeTime: string, funcHash: string) {
    return layoutByLocal(server, gd, lastChangeTime, funcHash, this.getElkLayoutComGraghData.bind(this));
  }

  static async layout(gd: any, server: any) {
    return nativeOrElkLayout(gd, server, this.getElkLayoutComGraghData.bind(this), this.globalCallInOutTensorMap);
  }

  static renderLayout(layoutJsonStr: string, infoStr: string, server: any) {
    return renderLayout(layoutJsonStr, infoStr, server, this.getElkLayoutComGraghData.bind(this), this.globalCallInOutTensorMap);
  }

  /* ===================================================
   * 4. 公共能力
   * =================================================== */
  /**
   * 尝试复用已有面板。如果找到匹配面板则 reveal 并返回 true。
   */
  private static revealExistingPanel(server: any, gd: any): boolean {
    const webviews: any = hismartliteEx.webviews;
    if (server.entryHash == gd.calleehash) {
      const title = basename(gd.fsPath);
      const panel = webviews[title];
      if (panel) {
        panel.reveal(panel.ViewColumn);
        return true;
      }
    }
    if (Object.keys(webviews).includes(gd.subFuncmagicname)) {
      const panel = webviews[gd.subFuncmagicname];
      panel.reveal(panel.ViewColumn);
      return true;
    }
    return false;
  }

  /**
   * ROOT 文件的子图跳转：在目录中查找匹配文件并打开。
   */
  private static openRootSubgraph(gd: any, calleehash: string, subFuncmagicname: string): void {
    const rootFilePath = gd.fsPath;
    const extName = path.extname(rootFilePath);
    const rootBaseName = path.basename(rootFilePath, extName);
    const splitIdx = rootBaseName.indexOf('_');
    const filePrefix = rootBaseName.slice(0, splitIdx);
    const fileDir = path.dirname(rootFilePath);
    const fileList = fs.readdirSync(fileDir);
    let targetPath = rootFilePath;
    for (const matchedFile of fileList) {
      if (matchedFile.endsWith(extName) && matchedFile.includes(calleehash) && matchedFile.startsWith(filePrefix)) {
        targetPath = path.join(fileDir, matchedFile);
        break;
      }
    }
    commands.executeCommand('PyPTO.Open.OpenRenderGraphForCurrent', Uri.file(targetPath), subFuncmagicname);
  }

  static async getSubgraph(
    server: any,
    subInfo: { calleehash: string; subFuncmagicname: string; curPath: string; calleeOpMagic?: string; calleeOpSubgraphId?: string },
    query: any,
  ) {
    let { calleehash, subFuncmagicname, curPath, calleeOpMagic, calleeOpSubgraphId } = subInfo;
    const gd = server.comGraphData;

    // 1. 面板复用检查
    if (this.revealExistingPanel(server, gd)) return;

    // 2. ROOT 文件 → 独立处理
    const rootBaseName = path.basename(gd.fsPath, path.extname(gd.fsPath));
    if (rootBaseName.endsWith('ROOT')) {
      this.openRootSubgraph(gd, calleehash, subFuncmagicname);
      return;
    }

    // 3. 非 ROOT → editorView 打开
    const { useView } = await import('../view');
    const { editorView } = useView();
    const oldQuery = typeof query === 'string' ? JSON.parse(query) : query ?? {};

    // 初始化 parentInfo
    let parentInfo = oldQuery.parentInfo
      ? { ...oldQuery.parentInfo }
      : { level: 0 };

    // parentInfo 补全
    if (!parentInfo.calleeOpMagic && !parentInfo.calleeOpSubgraphId && oldQuery.calleeOpMagic && oldQuery.calleeOpSubgraphId) {
      parentInfo.calleeOpMagic = oldQuery.calleeOpMagic;
      parentInfo.calleeOpSubgraphId = oldQuery.calleeOpSubgraphId;
    }

    // 返回上一级 vs 进入下一级
    const isGoBack = !calleeOpMagic && !calleeOpSubgraphId;
    if (isGoBack) {
      calleeOpMagic = parentInfo.calleeOpMagic;
      calleeOpSubgraphId = parentInfo.calleeOpSubgraphId;
      parentInfo.level -= 1;
      if (parentInfo.level === 1) {
        delete parentInfo.calleeOpMagic;
        delete parentInfo.calleeOpSubgraphId;
      }
    } else {
      parentInfo.level += 1;
    }

    const finalQuery = buildSubgraphQuery(server.entryHash, oldQuery, calleehash, subFuncmagicname, curPath, calleeOpMagic, calleeOpSubgraphId, parentInfo);
    editorView.open('computeGraph', vscode.Uri.file(gd.fsPath), { query: finalQuery, title: subFuncmagicname });
  }

  static async loadEntryFunction(filePath: string, server: any): Promise<void> {
    try {
      const text = await promises.readFile(filePath, 'utf8');
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
    let ret: string | undefined = undefined;
    if (!isCalleeHash) {
      await this.loadEntryFunction(data.calleehash, server);
      return;
    } else {
      if (gd.isUsedDB && gd.funcHash) {
        const maxRetry = 5;
        const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
        for (let i = 0; i < maxRetry; i++) {
          const row = await retryUntil(
            () => getComGraphFuncDataStore().find({ filePath: gd.fsPath, funcHash: gd.funcHash || '' }),
            {
              maxRetries: 3,
              delayMs: 50,
            }
          );
          ret = row?.data;
          if (ret) {
            break;
          }
          await delay(100);  // 未拿到数据 重试
        }
      } else {
        /* 2️⃣ 内存模式：一次拿完 */
        ret = gd.dataMap[gd.funcHash!] ?? undefined;
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
      if (isUsedDB && gd.funcHash) {
        const row = await retryUntil(
          () => getComGraphFuncDataStore().find({ filePath: gd.fsPath, funcHash: funcHash || gd.funcHash || '' }),
          {
            maxRetries: 3,
            delayMs: 50,
          }
        );
        if (!row) continue;
        const raw = row.data;
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

    /* 把"函数级"模糊结果也合并进来 */
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
   * 精度报告（委托到 accuracy-report-service）
   * =================================================== */
  static async getAccurancyReport(server: any) {
    return getAccurancyReport(server);
  }

  static async searchAccurancySumList(server: any, message: any) {
    return searchAccurancySumList(server, message);
  }

  static async getAccurancyDetail(server: any, message: any) {
    return getAccurancyDetail(server, message);
  }

  /* ===================================================
   * 错误日志解析（委托到 error-log-parser）
   * =================================================== */
  static async getErrorMessage(message: any, server: any) {
    const gd = this.getGraphData(server);
    return getErrorMessage(gd);
  }

  static async collectOpMagic(server: any, errlist: OpError[], targetFuncMagic: number): Promise<Set<number>> {
    return collectOpMagic(server, errlist, targetFuncMagic);
  }

  /* ===================================================
   * 5. 公共方法：
   * =================================================== */
  /**
   * 从 DB 或内存中获取 function 数据。返回 JSON 字符串或 undefined（失败时已设置错误消息）。
   */
  private static async fetchFuncData(gd: AbstractGraphData, server: any, diffType?: 'before' | 'after'): Promise<string | undefined> {
    let funcHash = gd.funcHash;
    if (server.title === 'multiple graph' && gd.firstExecFuncHash && gd.firstExecFuncHash !== '') {
      funcHash = gd.firstExecFuncHash;
      server.comGraphData.firstExecFuncHash = funcHash;
      server.comGraphData.funcHash = funcHash;
    }

    let ret: string | undefined;
    if (gd.isUsedDB && gd.funcHash) {
      const row = await retryUntil(
        () => getComGraphFuncDataStore().find({ filePath: gd.fsPath, funcHash: funcHash || '' }),
        { maxRetries: 3, delayMs: 50 },
      );
      ret = row?.data;
    } else {
      ret = gd.dataMap[gd.funcHash!] ?? undefined;
    }

    if (!ret) {
      const cmd = gd.isUsedDB
        ? 'pypto.comGraph.errorMessage.dbQueryError'
        : 'pypto.comGraph.errorMessage.parseDataErrorOnOpenComGraph';
      this.returnError(server, cmd, {}, 'pypto.comGraph.errorLogMessage.funcHash',
        { funcHash: gd.funcHash ? gd.funcHash : 'not found', message: '' }, diffType);
    }

    return ret;
  }

  protected static async fetchGraphJson(
    gd: AbstractGraphData,
    server: any,
    diffType?: 'before' | 'after'
  ): Promise<{
    json: any;
    io?: any;
  }> {
    if (!gd) return { json: undefined };

    const ret = await this.fetchFuncData(gd, server, diffType);
    if (!ret) return { json: undefined };

    const failMagicRes = await getFailMagicList(gd.fsPath, gd.funcHash,
      server.query?.loopInfo, server.query?.fileType, server.query?.outputPath,
      server.query?.flowVerifyPath, server.query?.computeGraphDirPath, server.query?.rootFuncHash, server.query?.pathFunchash);
    applyFailMagicResults(server.comGraphData, failMagicRes);

    const json = JSON.parse(ret);
    await this.returnCalleeMap(gd, server, json, diffType);
    const io = BaseGraphMsgHandler.globalCallInOutTensorMap.get(gd.funcHash!);
    return { json, io };
  }

  private static searchSubFunc(
    funcHash: string,
    filePrefix: string,
    dirName: string,
    tempCalleemap: Record<string, { functype: string; func_magicname: string; graphtype: string }>,
  ): Record<string, { functype: string; func_magicname: string; graphtype: string }> {
    const fileList = fs.readdirSync(dirName);
    const matchedFiles = fileList.filter((f) => f.endsWith('.json') && f.includes(funcHash) && f.startsWith(filePrefix) && (!f.includes("Health_Report")));
    for (const matchedFile of matchedFiles) {
      const targetPath = path.join(dirName, matchedFile);
      const targetFile = fs.readFileSync(targetPath, 'utf8');
      const targetJson = JSON.parse(targetFile);
      const targetFunctype = targetJson.functions?.[0]?.functype;
      const targetFuncMagicname = targetJson.functions?.[0]?.func_magicname;
      const targetGraphtype = targetJson.functions?.[0]?.graphtype;
      tempCalleemap[funcHash] = { functype: targetFunctype, func_magicname: targetFuncMagicname, graphtype: targetGraphtype };
    }
    return tempCalleemap;
  }

  private static subGraphFileSearch(
    fileJson: any,
    gd: AbstractGraphData,
    calleeMap: any,
  ): Record<string, { functype: string; func_magicname: string; graphtype: string; }> {
    const filePath = gd.fsPath;
    const extName = path.extname(filePath);
    const baseName = path.basename(filePath, extName);
    const dirName = path.dirname(filePath);
    const splitIdx = baseName.indexOf('_');
    const filePrefix = baseName.slice(0, splitIdx);
    const isRoot: boolean = baseName.endsWith('ROOT');
    const tempCalleemap: Record<string, { functype: string; func_magicname: string; graphtype: string; }> = {};
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

  private static async returnCalleeMap(gd: AbstractGraphData, server: any, filejson: any, diffType?: 'before' | 'after') {
    let calleeMap = graphFileHashMap[gd.fsPath];
    if (gd.isUsedDB) {
      const result = await retryUntil(
        () => getComGraphFileHashMapStore().find({ filePath: gd.fsPath }),
        {
          maxRetries: 3,
          delayMs: 50,
        }
      );

      if (result?.data) {
        calleeMap = JSON.parse(result.data);
      } else {
        this.returnError(server, 'pypto.comGraph.errorMessage.error', { processName: 'getCalleeMap' }, 'pypto.comGraph.errorLogMessage.error', { logText: 'not get calleeMap' }, diffType);
      }
    }
    calleeMap = this.subGraphFileSearch(filejson, gd, calleeMap);
    this.checkIsLeaf(server, calleeMap);
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
          ? (nodesMagic === '-1' ? RequestSourceType.SearchNoMagic : RequestSourceType.SearchMagic)
          : RequestSourceType.NodeOverLimit;

        server.setRef('PathOriginMode', { data: mode, nodeMagic: nodesMagic, nodeCount: nodeCount });
      }
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
        isLeaf: server.isLeaf || false,
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
      const result = await retryUntil(
        () => getComGraphFileHashMapStore().find({ filePath: gd.fsPath }),
        {
          maxRetries: 3,
          delayMs: 50,
        }
      );
      if (result?.data) {
        graphFileHashMap[gd.fsPath] = JSON.parse(result.data);
      }
    }
  }

  static async openDiffViewer(server: any, query: any) {
    const { useView } = await import('../view');
    const { editorView } = useView();
    const oldQuery = typeof query === 'string' ? JSON.parse(query) : query ?? {};
    oldQuery.isBootStep = false;
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

  protected static checkFuncHash(server: any, gd: AbstractGraphData, cmd: string, diffType?: 'before' | 'after'): boolean {
    if (gd && !gd.funcHash) {
      this.returnError(server, cmd, {}, 'pypto.comGraph.errorLogMessage.funcHash', { funcHash: 'not found', message: '' }, diffType);
      return false;
    }
    return true;
  }

  protected static checkIsLeaf(server: any, calleeMap): void {
    const curFuncHash = server.comGraphData?.funcHash;
    if (!curFuncHash) {
      server.isLeaf = false;
      return;
    }
    const curFuncName = calleeMap[curFuncHash]?.func_magicname;
    server.isLeaf = curFuncName?.toLowerCase().includes("leaf") ?? false;
  }

  public static returnError(server: any, cmd: string, cmdArgs?: Record<string, any>, logCmd?: string, logCmdArgs?: Record<string, any>, diffType?: 'before' | 'after') {
    const data = cmdArgs ? t(cmd, cmdArgs) : t(cmd);
    const log = logCmd ? (logCmdArgs ? t(logCmd, logCmdArgs) : t(logCmd)) : null;
    server.setRef('ErrorMessage', { data: data, log: log, diffType });
  }

  /** 前端一次性把整图的张量输入输出关系推过来 */
  static callInOutTensorMap(data: any) {
    const map = new Map(Object.entries(data));
    for (const [k, v] of map) {
      BaseGraphMsgHandler.globalCallInOutTensorMap.set(k, v);
    }
  }

  protected static async generateFucTree(hash: string, gd: AbstractGraphData, loop: number = 0): Promise<any> {
    const subHashes = await this.getSubHash(hash, gd); // 沿用原实现
    if (!subHashes) {
      return {};
    }
    const node: any = {};
    if (!Array.isArray(subHashes)) return node;
    for (const h of subHashes) {
      if (loop > 0) {
        node[h] = [];
      } else {
        node[h] = await this.generateFucTree(h, gd, loop + 1);
      }

    }
    return node;
  }

  protected static async getSubHash(curHash, comGraphData) {
    let comGraphFuncData: any;
    let resStr = '';
    if (comGraphData.isUsedDB) {
      comGraphFuncData = await getComGraphFuncDataStore().find({ filePath: comGraphData.fsPath, funcHash: curHash });
      resStr = comGraphFuncData?.callHashArr;
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
    if (io && server.query.calleeOpMagic) json.inouttensors = io;
    // 2. 发送初始化消息
    await this.postInitMessages(server, gd, json, false);
    // 3. 发图包
    await this.postRenderJson(server, json, 'returnCom');
  }

  // filePath 给子类重写预留
  protected static postLayoutResult(server: any, jsonStr: string, filePath?: string) {
    this.postLayoutResultData(server, JSON.parse(jsonStr), filePath);
  }

  // 直接接收布局结果对象（native 布局结果本就是对象，避免 stringify/parse 往返）
  protected static postLayoutResultData(server: any, data: any, filePath?: string) {
    server.setRef('LayoutResult', { data });
  }

  static postJsonGraphData(server: any, message: any, data: any, isCached: boolean, wrongRawMagicList?: any, failOpMagicList?: any, failMagicList?: any) {
    server.setRef('JsonGraphData', { data, isCached, wrongRawMagicList, failOpMagicList, failMagicList });
  }

  // graphData elkFactory 给子类重写预留
  static getElkLayoutComGraghData(server: any, graphData: any, elkFactory?: any) {
    return server.comGraphData;
  }

}
