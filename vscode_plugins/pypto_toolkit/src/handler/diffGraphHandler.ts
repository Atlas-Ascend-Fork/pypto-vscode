import { BaseGraphMsgHandler } from './baseGraphMsgHandler';
import { DiffGraphData, AbstractGraphData } from '../core/graphData'; // 具体实现类，非抽象
import { getDiffInfo, getOtherFilePath } from '../util';
import { basename } from 'path';

export class DiffGraphHandler extends BaseGraphMsgHandler {
  /**
   * 1. 把两份图数据挂到面板
   */
  protected static override async loadMainData(server: any): Promise<void> {
    const fsPath = server.query._path;
    // 原图
    await DiffGraphHandler.loadGraphData(server, server.query, fsPath, 'comGraphData');
    // 对比图
    server.query.otherFsPath = getOtherFilePath(fsPath);
    await DiffGraphHandler.loadGraphData(server, server.query, server.query.otherFsPath, 'diffGraphData');
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
      this.returnError(server, 'pypto.parseDataErrorOnOpenComGraph');
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
    let originIsBigFile = false;
    let diffIsBigFile = false;
    originIsBigFile = await this.getJsonData(gd, server, originIsBigFile);
    if (diffgd) {
      diffIsBigFile = await this.getJsonData(diffgd, server, diffIsBigFile);
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
      server[prop] = new DiffGraphData(fsPath, query.funcHash);
    }
    const gd = server[prop] as DiffGraphData;
    if (!gd.funcHash) {
      const {entryhash , version} = await DiffGraphData.getEntryHashAndVersion(gd.fsPath);
      gd.funcHash = entryhash;
      gd.version = version;
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
