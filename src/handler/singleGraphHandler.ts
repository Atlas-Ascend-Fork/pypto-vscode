/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 */
import { BaseGraphMsgHandler } from './baseGraphMsgHandler';
import { SingleGraphData, AbstractGraphData } from '../core/graphData';
import { t } from 'i18next';
import { getComGraphFileCalleeOpAttrStore } from '../core/sqlInit';
import { AscppDagBuilder } from '../core/json-graph/jsonGraph';

export class SingleGraphHandler extends BaseGraphMsgHandler {
  /**
   * sprottyGraph
   */
  static graphLastRenderData: any;

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
        const { entryhash } = await SingleGraphData.getEntryHash(gd.fsPath);
        server.entryHash = entryhash;
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

  public static getGrahpDataExtend(serve: any): AbstractGraphData {
    return this.getGraphData(serve);
  }

  public static override async getSprottyGraphWithLevel(server: any, searchInfo: any) {
    const newNodeMagic = searchInfo.nodeMagic;
    const nodeSearchLevel = searchInfo.searchLevel;
    const { comGraphData, currentData, showTensorNodes, showSyncNodes, colorBySubgraph, isDark, selectedSubgraphId, nodeMagic, version, threeMode } = this.graphLastRenderData;
    const dagBuilder = new AscppDagBuilder(comGraphData, server, version, this.callInOutTensorMap);

    const sprottyGraph = dagBuilder.createSprottyGraph(
      currentData,
      showTensorNodes,
      showSyncNodes,
      colorBySubgraph,
      isDark,
      selectedSubgraphId,
      newNodeMagic ? newNodeMagic : nodeMagic,
      nodeSearchLevel,
    );

    let message = undefined;
    let isCached = false;
    this.postJsonGraphData(server, message, sprottyGraph, isCached);
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

        opAttrData = await getComGraphFileCalleeOpAttrStore().find({
          calleehash: gd.funcHash ?? '',
          opMagic: gd.calleeOpMagic.toString(),
          opSubgraphid: gd.calleeOpSubgraphId.toString(),
        });
        if (opAttrData) {
          calleeOpAttr = opAttrData.op_attr;
          ioperands = JSON.parse(opAttrData.ioperands);
        }
      }
      if (calleeOpAttr) {
        server.setRef('CalleeOpAttrMap', { data: { calleeOpAttr: calleeOpAttr, opAttrIncastTensors: [...new Set(ioperands)] } });
      }
    }
    let entryHash = (server.comGraphData.firstExecFuncHash !== '') ? server.comGraphData.firstExecFuncHash : server.comGraphData.funcHash;
    server.setRef('FuncTree', { entry: entryHash, fsPath: server.comGraphData.fsPath, curPath: server.comGraphData.curPath ?? [entryHash] });
    SingleGraphHandler.returnFuncTree(server);
  }
  public static async returnFuncTree(server: any) {
    const funcTree: any = {};
    let hash;
    let curPath;
    try {
      curPath = JSON.parse(server.comGraphData.curPath);
    } catch {}
    if (curPath?.length > 1) {
      hash = curPath[curPath.length - 2];
    } else if (server.comGraphData.firstExecFuncHash) {
      hash = server.comGraphData.firstExecFuncHash;
    } else if (server.entryHash) {
      hash = server.entryHash;
    } else {
      hash = server.comGraphData.funcHash;
    };
    funcTree[server.comGraphData.funcHash!] = await this.generateFucTree(hash!, server.comGraphData);
    server.setRef('FuncTree', { entry: server.comGraphData.funcHash, fsPath: server.comGraphData.fsPath, curPath: server.comGraphData.curPath ?? [server.comGraphData.funcHash], data: funcTree });
  }
}
