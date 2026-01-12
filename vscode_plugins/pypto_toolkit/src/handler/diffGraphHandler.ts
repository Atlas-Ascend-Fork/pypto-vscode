import { BaseGraphMsgHandler } from './baseGraphMsgHandler';
import { DiffGraphData, AbstractGraphData } from '../core/graphData'; // 具体实现类，非抽象
import { getDiffInfo, getOtherFilePath } from '../util';
import { basename } from 'path';
import { t } from 'i18next';

export class DiffGraphHandler extends BaseGraphMsgHandler {
  /**
   * 1. 把两份图数据挂到面板
   */
  protected static override async loadMainData(server: any): Promise<boolean> {
    const fsPath = server.query._path;
    // 原图
    await DiffGraphHandler.loadGraphData(server, server.query, fsPath, 'comGraphData');
    // 对比图
    server.query.otherFsPath = getOtherFilePath(fsPath);
    await DiffGraphHandler.loadGraphData(server, server.query, server.query.otherFsPath, 'diffGraphData');
    return true;
  }

  /**
   * 2. 获取comGraphData
   */
  protected static override getGraphData(server: any): AbstractGraphData {
    return server.comGraphData as DiffGraphData;
  }
  protected static getDiffGraphData(server: any): AbstractGraphData {
    return server.diffGraphData as DiffGraphData;
  }

  /** 3. 重写 render()，一次性把两份 JSON 都发给前端 */
  protected static override async render(server: any) {
    console.debug('DiffGraphHandler render 【开始】');
    const gd = this.getGraphData(server);
    const diffgd = this.getDiffGraphData(server);
    // 1. 取数据
    const { json } = await this.fetchGraphJson(gd, server);
    if (!json) {
      this.returnError(server, 'pypto.comGraph.errorMessage.parseDataErrorOnOpenComGraph', {}, 'pypto.comGraph.errorLogMessage.funcHash', { funcHash: gd.funcHash, message: '' });
      return;
    }
    const { json: diffJson } = await this.fetchGraphJson(diffgd, server);
    // 组合数据
    const postInfo = getDiffInfo(gd.fsPath, json);
    if (server.diffGraphData) {
      const otherFileName = basename(server.diffGraphData.fsPath).replace('.json', '');
      postInfo.afterFileName = otherFileName;
      postInfo.afterJson = diffJson;
    }
    // 2. 发送初始化消息
    await this.postInitMessages(server, gd, json, true);

    // 3. 发图包
    await this.postRenderJson(server, postInfo, 'returnDiffCom');

    console.debug('DiffGraphHandler render 【结束】');
  }

  /** 4. 重写 getInitialData() */
  public static override async getInitialData(server: any): Promise<void> {
    // 1. 初始化
    this.postForReadJson(server, 'InitDiffComGraph');
    await this.initTheme(server);
    await this.loadMainData(server);

    // 2. 校验
    const gd = this.getGraphData(server);
    if (!this.checkFuncHash(server, gd, 'pypto.canNotGetFuncHashOnOpenOriginGraph')) return;
    const diffgd = this.getDiffGraphData(server);
    if (diffgd) {
      if (!this.checkFuncHash(server, diffgd, 'pypto.canNotGetFuncHashOnOpenComparisonGraph')) return;
    }

    // 3. 缓存判断&读取文件数据
    console.debug('DiffGraphHandler getInitialData 开始读json数据');
    const oriJsonDataResult = await this.getJsonData(gd, server);
    if (!oriJsonDataResult) return;
    if (diffgd) {
      const diffJsonDataResult = await this.getJsonData(diffgd, server);
      if (!diffJsonDataResult) return;
    }
    // 4. 加载FuncHashMap
    await this.loadFuncHashMap(server, gd);
    if (diffgd) {
      await this.loadFuncHashMap(server, gd);
    }
    // 5. 同步渲染
    await this.render(server);
  }

  /** 5. 获取comGraphData和EntryHash 并挂到面板上 */
  private static async loadGraphData(server: any, query: any, fsPath: string | undefined, prop: 'comGraphData' | 'diffGraphData') {
    if (!fsPath) return;
    if (!server[prop]) {
      server[prop] = new DiffGraphData(fsPath, (prop == 'diffGraphData') ? undefined : query.funcHash);
    }
    const gd = server[prop] as DiffGraphData;
    if (!gd.funcHash) {
      try {
        const { entryhash, version } = await DiffGraphData.getEntryHashAndVersion(gd.fsPath);
        gd.funcHash = entryhash;
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

  }

  /** 6. 重写一些小的父类方法 */
  static override getElkLayoutComGraghData(server: any, graphData: any, elkFactory: any) {
    if (graphData.layoutOptions['PyPTO.filePath'] === 'before') {
      return server.comGraphData;
    } else {
      return server.diffGraphData;
    }
  }

  // 开启对比图时未自动找到after文件，用于单独打开after文件
  public static override async loadDiffData(server: any, otherFsPath: string) {
    server.query.otherFsPath = otherFsPath;
    // 1. 初始化
    await DiffGraphHandler.loadGraphData(server, server.query, server.query.otherFsPath, 'diffGraphData');
    // 2. 校验
    const gd = this.getGraphData(server);
    const diffgd = this.getDiffGraphData(server);
    if (!diffgd) {
      return;
    }
    if (!this.checkFuncHash(server, diffgd, 'pypto.canNotGetFuncHashOnOpenComparisonGraph')) {
      return;
    }
    // 3.读取文件数据
    const jsonContent = await this.getJsonData(diffgd, server);
    if (!jsonContent) {
      return;
    }
    // 4. 加载FuncHashMap
    await this.loadFuncHashMap(server, gd);
    // 5. 解析json并返回
    const otherFileName = basename(server.diffGraphData.fsPath).replace('.json', '');
    const { json } = await DiffGraphHandler.fetchGraphJson(diffgd, server);
    const postInfo = {
      fileName: otherFileName,
      fileContent: json,
    };
    server.setRef('AfterDiffData', postInfo);
  }

  protected static override postLayoutResult(server: any, jsonStr: string, filePath?: string) {
    server.setRef('LayoutResult', { data: JSON.parse(jsonStr), filePath });
  }

  static override postJsonGraphData(server: any, message: any, data: any, isCached: boolean) {
    server.setRef('JsonGraphData', {
      data: {
        ...data,
        filePath: message.data.filePath,
      },
      isCached,
    });
  }
}
