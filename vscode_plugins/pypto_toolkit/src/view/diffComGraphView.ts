import { Uri, ViewColumn, workspace, window } from 'vscode';
import { basename, join } from 'path';
import { hismartliteEx } from '../hismarliteEx';
import ElkConstructor from 'elkjs/lib/elk.bundled';
import { createReadStream } from 'fs';
import { Util, getDiffInfo, getOtherFilePath } from '../util';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';
import { pick } from 'stream-json/filters/Pick';
import { SQLiteCache, getMTime } from '../core/sqliteCache';
import { globalConfig } from '../config/config';
import { t } from 'i18next';
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/Pick');
const { streamValues } = require('stream-json/streamers/StreamValues');
const NODE_COUNT_LIMIT = 50000;
const DATA_LENGTH_LIMIT = 62000000;const { fork } = require('child_process');
const path = require('path');
const fileHashMap = {};

interface readFileResult {
  isBigData: boolean;
}

class DiffComGraphData {
  public fsPath: string;
  public funcHash: string | undefined;
  funcHashMap: any;
  dataMap: any;
  callHashArrMap: any;
  calleeOpAttrMap: any;
  isUsedDB: boolean;

  constructor(fsPath: string, funcHash: string | undefined) {
    this.fsPath = fsPath;
    this.funcHash = funcHash;
    this.funcHashMap = {};
    this.dataMap = {};
    this.callHashArrMap = {};
    this.calleeOpAttrMap = {};
    this.isUsedDB = false;
  }

  static async getEntryHash(fsPath: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const pipeline = createReadStream(fsPath).pipe(parser());
      const picked = pipeline.pipe(pick({ filter: 'entryhash' }));
      picked.on('data', (chunk: any) => {
        if (chunk.name === 'stringValue') {
          resolve(chunk.value);
          picked.destroy();
        }
      });
      picked.on('end', () => {
        resolve(undefined);
      });
    });
  }

  async readFileAndSetCache(fsPath: string, panel: any): Promise<readFileResult> {
    const fileStream = createReadStream(fsPath);
    const pipeline = fileStream.pipe(parser()).pipe(streamValues());
    const result: readFileResult = { isBigData: false };

    return new Promise((resolve, reject) => {
      pipeline
        .on('data', async (ele) => {
          // 处理数据
          const value = ele.value;
          if (!value.functions) return;

          await this.processFunctions(fsPath, value, result, panel);
        })
        .on('end', () => {
          resolve(result);
        })
        .on('error', (err) => {
          // 错误处理
          reject(err);
        });
    });
  }
  private async processFunctions(fsPath: string, value: any, result: readFileResult, panel: any): Promise<void> {
    try {
      /* 1. 汇总 funcHashMap */
      for (const funcItem of value.functions) {
        const hash = String(funcItem.hash);
        this.funcHashMap[hash] = {
          functype: funcItem.functype || null,
          func_magicname: funcItem.func_magicname || null,
        };
      }
      if (this.isUsedDB) {
        await SQLiteCache.getInstance().comGraphFileHashMapSet(fsPath, JSON.stringify(this.funcHashMap));
      }

      /* 2. 构造插入任务数组 */
      const tasks: (() => Promise<void>)[] = [];
      const lastChangeTime = await getMTime(fsPath);

      for (const funcItem of value.functions) {
        const callHashArr: string[] = [];
        for (const op of funcItem.operations) {
          if (op.calleehash) {
            callHashArr.push(String(op.calleehash));
            if (Array.isArray(op.attr) && op.attr.length > 0) {
              op.attr[0] = op.calleehash;
            }
            op.functype = this.funcHashMap[op.calleehash]?.functype;
            op.func_magicname = this.funcHashMap[op.calleehash]?.func_magicname;
            if (op.opmagic) {
              if (this.isUsedDB) {
                const ioperands = [...new Set(op.ioperands)];
                await SQLiteCache.getInstance().comGraphFileCalleeOpAttrSet(op.calleehash, op.opmagic, op.subgraphid.toString(), JSON.stringify(op.attr),JSON.stringify(ioperands));
              } else {
                this.calleeOpAttrMap[op.calleehash + '_' + op.opmagic] = op.attr.toString();
              }
            }
          }
        }

        const data = JSON.stringify(funcItem);
        if (!this.isUsedDB) {
          // 不用缓存数据库的情况
          this.dataMap[funcItem.hash] = data;
          this.callHashArrMap[funcItem.hash] = callHashArr.toString();
          return;
        }
        if (data.length >= DATA_LENGTH_LIMIT) {
          result.isBigData = true;
          const bigPath = await SQLiteCache.getInstance().createBigDataFile(funcItem.hash, data);
          await SQLiteCache.getInstance().comGraphFuncDataSet(
            fsPath,
            String(funcItem.hash),
            callHashArr.toString(),
            '',
            bigPath,
            lastChangeTime,
          );
        } else {
          await SQLiteCache.getInstance().comGraphFuncDataSet(
            fsPath,
            String(funcItem.hash),
            callHashArr.toString(),
            data,
            '',
            lastChangeTime,
          );
        }
      }
      await SQLiteCache.getInstance().save();
    } catch (e) {
      console.warn('[DB] 数据库操作失败，自动降级 >>>', e);
      if (this.isUsedDB) {
        this.isUsedDB = false;
        // 立即重新走内存分支
        return await this.processFunctions(fsPath, value, result, panel);
      } else {
        panel.webview.postMessage({
          command: 'returnError',
          data: t('pypto.readFileDataErrorOnOpenComGraph'),
        });
      }
    }
  } 
}

class MsgHandler {
  static async getInitialData(panel: any) {
    const config = Util.getComGraphCustomCfg();
    panel.webview.postMessage({
      command: 'initDiffComGraph',
      step: 'readJson',
      configration: config,
    });
    const originComGraphData = panel.originGraphData;
    const diffComGraphData = panel.diffComGraphData;
    if (originComGraphData && !originComGraphData.funcHash) {
      const entryHash = (await DiffComGraphData.getEntryHash(originComGraphData.fsPath)) ?? '0';
      originComGraphData.funcHash = entryHash;
    }

    if (diffComGraphData && !diffComGraphData.funcHash) {
      const entryHash = (await DiffComGraphData.getEntryHash(diffComGraphData.fsPath)) ?? '0';
      diffComGraphData.funcHash = entryHash;
    }
    let result: any;
    let otherResult: any;
    // 判断有没有originComgraphData缓存
    let originIsBigFile = false;
    let diffIsBigFile = false;

    ({ result : result, isBigFile: originIsBigFile } = await MsgHandler.getJsonData(originComGraphData, result, panel, originIsBigFile));

    if (diffComGraphData && diffComGraphData.fsPath) {
      ({ result : otherResult, isBigFile: diffIsBigFile } = await MsgHandler.getJsonData(diffComGraphData, otherResult, panel, diffIsBigFile));
    }
    

    if (originComGraphData && !originComGraphData.funcHash) {
      panel.webview.postMessage({
        command: 'returnError',
        data: t('pypto.canNotGetFuncHashOnOpenOriginGraph'),
      });
      return;
    }
    if (diffComGraphData && !diffComGraphData.funcHash) {
      panel.webview.postMessage({
        command: 'returnError',
        data: t('pypto.canNotGetFuncHashOnOpenComparisonGraph'),
      });
      return;
    }

    setTimeout(async() => {
      // 延时一个宏任务规避获取ret失败
      let ret: any;
      ({ isBigFile : originIsBigFile, ret:ret } = await MsgHandler.getFuncData(originComGraphData, originIsBigFile, ret));
      let otherRet: any;
      if (diffComGraphData) {
        ({ isBigFile : diffIsBigFile, ret:otherRet } = await MsgHandler.getFuncData(diffComGraphData, diffIsBigFile, otherRet));
      }
      
      if (panel.otherFsPath) {
        if (ret && otherRet) {
          ret = JSON.parse(ret);
          otherRet = JSON.parse(otherRet);
        }
      } else if (ret) {
        ret = JSON.parse(ret);
      } else {
        panel.webview.postMessage({
          command: 'returnError',
          data: t('pypto.parseDataErrorOnOpenComGraph'),
        });
        return;
      }
      returnCalleeMap(originComGraphData, panel);
      if (diffComGraphData) {
        returnCalleeMap(diffComGraphData, panel);
      }

      setTimeout(() => {
        const diffInfo = getDiffInfo(originComGraphData.fsPath, ret);
        if (panel.otherFsPath) {
          const otherFileName = basename(panel.otherFsPath).replace('.json', '');
            diffInfo.afterFileName = otherFileName;
            diffInfo.afterJson = otherRet;
          }
        panel.webview.postMessage({
          command: 'returnDiffCom',
          step: 'rendering',
          diffInfo,
        });
      });
      panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'askLayout') {
          this.elkLayout(message.data, panel);
        }
      });
    });
  }

  private static async getFuncData(comGraphData: any, isBigFile: boolean, ret: any) {
    if (comGraphData.isUsedDB) {
      const comGraphFuncData = await SQLiteCache.getInstance().comGraphFuncDataGet(comGraphData.fsPath, comGraphData?.funcHash);
      if (comGraphFuncData) {
        if (comGraphFuncData.big_data_file_path && comGraphFuncData.big_data_file_path != '') {
          isBigFile = true;
        }
        if (isBigFile) {
          ret = await SQLiteCache.getInstance().readJsonFile(comGraphFuncData.big_data_file_path);
        } else {
          ret = comGraphFuncData.data;
        }
      }
    } else {
      ret = comGraphData.dataMap[comGraphData?.funcHash];
    }
    return { isBigFile, ret };
  }

  private static async getJsonData(comGraphData: any, result: any, panel: any, isBigFile: boolean) {
    let count = 0;
    comGraphData.isUsedDB = globalConfig.IS_USE_DB;
    if (comGraphData.isUsedDB) {
      count = await SQLiteCache.getInstance().comGraphFuncDataGetCount(comGraphData.fsPath);
    }
    if (count == 0) {
      // 未命中FuncData缓存
      result = await comGraphData.readFileAndSetCache(comGraphData.fsPath, panel);
      isBigFile = result.isBigData;
    }
    if (!fileHashMap[comGraphData.fsPath] && comGraphData.funcHashMap && Object.keys(comGraphData.funcHashMap).length > 0) {
      fileHashMap[comGraphData.fsPath] = comGraphData.funcHashMap;
    } else {
      // 命中FuncData缓存
      fileHashMap[comGraphData.fsPath] = JSON.parse(await SQLiteCache.getInstance().comGraphFileHashMapGet(comGraphData.fsPath));
    }
    return { result, isBigFile };
  }

  static async elkLayout(graphData, panel) {
    const elkFactory = new ElkConstructor({
      algorithms: ['layered'],
    });
    let comGraphData;
    if (graphData.layoutOptions['devkit.filePath'] === 'before') {
      comGraphData = panel.originGraphData;
    } else {
      elkFactory.layout(graphData).then((result) => {
        const layoutJsonStr = JSON.stringify(result);
        MsgHandler.postLayoutResult(panel, layoutJsonStr, graphData.layoutOptions['devkit.filePath']);
      });
      return;
    }

    let funcHash = comGraphData.funcHash; // 获取函数哈希
    const layoutDirection = graphData.layoutOptions['elk.direction'];
    const showtensor = graphData.layoutOptions['devkit.showTensor'];
    if (funcHash === undefined) {
      panel.webview.postMessage({
        command: 'returnError',
        data: t('pypto.funcHashUndefinedOnOpenSubGraph'),
      });
      return;
    }
    if (layoutDirection === 'DOWN') {
      funcHash = funcHash + '_down';
    }

    if (showtensor !== 'true') {
      funcHash = funcHash + '_notshowtensor';
    }
    const lastChangeTime = await getMTime(comGraphData.fsPath);

    let cache = await SQLiteCache.getInstance().comGraphLayoutGet(comGraphData.fsPath, funcHash);
    if (!cache) {
      const child = fork(path.join(__dirname, '../core/layoutWork.js'));
      child.send({
        type: 'layout',
        graphData,
      });

      child.on('message', async (res) => {
        if (res.type === 'result') {
          const layoutJsonStr = JSON.stringify(res.data);
          if (comGraphData.isUsedDB) {
            await SQLiteCache.getInstance().comGraphLayoutSet(comGraphData.fsPath, funcHash, layoutJsonStr, lastChangeTime);
          }
          MsgHandler.postLayoutResult(panel, layoutJsonStr, graphData.layoutOptions['devkit.filePath']);
          child.kill();
        }
      });
      child.on('error', (err) => {
        console.error('Layout worker error:', err);
        child.kill();
      });
      child.on('exit', (code) => {
        console.log(`Layout worker exited with code ${code}`);
      });
    } else {
      if (lastChangeTime != cache.last_change_time) {
        // 清除失效缓存
        await SQLiteCache.getInstance().comGraphLayoutDel(comGraphData.fsPath);
        elkFactory.layout(graphData).then(async (result) => {
          // 加入缓存
          const layoutJsonStr = JSON.stringify(result);
          await SQLiteCache.getInstance().comGraphLayoutSet(comGraphData.fsPath, funcHash, layoutJsonStr, lastChangeTime);
          MsgHandler.postLayoutResult(panel, layoutJsonStr, graphData.layoutOptions['devkit.filePath']);
        });
      } else {
        MsgHandler.postLayoutResult(panel, cache.layout_result, graphData.layoutOptions['devkit.filePath']);
      }
    }
  }

  private static postLayoutResult(panel: any, jsonStr: string, filePath?: string) {
    panel.webview.postMessage({
      type: 'postLayoutResult',
      data: JSON.parse(jsonStr),
      filePath,
    });
  }
}

export class DiffComGraphView {
  public isReveal: boolean;
  public title: string;
  public msgHandler: any;
  public _disposables: any[];
  public createArg: any;
  public panel: any;

  constructor(column: ViewColumn) {
    this.isReveal = false;
    this.title = '';
    this.msgHandler = MsgHandler;
    this._disposables = [];
    this.createArg = {
      type: 'itemDetailView',
      column: column,
      options: { enableScripts: true, retainContextWhenHidden: true },
    };
  }

  /* 通过菜单命令打开 */
  async createPanel(fsPath: string, funcHash: string | undefined) {
    this.title = 'Computation Graph Diff Viewer';
    this.panel = window.createWebviewPanel(this.createArg.type, this.title, this.createArg.column, this.createArg.options);
    this.panel.msgHandler = this.msgHandler;
    this.panel.otherFsPath = getOtherFilePath(fsPath);
    this.panel.originGraphData = new DiffComGraphData(fsPath, funcHash);
    if (this.panel.otherFsPath) {
      this.panel.diffComGraphData = new DiffComGraphData(this.panel.otherFsPath, funcHash);
    }
    const webviews: any = hismartliteEx.webviews;
    webviews[this.title] = this.panel;
    await this.initWebViewPanel();

    const context: any = hismartliteEx.context;
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.onDispose();
      },
      null,
      context.subscriptions,
    );
    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        const panel = this.panel;
        if (panel.msgHandler[message.command]) {
          panel.msgHandler[message.command](panel, message.paramObj);
        }
      },
      undefined,
      this._disposables,
    );
    window.onDidChangeActiveColorTheme(() => {
      this.panel.webview.postMessage({
        command: 'returnTheme',
        data: getIDETheme(),
      });
    });
  }

  /* 通过计算图点击查看差异时打开 */
  async createDiffPanel(fsPath: string, funcHash: string | undefined) {
    this.title = 'Computation Graph Diff Viewer';
    this.panel = window.createWebviewPanel(this.createArg.type, this.title, this.createArg.column, this.createArg.options);
    this.panel.msgHandler = this.msgHandler;
    this.panel.otherFsPath = getOtherFilePath(fsPath);
    this.panel.originGraphData = new DiffComGraphData(fsPath, funcHash);
    if (this.panel.otherFsPath) {
      this.panel.diffComGraphData = new DiffComGraphData(this.panel.otherFsPath, funcHash);
    }
    this.panel.comGraphFuncHash = funcHash;
    const webviews: any = hismartliteEx.webviews;
    webviews[this.title] = this.panel;
    await this.initWebViewPanel();

    const context: any = hismartliteEx.context;
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.onDispose();
      },
      null,
      context.subscriptions,
    );
    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        const panel = this.panel;
        if (panel.msgHandler[message.command]) {
          panel.msgHandler[message.command](panel, message.paramObj);
        }
      },
      undefined,
      this._disposables,
    );
    window.onDidChangeActiveColorTheme(() => {
      this.panel.webview.postMessage({
        command: 'returnTheme',
        data: getIDETheme(),
      });
    });
  }

  async initWebViewPanel() {
    let replaceParams: any[] = [];
    const htmlPath = Uri.file(join(hismartliteEx.extensionPath, 'webview-dist', 'index.html'));
    let documentText = await workspace.openTextDocument(htmlPath);
    let webviewText = this.panel.webview.asWebviewUri(Uri.file(join(hismartliteEx.extensionPath)));
    let html = documentText
      .getText()
      .replace(/{{root}}/g, webviewText)
      .replace(/{{staticPath}}/g, `${webviewText}/webview-dist`)
      .replace(/{{ascTheme}}/g, getIDETheme())
      .replace(/{{ascLang}}/g, getIDELang());
    this.panel.webview.html = new Util().replaceHtmlFromData(replaceParams, html);
  }

  onDispose() {
    this.panel = null;
    this.closeWebViewPanel();
    const webviews: any = hismartliteEx.webviews;
    delete webviews[this.title];
  }

  closeWebViewPanel() {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}
function returnCalleeMap(originComGraphData: any, panel: any) {
  const calleeMap = fileHashMap[originComGraphData.fsPath];
  panel.webview.postMessage({
    command: 'returnCalleeMap',
    data: calleeMap,
  });
}

