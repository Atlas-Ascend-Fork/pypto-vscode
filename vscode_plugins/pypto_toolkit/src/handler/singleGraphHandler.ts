import { BaseGraphMsgHandler } from './baseGraphMsgHandler';
import { SingleGraphData, AbstractGraphData } from '../core/graphData';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';
import { SQLiteCache, getMTime } from '../core/sqliteCache';

export class SingleGraphHandler extends BaseGraphMsgHandler {
  protected static override async loadMainData(panel: any): Promise<void> {
    if (!panel.comGraphData) {
      panel.comGraphData = new SingleGraphData(panel.fsPath, panel.funcHash, panel.calleeOpMagic, panel.calleeOpSubgraphId, panel.outputDirPath, panel.pathName);
    }

    const gd = panel.comGraphData as SingleGraphData;
    if (!gd.funcHash) {
      gd.funcHash = await SingleGraphData.getEntryHash(gd.fsPath);
    }
  }

  protected static override getGraphData(panel: any): AbstractGraphData {
    return panel.comGraphData as SingleGraphData;
  }
  /** 重写 基类方法 */
  protected static override async postInitMessages(panel: any, gd: AbstractGraphData, json: any, isDiff: boolean): Promise<void> {
    /* 主题/语言  保证 前端初始状态 与当前主题一致，避免首帧闪白 */
    panel.webview.postMessage({ command: 'returnTheme', data: getIDETheme() });
    panel.webview.postMessage({ command: 'returnLang', data: getIDELang() });
    /* 设置state 让 VS Code 下次能反序列化 */
    panel.webview.postMessage({ command: 'returnInitData', fsPath: gd.fsPath, funcHash: gd.funcHash, magicName: json.func_magicname, outputDirPath: gd.outputDirPath, pathName: panel.pathName });

    if (!isDiff && gd.calleeOpMagic && gd.calleeOpSubgraphId) {
      let opAttrData;
      let calleeOpAttr: string | undefined;
      let ioperands: string | undefined;
      if (gd.isUsedDB) {
        opAttrData = await SQLiteCache.getInstance().comGraphFileCalleeOpAttrGet(
          gd.funcHash ?? '',
          gd.calleeOpMagic.toString(),
          gd.calleeOpSubgraphId.toString(),
        );
        calleeOpAttr = opAttrData.op_attr;
        ioperands = JSON.parse(opAttrData.ioperands);
      }
      if (calleeOpAttr) {
        panel.webview.postMessage({
          command: 'returnCalleeOpAttrMap',
          data: { calleeOpAttr: calleeOpAttr, opAttrIncastTensors: [...new Set(ioperands)] },
        });
      }
    }

    const funcTree: any = {};
    funcTree[gd.funcHash!] = await this.generateFucTree(gd.funcHash!, gd);
    panel.webview.postMessage({
      command: 'returnFuncTree',
      entry: gd.funcHash,
      fsPath: gd.fsPath,
      curPath: (panel as any).curPath ?? [gd.funcHash],
      data: funcTree,
    });
  }
  protected static override onDidReceiveMessage(panel: any) {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log(`[GraphView Handler] business command: ${message.command} type: ${message.type}`);
        this.CommonMessageActions(message, panel);
        const gd = panel.comGraphData;
        const funcTree: any = {};
        funcTree[gd.funcHash!] = await this.generateFucTree(gd.funcHash!, gd);
        if (message.type === 'getFuncTree') {
          panel.webview.postMessage({
            command: 'returnFuncTree',
            entry: gd.funcHash,
            fsPath: gd.fsPath,
            curPath: (panel as any).curPath ?? [gd.funcHash],
            data: funcTree,
          });
        }
      },
      undefined,
      panel._disposables ?? [],
    );
  }
}
