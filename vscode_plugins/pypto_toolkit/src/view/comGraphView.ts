import { Uri, ViewColumn, workspace, window, Position, Selection, Range } from 'vscode';
import { basename, join } from 'path';
import { hismartliteEx } from '../hismarliteEx';
import ElkConstructor from 'elkjs/lib/elk.bundled';
import { SQLiteCache, getMTime } from '../core/sqliteCache';
import { createReadStream, existsSync, promises as fs } from 'fs';
import { Util } from '../util';
import { getIDETheme } from '../theme';
import { pick } from 'stream-json/filters/Pick';
import { globalConfig } from '../config/config';
const { fork } = require('child_process');
const path = require('path');
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/Pick');
const { streamValues } = require('stream-json/streamers/StreamValues');
const fileHashMap = {};
const NODE_COUNT_LIMIT = 50000;
const DATA_LENGTH_LIMIT = 62000000;
const globalCallInOutTensorMap = new Map();

interface readFileResult {
  isBigData: boolean;
}
class ComGraphData {
  public fsPath: string;
  public funcHash: string | undefined;
  funcHashMap: any;
  dataMap: any;
  callHashArrMap: any;
  calleeOpAttrMap: any;
  isUsedDB: boolean;
  calleeOpMagic?: string;
  calleeOpSubgraphId?: string;

  constructor(fsPath: string, funcHash: string | undefined, calleeOpMagic?: string, calleeOpSubgraphId?: string) {
    this.fsPath = fsPath;
    this.funcHash = funcHash;
    this.funcHashMap = {};
    this.dataMap = {};
    this.callHashArrMap = {};
    this.calleeOpAttrMap = {};
    this.isUsedDB = false;
    this.calleeOpMagic = calleeOpMagic;
    this.calleeOpSubgraphId = calleeOpSubgraphId;
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

  static async filterFunctionByHash(fsPath: string, funcHash: string | undefined | string[]) {
    if (!funcHash) {
      funcHash = await ComGraphData.getEntryHash(fsPath);
    }

    if (!funcHash) {
      return;
    }

    return new Promise(async (reslove, reject) => {
      const fileStream = createReadStream(fsPath);
      let result: any = {};
      const simple = typeof funcHash !== 'string';
      if (typeof funcHash === 'string') {
        funcHash = [funcHash];
      }
      const pipeline = fileStream.pipe(parser()).pipe(streamValues());
      pipeline
        .on('data', (ele: any) => {
          // key will be the index of the array element (e.g: "0", "1")
          // value will be the parsed object/array at that index
          const value = ele.value;
          if (value.functions) {
            const functionHashMap = new Map<string, string>();
            value.functions.forEach(async (item: any) => {
              item.hash = String(item.hash);
              const hash = item.hash;
              functionHashMap[hash] = item.func_magicname;
              if (funcHash && funcHash.includes(hash)) {
                if (simple) {
                  result[hash] = {
                    functype: item.functype,
                    func_magicname: item.func_magicname,
                  };
                } else {
                  item.operations.forEach((element: any) => {
                    if (element.calleehash) {
                      element.calleehash = String(element.calleehash);
                    }
                  });
                  result[hash] = item;
                }
              } else {
                // 查询哈希函数信息失败
              }
            });

            if (!simple) {
              result.functionHashMap = functionHashMap;
            }
          }
        })
        .on('end', () => {
          if (!Object.keys(result).length) {
            reslove(null);
          } else {
            reslove(result);
          }
        })
        .on('error', (err: any) => {
          console.error('Error parsing stream:', err);
        });
    });
  }

  // 读取json文件并存入缓存 并返回大小文件判断
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

  // async readFileAndSetCacheSafe(fsPath: string): Promise<readFileResult> {
  //   try {
  //     return await this.readFileAndSetCache(fsPath);
  //   } catch (e) {
  //     console.warn('[DB] 数据库操作失败，自动降级 >>>', e);
  //     this.isUsedDB = false;
  //     // 立即重新走内存分支
  //     return await this.readFileAndSetCache(fsPath);
  //   }
  // }

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
            if (op.opmagic.toString()) {
              if (this.isUsedDB) {
                await SQLiteCache.getInstance().comGraphFileCalleeOpAttrSet(op.calleehash, op.opmagic, op.subgraphid.toString(), JSON.stringify(op.attr));
              } else {
                this.calleeOpAttrMap[op.calleehash + '_' + op.opmagic + '_' + op.subgraphid] = op.attr.toString();
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
          data: `无法打开计算图，读取文件数据出现异常`,
        });
      }
    }
  }
}

class MsgHandler {
  static async getInitialData(panel: any) {
    const config = Util.getComGraphCustomCfg();
    panel.webview.postMessage({
      command: 'initComGraph',
      step: 'readJson',
      configration: config,
    });
    const comGraphData = panel.comGraphData;
    const isOri = !comGraphData.funcHash;

    const entryHash = (await ComGraphData.getEntryHash(comGraphData.fsPath)) ?? '0';
    panel.entryHash = entryHash;
    let isBigFile = false;
    let result: any;
    // 判断有没有FuncData缓存
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
    if (!fileHashMap[comGraphData.fsPath] && comGraphData.funcHashMap) {
      fileHashMap[comGraphData.fsPath] = comGraphData.funcHashMap;
    } else {
      // 命中FuncData缓存
      fileHashMap[comGraphData.fsPath] = JSON.parse(await SQLiteCache.getInstance().comGraphFileHashMapGet(comGraphData.fsPath));
    }

    if (isOri) {
      comGraphData.funcHash = entryHash;
    }
    const funcHash = comGraphData?.funcHash || undefined;
    if (funcHash === undefined) {
      panel.webview.postMessage({
        command: 'returnError',
        data: `无法打开子图，该文件未找到正确function hash`,
      });
      return;
    }

    setTimeout(async () => {
      // 延时一个宏任务规避获取ret失败
      let ret: any;
      let calleeOpAttr: string | undefined;
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
          if (comGraphData.calleeOpMagic?.toString() && comGraphData.calleeOpSubgraphId?.toString()) {
            calleeOpAttr = await SQLiteCache.getInstance().comGraphFileCalleeOpAttrGet(comGraphData?.funcHash.toString(), 
                                                                                       comGraphData.calleeOpMagic.toString(),
                                                                                       comGraphData.calleeOpSubgraphId.toString());
          }
        }
      } else {
        ret = comGraphData.dataMap[comGraphData?.funcHash];
      }

      if (ret) {
        ret = JSON.parse(ret);
      } else {
        panel.webview.postMessage({
          command: 'returnError',
          data: `无法打开计算图，解析数据出现异常`,
        });
        return;
      }
      if (panel.title === 'swimGraphJump') {
        panel.title = ret.func_magicname;
      }

      const calleeOpAttrMap = {"calleeOpAttr" : calleeOpAttr, "opAttrIncastTensors": ret.global_tensors};
      const calleeMap = fileHashMap[comGraphData.fsPath];
      const funcTree = {};
      funcTree[entryHash] = await generateFucTree(entryHash, comGraphData);
      const curPath = panel.curPath ? JSON.parse(panel.curPath) : [comGraphData.funcHash];
      const nodeCount = ret.operations.length + ret.rawtensors.length + ret.tensors.length;
      if (nodeCount > NODE_COUNT_LIMIT) {
        // 提示节点过多的风险
        panel.webview.postMessage({
          command: 'readJsonWarning',
        });
      }
      panel.webview.postMessage({
        command: 'returnInitData',
        fsPath: comGraphData.fsPath,
        funcHash: funcHash,
        magicName: ret.func_magicname,
      });
      panel.webview.postMessage({
        command: 'returnCalleeMap',
        data: calleeMap,
      });

      if(calleeOpAttr) {
        panel.webview.postMessage({
          command: 'returnCalleeOpAttrMap',
          data: calleeOpAttrMap,
        });
      }

      panel.webview.postMessage({
        command: 'returnFuncTree',
        entry: entryHash,
        fsPath: comGraphData.fsPath,
        curPath: curPath,
        data: funcTree,
      });
      setTimeout(() => {
        const callInOutInfo = globalCallInOutTensorMap.get(comGraphData?.funcHash);
        if (callInOutInfo) {
          ret.inouttensors = callInOutInfo;
        }
        panel.webview.postMessage({
          command: 'returnCom',
          step: 'rendering',
          data: ret,
        });
      });
      panel.webview.onDidReceiveMessage((message) => {
        if (message.type === 'askLayout') {
          this.elkLayout(message.data, panel);
        }
      });
    });
  }

  static async elkLayout(graphData, panel) {
    console.time('layout总耗时');
    const elkFactory = new ElkConstructor({
      algorithms: ['layered'],
    });
    const comGraphData = panel.comGraphData;
    const layoutDirection = graphData.layoutOptions['elk.direction'];
    const showtensor = graphData.layoutOptions['devkit.showTensor'];
    const filePath = comGraphData.fsPath; // 获取文件路径
    let funcHash = comGraphData.funcHash; // 获取函数哈希
    if (funcHash === undefined) {
      panel.webview.postMessage({
        command: 'returnError',
        data: `无法打开子图，function hash未定义`,
      });
      return;
    }

    if (globalCallInOutTensorMap.has(funcHash)) {
      funcHash = funcHash + '_hasParent';
    }

    if (layoutDirection === 'DOWN') {
      funcHash = funcHash + '_down';
    }

    if (showtensor !== 'true') {
      funcHash = funcHash + '_notshowtensor';
    }

    const lastChangeTime = await getMTime(filePath);
    let cache: any;
    if (comGraphData.isUsedDB) {
      cache = await SQLiteCache.getInstance().comGraphLayoutGet(filePath, funcHash);
    }
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
            await SQLiteCache.getInstance().comGraphLayoutSet(filePath, funcHash, layoutJsonStr, lastChangeTime);
          }
          MsgHandler.postLayoutResult(panel, layoutJsonStr);
          console.timeEnd('layout总耗时');
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
        await SQLiteCache.getInstance().comGraphLayoutDel(filePath);
        elkFactory.layout(graphData).then(async (result) => {
          // 加入缓存
          const layoutJsonStr = JSON.stringify(result);
          await SQLiteCache.getInstance().comGraphLayoutSet(filePath, funcHash, layoutJsonStr, lastChangeTime);
          MsgHandler.postLayoutResult(panel, layoutJsonStr);
          console.timeEnd('layout总耗时');
        });
      } else {
        MsgHandler.postLayoutResult(panel, cache.layout_result);
        console.timeEnd('layout总耗时');
      }
    }
  }

  private static postLayoutResult(panel: any, jsonStr: string) {
    panel.webview.postMessage({
      type: 'postLayoutResult',
      data: JSON.parse(jsonStr),
    });
  }

  static getSubgraph(panel: any, subInfo: { calleehash: string; subFuncmagicname: string; curPath: string; calleeOpMagic?: string; calleeOpSubgraphId?: string }) {
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
    new ComGraphView(ViewColumn.One).createPanel(panel.comGraphData.fsPath, calleehash, subFuncmagicname, curPath, undefined, calleeOpMagic, calleeOpSubgraphId);
  }

  static callInOutTensorMap(panel: any, data: any) {
    const dataMap = new Map(Object.entries(data));
    for (const [k, v] of dataMap) {
      globalCallInOutTensorMap.set(k, v);
    }
  }

  static async jumpToCodeLine(panel: any, data: any) {
    try {
      const uri = Uri.file(data.file);
      const doc = await workspace.openTextDocument(uri);
      const editor = await window.showTextDocument(doc);
      const pos = new Position(data.line - 1, 0);
      editor.selection = new Selection(pos, pos);
      editor.revealRange(new Range(pos, pos));
    } catch (err: any) {
      window.showWarningMessage(`无法打开文件: ${data.file} (${err.message})`);
    }
  }

  static async searchAllFunc(panel: any, data: any) {
    const comGraphData = panel.comGraphData;
    const callHashMap = fileHashMap[comGraphData.fsPath];
    const funcMap = extractFuncMap(callHashMap);
    let result = new Map<string, any>();
    for (const [k, v] of Object.entries(callHashMap)) {
      let comGraphFuncData: any;
      let jsonData: any;
      if (!comGraphData.isUsedDB) {
        // 不用缓存数据库的情况
        jsonData = JSON.parse(comGraphData.dataMap[k]);
      } else {
        comGraphFuncData = await SQLiteCache.getInstance().comGraphFuncDataGet(comGraphData.fsPath, k);

        jsonData = JSON.parse(comGraphFuncData.data);
      }
      if (!jsonData) {
        continue;
      }
      const incasts = extractIncasts(jsonData);
      const outcasts = extractOutcasts(jsonData);
      const rawTensorMap = extractRawTensors(jsonData);
      const tensorMap = extractTensorNodes(jsonData, incasts, outcasts, rawTensorMap);
      const opMap = extractOperationNodes(jsonData);
      const res = searchFunc(data, tensorMap, opMap, rawTensorMap, funcMap);
      if (res.length > 0) {
        result[k] = res;
      }
      // 全局搜索function只需搜索一次
      if (data.category && data.category === 'Function') {
        break;
      }
    }

    if (!data.category) {
      let isReg = data.isReg;
      let isUpper = data.isUpper;
      const resFunction = searchByFunctionFuzz(funcMap, data.searchKey, isUpper, isReg);
      if (resFunction.length > 0) {
        result['totalFunction'] = resFunction;
      }
    }

    panel.webview.postMessage({
      command: 'globalSearchResult',
      data: result,
    });
  }

  static async readHealthyJson(fsPath: string) {
    let result: any = {};
    return new Promise((resolve, reject) => {
      const pipeline = createReadStream(fsPath).pipe(parser()).pipe(streamValues());
      pipeline
        .on('data', (data: any) => {
          result = data.value;
        })
        .on('end', () => {
          if (!Object.keys(result).length) {
            resolve(null);
          } else {
            resolve(result);
          }
        })
        .on('error', (err: any) => {
          console.error('Error parsing healthy stream:', err);
        });
    });
  }

  static async getHealthyReport(panel: any) {
    const report = {};
    const filePath = panel?.comGraphData?.fsPath || null;
    if (filePath === null) {
      panel.webview.postMessage({
        command: 'returnHealthyReport',
        data: undefined,
      });
    }

    const tensorFile = filePath.replace(/\.json$/, '_TensorGraphHealthReport.json');
    const tileFile = filePath.replace(/\.json$/, '_TileGraphHealthReport.json');
    const executeFile = filePath.replace(/\.json$/, '_ExecuteGraph_Health_Report.json');
    const kernelFile = filePath.replace(/\.json$/, '_Kernel_Graph_Health_Report.json');

    if (!existsSync(tensorFile)) {
      report['TensorGraph'] = null;
    } else {
      report['TensorGraph'] = await this.readHealthyJson(tensorFile);
    }

    if (!existsSync(tileFile)) {
      report['TileGraph'] = null;
    } else {
      report['TileGraph'] = await this.readHealthyJson(tileFile);
    }

    if (!existsSync(executeFile)) {
      report['ExecuteGraph'] = null;
    } else {
      report['ExecuteGraph'] = await this.readHealthyJson(executeFile);
    }

    if (!existsSync(kernelFile)) {
      report['KernelGraph'] = null;
    } else {
      report['KernelGraph'] = await this.readHealthyJson(kernelFile);
    }

    panel.webview.postMessage({
      command: 'returnHealthyReport',
      data: report,
    });
  }
}

export class ComGraphView {
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
      type: 'comItemDetailView',
      column: column,
      options: { enableScripts: true, retainContextWhenHidden: true },
    };
  }

  async createPanel(
    fsPath: string,
    funcHash: string | undefined,
    magicName: string | undefined,
    curPath: string | undefined,
    panel = undefined,
    calleeOpMagic?: string, 
    calleeOpSubgraphId?: string, 
  ) {
    if (panel) {
      this.panel = panel;
      this.title = this.panel.title;
    } else {
      this.title = magicName || basename(fsPath);
      this.panel = window.createWebviewPanel(this.createArg.type, this.title, this.createArg.column, this.createArg.options);
    }
    this.panel.msgHandler = this.msgHandler;
    this.panel.comGraphData = new ComGraphData(fsPath, funcHash, calleeOpMagic, calleeOpSubgraphId);
    this.panel.curPath = curPath;
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
      .replace(/{{ascTheme}}/g, getIDETheme());
    this.panel.webview.html = new Util().replaceHtmlFromData(replaceParams, html);
    /* 本地调试方案 */
    // this.panel.webview.html = this.getDebugHtml(getIDETheme());
  }

  public static revive(panel, fsPath: string, funcHash: string | undefined, magicName: string | undefined, curPath: string | undefined) {
    new ComGraphView(ViewColumn.One).createPanel(fsPath, funcHash, magicName, curPath, panel);
  }

  getDebugHtml(theme: string) {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <link rel="icon" href="/favicon.ico">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script>
              window.ascTheme = '${theme}';
            </script>
            <script type="module" src="http://localhost:5173/src/main.ts"></script>
            <title>Vite App</title>
            <link rel="stylesheet" href="http://localhost:5173/src/static-assets/icomoon/devui-icon.css" >
            <link rel="stylesheet" href="http://localhost:5173/src/static-assets/codicon/codicon.css" >
        </head>
        <body>
            <div id="app"></div>

            <script>
            window.vscode = acquireVsCodeApi && acquireVsCodeApi();
            window.staticPath = "http://localhost:5173/src";
            </script>
        </body>
        </html>
        `;
  }

  onDispose() {
    this.panel = null;
    this.closeWebViewPanel();
    const webviews: any = hismartliteEx.webviews;
    delete webviews[this.title];
    // clear parent in out tensor map when all webview closed.
    if (Object.keys(webviews).length <= 0) {
      globalCallInOutTensorMap.clear();
    }
  }

  closeWebViewPanel() {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}

function extractOutcasts(jsonData) {
  const outcasts = {};
  if (jsonData.outcasts) {
    jsonData.outcasts.forEach((item, index) => {
      const key = item[0];
      outcasts[key] = index;
    });
  }
  return outcasts;
}

function extractIncasts(jsonData) {
  const incasts = {};
  if (jsonData.incasts) {
    jsonData.incasts.forEach((item, index) => {
      const key = item[0];
      incasts[key] = index;
    });
  }
  return incasts;
}

function extractRawTensors(jsonData) {
  const rawtensorMap = {};
  if (jsonData.rawtensors) {
    jsonData.rawtensors.forEach((rawtensor) => {
      rawtensorMap[rawtensor.rawmagic] = rawtensor;
    });
  }
  return rawtensorMap;
}

function extractOperationNodes(jsonData) {
  const opMap = {};
  if (jsonData && jsonData.operations && Array.isArray(jsonData.operations)) {
    jsonData.operations.forEach((operation, index) => {
      const subgraphId = operation.subgraphid !== undefined ? operation.subgraphid : -1;

      if (!opMap[subgraphId]) {
        opMap[subgraphId] = {};
      }

      operation['node_id'] = `operation-${index}-magic-${operation.opmagic}-${subgraphId}`;
      operation['subgraphid'] = subgraphId;
      operation['node_type'] = 'operation';
      opMap[operation.subgraphid][operation.opmagic] = operation;
    });
  }
  return opMap;
}

function extractTensorNodes(jsonData, incasts, outcasts, rawtensorMap) {
  const tensorMap = {};
  if (jsonData && jsonData.tensors && Array.isArray(jsonData.tensors)) {
    jsonData.tensors.forEach((tensor) => {
      const subgraphId = tensor.subgraphid !== undefined ? tensor.subgraphid : -1;

      if (!tensorMap[subgraphId]) {
        tensorMap[subgraphId] = {};
      }

      tensor['node_id'] = `tensor-${tensor.magic}-${subgraphId}`;

      tensor['subgraphid'] = subgraphId;
      tensor['node_type'] = 'tensor';
      tensor['rawtensor_info'] = rawtensorMap[tensor.rawtensor];

      tensorMap[tensor.subgraphid][tensor.magic] = tensor;
    });
  }
  return tensorMap;
}

function extractFuncMap(calleehash) {
  const funcMap = {};
  Object.entries(calleehash as Record<string, any>).forEach(([hash, item]) => {
    const funcNode = {};
    funcNode['func_magicname'] = item.func_magicname;
    funcNode['node_type'] = 'function';
    funcNode['hash'] = hash;
    funcMap[hash] = funcNode;
  });
  return funcMap;
}

function searchByTensorMagic(tensorMap, magic) {
  return Object.values(tensorMap as Record<string, any>)
    .map((subgraph) => subgraph[magic])
    .filter(Boolean);
}

function searchByOperationMagic(operationMap, magic) {
  return Object.values(operationMap as Record<string, any>)
    .map((subgraph) => subgraph[magic])
    .filter(Boolean);
}

function searchBySubgraphid(tensorMap, operationMap, subgraphid) {
  return [
    ...(tensorMap[subgraphid] ? Object.values(tensorMap[subgraphid]) : []),
    ...(operationMap[subgraphid] ? Object.values(operationMap[subgraphid]) : []),
  ];
}

function searchByRawTensorMagic(tensorMap, rawtensormagic) {
  return Object.values(tensorMap)
    .flatMap((subgraph) => Object.values(subgraph as Record<string, any>))
    .filter((tensor) => tensor.rawtensor == rawtensormagic);
}

function searchByTensorSemanticLabel(tensorMap, semantic_label) {
  return Object.values(tensorMap)
    .flatMap((subgraph) => Object.values(subgraph as Record<string, any>))
    .filter((tensor) => tensor.semantic_label && tensor.semantic_label == semantic_label);
}

//FuzzSearch
function searchByFunctionHash(functionMap, hash, isUpper = false, isReg = false) {
  let reg: RegExp | null = null;
  if (isReg) {
    try {
      reg = new RegExp(hash, 'i');
    } catch {
      reg = null;
    }
  }
  if (reg) {
    return Object.entries(functionMap)
      .filter(([funcHash]) => reg.test(funcHash))
      .map(([, value]) => value);
  }
  return Object.entries(functionMap)
    .filter(([funcHash]) => funcHash.includes(hash))
    .map(([, value]) => value);
}

//FuzzSearch
function searchByFunctionName(functionMap, name, isUpper = false, isReg = false) {
  let reg: RegExp | null = null;
  if (isReg) {
    try {
      reg = new RegExp(name, 'i');
    } catch {
      reg = null;
    }
  }
  if (reg) {
    return Object.values(functionMap as Record<string, any>).filter((item) => reg.test(item.func_magicname));
  }
  if (isUpper) {
    return Object.values(functionMap as Record<string, any>).filter((item) => {
      return item.func_magicname.includes(name);
    });
  }
  let lowerName = name.toLowerCase();
  return Object.values(functionMap as Record<string, any>).filter((item) => item.func_magicname.toLowerCase().includes(lowerName));
}

//for list of Objects, deduplicate by key
const uniqueByKey = (arr, key) => [...new Map(arr.map((it) => [it[key], it])).values()];

function searchByFunctionFuzz(funcMap, keyword, isUpper = false, isReg = false) {
  let res = [...searchByFunctionHash(funcMap, keyword, isUpper, isReg), ...searchByFunctionName(funcMap, keyword, isUpper, isReg)];
  return uniqueByKey(res, 'hash');
}

//search keyword in each node's each field
function searchFuzzy(tensorMap, operationMap, rawtensorMap, funcMap, keyword, type, isUpper = false, isReg = false) {
  let reg: RegExp | null = null;
  if (isReg) {
    try {
      reg = new RegExp(keyword, 'i');
    } catch {
      reg = null;
    }
  }

  const isMatch = (obj) => {
    return Object.values(obj).some((value) => {
      if (value && typeof value === 'object') {
        //recursive check
        return isMatch(value);
      }
      const str = String(value);
      if (isUpper) {
        return str.includes(keyword);
      }
      return reg ? reg.test(str) : str.toLowerCase().includes(keyword.toLowerCase());
    });
  };

  const searchMap = (map) =>
    Object.values(map)
      .flatMap((subgraph) => Object.values(subgraph as Record<string, any>))
      .filter((element) => isMatch(element));

  switch (type) {
    case 'Tensor':
      return [...searchMap(tensorMap)];
    case 'Operation':
      return [...searchMap(operationMap)];
    case 'Subgraph':
      return searchBySubgraphid(tensorMap, operationMap, keyword);
    case 'Rawtensor':
      let rawmagics = Object.entries(rawtensorMap)
        .filter(([key, value]) => isMatch(value))
        .map(([key]) => key);
      let aaa = rawmagics.flatMap((rawmagic) => searchByRawTensorMagic(tensorMap, rawmagic));
      return rawmagics.flatMap((rawmagic) => searchByRawTensorMagic(tensorMap, rawmagic));
    case 'Function':
      return searchByFunctionFuzz(funcMap, keyword, isUpper, isReg);
    default:
      return [...searchMap(tensorMap), ...searchMap(operationMap)];
  }
}

function searchFunc(e, tensorMap, opMap, rawTensorMap, funcMap) {
  let res;
  let isReg = e.isReg;
  let isUpper = e.isUpper;
  if (!e.category || e.category === '') {
    res = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap, e.searchKey, '', isUpper, isReg);
  } else {
    let isFuzz = false;
    if (!e.option) {
      isFuzz = true;
    }
    switch (e.category) {
      case 'Function':
        if (isFuzz) {
          res = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap, e.searchKey, 'Function', isUpper, isReg);
        } else if (e.option == 'hash') {
          res = searchByFunctionHash(funcMap, e.searchKey, isUpper, isReg);
        } else if (e.option == 'name') {
          res = searchByFunctionName(funcMap, e.searchKey, isUpper, isReg);
        }
        break;
      case 'Tensor':
        if (isFuzz) {
          res = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap, e.searchKey, 'Tensor', isUpper, isReg);
        } else if (e.option == 'magic') {
          res = searchByTensorMagic(tensorMap, e.searchKey);
        } else if (e.option == 'semantic_label') {
          res = searchByTensorSemanticLabel(tensorMap, e.searchKey);
        } else {
          console.log('Tensor search failed');
        }
        break;
      case 'Rawtensor':
        if (isFuzz) {
          res = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap, e.searchKey, 'Rawtensor', isUpper, isReg);
        } else if (e.option == 'magic') {
          res = searchByRawTensorMagic(tensorMap, e.searchKey);
        } else {
          console.log('Rawtensor search failed');
        }
        break;
      case 'Subgraph':
        if (isFuzz) {
          res = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap, e.searchKey, 'Subgraph', isUpper, isReg);
        } else if (e.option == 'id') {
          res = searchBySubgraphid(tensorMap, opMap, e.searchKey);
        } else {
          console.log('Subgraph search failed');
        }
        break;
      case 'Operation':
        if (isFuzz) {
          res = searchFuzzy(tensorMap, opMap, rawTensorMap, funcMap, e.searchKey, 'Operation', isUpper, isReg);
        } else if (e.option == 'magic') {
          res = searchByOperationMagic(opMap, e.searchKey);
        } else {
          console.log('operation search failed');
        }
        break;
    }
  }
  return res;
}

async function getSubHash(curHash, comGraphData) {
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

async function generateFucTree(hash, comGraphData) {
  const node = {};
  const children = await getSubHash(hash, comGraphData);

  if (!Array.isArray(children)) {
    return node;
  }

  for (const child of children) {
    node[child] = await generateFucTree(child, comGraphData);
  }

  return node;
}
