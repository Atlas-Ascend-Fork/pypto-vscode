// handler/singleGraphHandler.ts
import { BaseGraphMsgHandler } from './baseGraphMsgHandler';
import { SingleGraphData, AbstractGraphData } from '../core/graphData';
import { getIDETheme } from '../theme';
import { getIDELang } from '../lang';
import { SQLiteCache, getMTime } from '../core/sqliteCache';

export class SingleGraphHandler extends BaseGraphMsgHandler {
  protected static async loadMainData(panel: any): Promise<void> {
    console.debug('SingleGraphHandler loadMainData 【开始】');
    // 1. 如果面板还没挂数据，先挂
    if (!panel.comGraphData) {
      console.debug('SingleGraphHandler loadMainData 面板挂数据gd = new SingleGraphData');
      panel.comGraphData = new SingleGraphData(panel.fsPath, panel.funcHash, panel.calleeOpMagic, panel.calleeOpSubgraphId);
    }

    // 2. 计算/补全入口哈希（直接写回实例，不要 return）
    const gd = panel.comGraphData as SingleGraphData;
    if (!gd.funcHash) {
      console.debug('SingleGraphHandler loadMainData gd获取EntryHash');
      gd.funcHash = await SingleGraphData.getEntryHash(gd.fsPath);
    }
    console.debug('SingleGraphHandler loadMainData 【结束】');
  }

  protected static getGraphData(panel: any): AbstractGraphData {
    return panel.comGraphData as SingleGraphData;
  }
  /** 重写 基类方法 */
  protected static async postInitMessages(panel: any, gd: AbstractGraphData, json: any, isDiff: boolean): Promise<void> {
    /* 主题/语言  保证 前端初始状态 与当前主题一致，避免首帧闪白 */
    panel.webview.postMessage({ command: 'returnTheme', data: getIDETheme() });
    panel.webview.postMessage({ command: 'returnLang', data: getIDELang() });

    panel.webview.postMessage({ command: 'returnInitData', fsPath: gd.fsPath, funcHash: gd.funcHash, magicName: json.func_magicname });

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
  protected static onDidReceiveMessage(panel: any) {
    panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log(`[GraphView Handler] business command: ${message.command}`);
        BaseGraphMsgHandler.CommonMessageActions(message, panel);
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
