import { BaseGraphMsgHandler } from './baseGraphMsgHandler';
import { SingleGraphData, AbstractGraphData } from '../core/graphData';
import { SQLiteCache } from '../core/sqliteCache';
import { t } from 'i18next';

export class SingleGraphHandler extends BaseGraphMsgHandler {
  protected static override async loadMainData(server: any): Promise<boolean> {
    if (!server.comGraphData) {
      server.comGraphData = new SingleGraphData(
        server.query._path,
        server.query.funcHash,
        server.query.calleeOpMagic,
        server.query.calleeOpSubgraphId,
        server.query.outputDirPath,
        server.query.pathName,
        server.query.curPath,
        server.query.magicName,
        server.query.parentInfo
      );
    }

    const gd = server.comGraphData as SingleGraphData;
    if (!server.entryHash) {
      try {
        const { entryhash, version } = await SingleGraphData.getEntryHashAndVersion(gd.fsPath);
        server.entryHash = entryhash;
        gd.version = version;
      } catch (err: any) {
        if (err.code === 'FILE_READ_ERROR') {
          server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.fileRead'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' })
          return false;
        } else if (err.code === 'JSON_PARSE_ERROR') {
          server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.jsonParse'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' })
          return false;
        } else {
          server.setRef('ErrorMessage', { data: t('pypto.comGraph.errorMessage.readJsonUnknown'), log: t('pypto.comGraph.errorLogMessage.error', { logText: err.message }), graphType: 'comGraph' })
          return false;
        }
      }
    }
    if (!gd.funcHash) {
      gd.funcHash = server.entryHash;
    }
    return true;
  }

  protected static override getGraphData(server: any): AbstractGraphData {
    return server.comGraphData as SingleGraphData;
  }
  /** 重写 基类方法 */
  protected static override async postInitMessages(server: any, gd: AbstractGraphData, json: any, isDiff: boolean): Promise<void> {
    /* 主题/语言  保证 前端初始状态 与当前主题一致，避免首帧闪白 */
    this.initTheme(server);


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
        if (opAttrData) {
          calleeOpAttr = opAttrData.op_attr;
          ioperands = JSON.parse(opAttrData.ioperands);
        }
      }
      if (calleeOpAttr) {
        server.setRef('CalleeOpAttrMap', { data: { calleeOpAttr: calleeOpAttr, opAttrIncastTensors: [...new Set(ioperands)] } });
      }
    }
    await SingleGraphHandler.returnFuncTree(server);
  }
  public static async returnFuncTree(server: any) {
    const funcTree: any = {};
    let hash;
    if (server.entryHash) {
      hash = server.entryHash;
    } else {
      hash = server.comGraphData.funcHash;
    };
    funcTree[server.comGraphData.funcHash!] = await this.generateFucTree(hash!, server.comGraphData);
    server.setRef('FuncTree', { entry: server.comGraphData.funcHash, fsPath: server.comGraphData.fsPath, curPath: server.comGraphData.curPath ?? [server.comGraphData.funcHash], data: funcTree });
  }
}
