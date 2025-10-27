import { Uri, ViewColumn, commands, window, WebviewPanel, workspace, ConfigurationTarget } from 'vscode';
import { hismartliteEx } from '../hismarliteEx';
import { Util } from '../util';
import { dirname, join, extname, resolve } from 'path';
import { createReadStream, existsSync, readFileSync, readdirSync} from 'fs';
import { t } from 'i18next';
import { getIDETheme } from '../theme';
import { parser } from 'stream-json';
import Chain from 'stream-chain'
import StreamArray from 'stream-json/streamers/StreamArray';
import Filter from 'stream-json/filters/Filter';
import { parsePmuInfo, parseSwimLaneInfo } from '../process';
import { getIDELang } from '../lang';

class SwimData {

  public uri: string;
  public fsPath: string;

  constructor(uri: string, fsPath: string) {
    this.uri = uri;
    this.fsPath = fsPath;
  }
}

class MsgHandler {

  static cachePath: string;

  static getInitialData(panel: any) {
    panel.webview.postMessage({
      command: 'returnSwim',
      data: {},
    });
    panel.webview.postMessage({
      command: 'returnTheme',
      data: getIDETheme(),
    });
  }

  static getSwimLaneFile(fsPath: string): Promise<Object> {
    console.log('swimLanePath', fsPath);
    const streamArray = new StreamArray();

    const streamChain = new Chain([
      createReadStream(fsPath),
      parser(),
      new Filter({
        filter: (token: any) => {
          return token.path?.[0] == 'traceEvents';
        }
      }),
      streamArray
    ]);

    const result: { traceEvents: any[] } = { traceEvents: []};
    return new Promise( (resolve) => {
      streamChain
        .on('data', (ele: any) => {
          result.traceEvents.push(ele.value);
        })
        .on('end', () => {
          resolve(result);
          console.log('readFileAndSetCache 文件读取&缓存完毕');
        })
        .on('error', (err: any) => {
          console.error('Error parsing stream:', err);
        });
    });
  }

  // 获取json信息和绑定的计算图文件路径
  static async getSwimData(panel: any) {
    const swimUri = panel.swimData.uri;
    const swimPath = panel.swimData.fsPath;
    MsgHandler.cachePath = Util.getCachePath();
    const cache = Util.readSwim2ComGraphMap(MsgHandler.cachePath);
    const comGraphPath = cache[swimPath];
    const colorRending = cache['colorRending'] ?? 'subGraph';
    const textRending = cache['textRending']?.length === 0 ? ['taskName', 'taskLabel'] : cache['textRending'] ??  ['taskName', 'taskLabel'];
    const config = Util.getSwimGraphCustomCfg();
    config['colorRending'] = colorRending;
    config['textRending'] = textRending;

    const pmuPath = resolve(dirname(swimPath), 'tilefwk_prof_pmu.csv');
    let pmuData = '';
    try {
      pmuData = readFileSync(pmuPath, 'utf8');
      console.log('读取pmu文件');

    } catch (err) {
      console.error('读取pmu文件时发生错误:', err);
    }
    let pmuInfo = {};
    if (pmuData != '') {
      pmuInfo = parsePmuInfo(pmuData);
    }

    let swimStr = '';
    try {
      swimStr = readFileSync(swimPath, 'utf8');
      console.log('读取merged_swimlane.json文件');

    } catch (err) {
      console.error(`${swimPath}读取swimlane文件时发生错误:`, err);
    }
    const task2topo = {};
    const dynTopoPath = join(dirname(swimPath), 'dyn_topo.txt');
    try {
      const dynTopoContent = readFileSync(dynTopoPath, 'utf-8');
      const dynTopoLines = dynTopoContent.split('\n').slice(1);
      for (const line of dynTopoLines) {
        const curLine = line.split(',');
        if (curLine.length >= 10) {
          const seqNo = curLine[0];
          const taskId = curLine[1];
          const leafIndex = curLine[5];
          const successors = curLine.slice(9)
                                    .map(item => item.trim())
                                    .filter(item => item !== '')
                                    .map(item => `${seqNo}-${item}`);
          task2topo[`${seqNo}-${taskId}`] = { leafIndex, successors };
        }
      } 
    } catch (error) {
      console.log('读取dyn_topo.txt发生错误',error);
    } 
    const swimDataObj = JSON.parse(swimStr);
    const swimData: any = await parseSwimLaneInfo(swimDataObj, pmuInfo, task2topo, colorRending);
    swimData.lane2line = Object.fromEntries(swimData.lane2line);
    swimData.processes = Object.fromEntries(swimData.processes);
    swimData.processExpanded = Object.fromEntries(swimData.processExpanded);

    for (const key in swimData.processes) {
      swimData.processes[key].threads = Object.fromEntries(swimData.processes[key].threads);
    }
    panel.webview.postMessage({
      command: 'returnSwimData',
      data: swimData,
      configration: config,
      comGraphPath,
      swimPath,
    });
    console.log('returnSwimData message send');
  }

  // 绑定计算图文件
  static async bindComGraphJson(panel: any) {
    const swimPath = panel.swimData.fsPath;

    const uris = await window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'JSON Files': ['json'],
        'All Files': ['*']
      },
      title: t('pypto.selectComGraph') || '',
    });
    if (!uris || uris.length === 0) {
      panel.webview.postMessage({
        command: 'bindResult',
        success: false,
        message: t('pypto.noFileSelect')
      });
      return;
    }

    const comGraphUri = uris[0];
    const comGraphPath = comGraphUri.fsPath;
    const cache: any = Util.readSwim2ComGraphMap(MsgHandler.cachePath);
    cache[swimPath] = comGraphPath;
    Util.writeSwim2ComGraphMap(MsgHandler.cachePath, cache);

    panel.webview.postMessage({
      command: 'bindResult',
      success: true,
      message: t('pypto.optSucc'),
      comGraphPath,
    });
    window.showInformationMessage(t('pypto.optSucc'));
    return comGraphPath;
  }

  // 解绑计算图路径
  static async unbindComGraph(panel: any) {
    const swimPath = panel.swimData.fsPath;

    const cache = Util.readSwim2ComGraphMap(MsgHandler.cachePath);

    if (!cache[swimPath]) {
      panel.webview.postMessage({
        command: 'unbindResult',
        success: false,
        message: t('pypto.noBinding'),
      });
      return;
    }

    delete cache[swimPath];
    Util.writeSwim2ComGraphMap(MsgHandler.cachePath, cache);

    panel.webview.postMessage({
      command: 'unbindResult',
      success: true,
      message: t('pypto.optSucc'),
    });

    window.showInformationMessage(t('pypto.optSucc'));
  }

  // 跳转至计算图
  static async jumpToComGraph(panel: any, paramObj: { hash: string }) {
    const swimPath = panel.swimData.fsPath;

    const cache = Util.readSwim2ComGraphMap(MsgHandler.cachePath);
    let comGraphPath = cache[swimPath];
    if (!comGraphPath) {
      // 在用户未配置计算图时，优先找同级目录的计算图
      const swimDir = dirname(swimPath);
      const programPath = join(swimDir, 'program.json');
      if (existsSync(programPath)) {
        comGraphPath = programPath;
        cache[swimPath] = comGraphPath;
        Util.writeSwim2ComGraphMap(MsgHandler.cachePath, cache);
        panel.webview.postMessage({
          command: 'bindResult',
          success: true,
          message: t('pypto.optSucc'),
          comGraphPath,
        });
        window.showInformationMessage(t('pypto.optSucc'));
      } else {
        comGraphPath = await MsgHandler.bindComGraphJson(panel);
      }  
    }
    if (!comGraphPath) {
      panel.webview.postMessage({
        command: 'bindResult',
        success: false,
      });
      window.showWarningMessage(t('pypto.noBinding'));
      return;
    }

    commands.executeCommand('PyPTO.OpenComGraphByFunchash', Uri.file(comGraphPath), paramObj.hash);
  }

  // 打开计算图文件
  static openBoundComGraph(panel: any) {
    const swimPath = panel.swimData.fsPath;

    const cache = Util.readSwim2ComGraphMap(MsgHandler.cachePath);
    const comGraphPath = cache[swimPath];

    if (!comGraphPath) {
      // 未绑定
      window.showWarningMessage(t('pypto.noBinding'));
      return;
    }

    if (!existsSync(comGraphPath)) {
      window.showErrorMessage(`${t('pypto.fileNodeExist')}: ${comGraphPath}`, t('unbind')).then((res: string | undefined) => {
        if (res === t('unbind')) {
          MsgHandler.unbindComGraph(panel);
        }
      });
      return;
    }

    const comGraphUri = Uri.file(comGraphPath);
    commands.executeCommand('vscode.open', comGraphUri);
  }

  // 根据rawmagic跳转dump_tensor，ascendHint示例：Task:[10-54-18], rootIndex:1, psIdInStatic:0, func:xxx
  static jumpRawMagic(panel: any, paramObj: { rawmagic: number, ascendHint: string }) {
    const { rawmagic, ascendHint } = paramObj;
    const swimPath = panel.swimData.fsPath;
    const swimDir = dirname(swimPath);

    const match = ascendHint.match(/Task:\[(\d+(?:-\d+)*)\]/);
    if (!match) {
      window.showErrorMessage(t('pypto.taskInvalid'));
      return;
    }

    const taskNo = match[1];
    const taskId = taskNo.split('-')[0];
    const seqDir = join(swimDir, 'dump_tensor', `seqNo-${taskId}`);
    if (!existsSync(seqDir)) {
      window.showWarningMessage(t('pypto.seqDirNotFound', { seqDir }), t('pypto.confirm'));
      return;
    }

    const rawmagicStr = rawmagic.toString();
    const exactFileName = `${taskNo}-${rawmagicStr}.txt`;
    const exactFilePath = join(seqDir, exactFileName);

    let targetFile: string | null = null;

    if (existsSync(exactFilePath)) {
      targetFile = exactFilePath;
    } else {
      try {
        const prefixPattern = `${taskNo}-${rawmagicStr}-`;
        const files = readdirSync(seqDir);

        for (const file of files) {
          if (extname(file).toLowerCase() === '.txt' && file.startsWith(prefixPattern)) {
            targetFile = join(seqDir, file);
            break;
          }
        }
      } catch (err) {
        window.showErrorMessage(t('pypto.readDirFailed', { seqDir, error: (err as Error).message }), t('pypto.confirm'));
        return;
      }
    }

    if (targetFile) {
      workspace.openTextDocument(targetFile)
        .then((doc: any) => {
          window.showTextDocument(doc, { preview: false });
        })
    } else {
      window.showInformationMessage(t('pypto.fileNotFound', { seqDir, rawmagic, exactFileName, taskNo, rawmagicStr }), t('pypto.confirm'));
    }
  }

  // 提示信息
  static async showMessage(panel: any, paramObj: { text: string }) {
    window.showInformationMessage(paramObj.text);
  }
  // 保存全局配置
  static async saveRendingMode(panel: any, paramObj: string) {
    Util.writeSwimConfigMap(MsgHandler.cachePath, paramObj);
  }
  static async changeUserCfgConnection(panel: any, paramObj: {level: number}) {
    const config = workspace.getConfiguration('PyPTOToolkit');
    config.update('connectionLevel', paramObj.level, ConfigurationTarget.Global);
  }
}

export class SwimGraphView {
  public title: string;
  public isReveal: boolean;
  public msgHandler: any;
  public _disposables: any[];
  public panel: any;

  constructor(panel: WebviewPanel, uri: Uri) {
    this.title = 'Swim Lane Graph';
    this.isReveal = false;
    this._disposables = [];

    this.panel = panel;
    this.panel.swimData = new SwimData(this.panel.webview.asWebviewUri(uri).toString(), uri.fsPath);
    this.panel.msgHandler = MsgHandler;

    this.initWebViewPanel();

    const context: any = hismartliteEx.context;
    this.panel.onDidDispose(
      () => {
        this.panel = null;
        this.onDispose();
      },
      null,
      context.subscriptions
    );
    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        const panel: any = this.panel;
        if (panel.msgHandler[message.command]) {
          panel.msgHandler[message.command](panel, message.paramObj);
        }
      },
      undefined,
      this._disposables
    );
  }

  public static createPanel(uri: Uri) {
    const titleNameMatch = uri.path.match(/\/([^\/]+)\.json$/);
    let titleName = "Swim Lane default";
    if (titleNameMatch) {
      titleName = titleNameMatch[1];
    }
    const panel = window.createWebviewPanel(
      'swimLane',
      titleName,
      ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      },
    );
    new SwimGraphView(panel, uri);

    window.onDidChangeActiveColorTheme(() => {
       panel.webview.postMessage({
        command: 'returnTheme',
        data: getIDETheme(),
      });
    });
  }

  public static revive(panel: WebviewPanel, uri: Uri) {
    new SwimGraphView(panel, uri);
  }

  private async refreshPanel() {
    if (this.panel) {
      if (this.panel.title === this.title) {
        await this.msgHandler.refreshDetail(this.panel);
      } else {
        await this.initWebViewPanel();
      }
      this.panel.title = this.title;
    }
  }

  initWebViewPanel() {
    let replaceParams: any[] = [];
    const htmlPath = join(hismartliteEx.extensionPath, 'webview-dist', 'index.html');
    let documentText = readFileSync(htmlPath);
    let webviewText = this.panel.webview.asWebviewUri(Uri.file(join(hismartliteEx.extensionPath)));
    let html = documentText.toString()
      .replace(/{{root}}/g, webviewText)
      .replace(/{{staticPath}}/g, `${webviewText}/webview-dist`)
      .replace(/{{ascTheme}}/g, getIDETheme())
      .replace(/{{ascLang}}/g, getIDELang());
    this.panel.webview.html = new Util().replaceHtmlFromData(replaceParams, html);
  }

 private onDispose() {
    this.panel = null;
    this.closeWebViewPanel();
  }

 private closeWebViewPanel() {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}



