import { BaseGraphMsgHandler } from './baseGraphMsgHandler';
import { DiffGraphData, AbstractGraphData } from '../core/graphData'; // 具体实现类，非抽象
import { getDiffInfo, getOtherFilePath } from '../util';
import { basename } from 'path';

export class DiffGraphHandler extends BaseGraphMsgHandler {
  /**
   * 1. 把两份图数据挂到面板
   */
  protected static override async loadMainData(panel: any): Promise<void> {
    // 原图
    await DiffGraphHandler.loadGraphData(panel, panel.fsPath, 'comGraphData');
    // 对比图
    panel.otherFsPath = getOtherFilePath(panel.fsPath);
    await DiffGraphHandler.loadGraphData(panel, panel.otherFsPath, 'diffGraphData');
  }

  /**
   * 2. 获取comGraphData
   */
  protected static override getGraphData(panel: any): AbstractGraphData {
    return panel.comGraphData as DiffGraphData;
  }
  protected static getDiffGraphData(panel: any): AbstractGraphData {
    return panel.diffGraphData as DiffGraphData;
  }

  /** 3. 重写 render()，一次性把两份 JSON 都发给前端 */
  protected static override async render(panel: any) {
    console.debug('DiffGraphHandler render 【开始】');
    const gd = this.getGraphData(panel);
    const diffgd = this.getDiffGraphData(panel);
    // 1. 取数据
    const { json } = await this.fetchGraphJson(gd, panel);
    if (!json) {
      this.returnError(panel, 'pypto.parseDataErrorOnOpenComGraph');
      return;
    }
    const { json: diffJson } = await this.fetchGraphJson(diffgd, panel);
    // 组合数据
    const postInfo = getDiffInfo(gd.fsPath, json);
    if (panel.otherFsPath) {
      const otherFileName = basename(panel.otherFsPath).replace('.json', '');
      postInfo.afterFileName = otherFileName;
      postInfo.afterJson = diffJson;
    }
    // 2. 发送初始化消息
    await this.postInitMessages(panel, gd, json, true);

    // 3. 发图包
    await this.postRenderJson(panel, postInfo, 'returnDiffCom');

    console.debug('DiffGraphHandler render 【结束】');
  }

  /** 4. 重写 getInitialData() */
  public static override async getInitialData(panel: any): Promise<void> {
    // 1. 初始化
    this.postForReadJson(panel, 'initDiffComGraph');
    await this.initTheme(panel);
    await this.loadMainData(panel);

    // 2. 校验
    const gd = this.getGraphData(panel);
    if (!this.checkFuncHash(panel, gd, 'pypto.canNotGetFuncHashOnOpenOriginGraph')) return;
    const diffgd = this.getDiffGraphData(panel);
    if (diffgd) {
      if (!this.checkFuncHash(panel, diffgd, 'pypto.canNotGetFuncHashOnOpenComparisonGraph')) return;
    }

    // 3. 缓存判断&读取文件数据
    console.debug('DiffGraphHandler getInitialData 开始读json数据');
    let originIsBigFile = false;
    let diffIsBigFile = false;
    originIsBigFile = await this.getJsonData(gd, panel, originIsBigFile);
    if (diffgd) {
      diffIsBigFile = await this.getJsonData(diffgd, panel, diffIsBigFile);
    }
    // 4. 加载FuncHashMap
    await this.loadFuncHashMap(panel, gd);
    if (diffgd) {
      await this.loadFuncHashMap(panel, gd);
    }
    // 5. 同步渲染
    await this.render(panel);
    // 6. 监听前端消息
    this.onDidReceiveMessage(panel);
  }

  /** 5. 获取comGraphData和EntryHash 并挂到面板上 */
  private static async loadGraphData(panel: any, fsPath: string | undefined, prop: 'comGraphData' | 'diffGraphData') {
    if (!fsPath) return;
    if (!panel[prop]) {
      panel[prop] = new DiffGraphData(fsPath, panel.funcHash);
    }
    const gd = panel[prop] as DiffGraphData;
    if (!gd.funcHash) {
      gd.funcHash = await DiffGraphData.getEntryHash(gd.fsPath);
    }
  }

  /** 6. 重写一些小的父类方法 */
  static override getElkLayoutComGraghData(panel: any, graphData: any, elkFactory: any) {
    if (graphData.layoutOptions['PyPTO.filePath'] === 'before') {
      return panel.comGraphData;
    } else {
      return panel.diffGraphData;
    }
  }

  protected static override postLayoutResult(panel: any, jsonStr: string, filePath?: string) {
    panel.webview.postMessage({
      type: 'postLayoutResult',
      data: JSON.parse(jsonStr),
      filePath,
    });
  }

  static override postJsonGraphData(panel: any, message: any, data: any, isCached: boolean) {
    panel.webview.postMessage({
      type: 'postJsonGraphData',
      data: {
        ...data,
        filePath: message.data.filePath,
      },
      isCached,
    });
  }
}
