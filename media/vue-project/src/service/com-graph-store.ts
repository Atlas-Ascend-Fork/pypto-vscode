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
import { reactive } from "vue";
import { SModelRoot } from 'sprotty-protocol';

interface ComGraphConfig {
  isSimple: boolean; // 是否简化模式
  isHoverHighlightNode: boolean; // 是否悬浮高亮节点
  showExtendBtn:boolean; // 是否显示图层控制，健康度报告，差异对比按钮
  canLockPath: boolean; // 是否锁定链路
  canViewNodeDetail: boolean; // 是否支持查看详情
  canViewSubgraph: boolean; // 是否能够下钻子图
}

interface ComGraphData {
  jsonData: Object;
  comGraphNodeData: any;
  calleeMap: any;
  CalleeOpAttrMap: any;
  magicNodeIdMap: Record<number, string>;
  pathNodesSet: any,
  selectCustom: any,
  curPath: any;
  isDiffGraph: boolean;
  comGraphConfig: ComGraphConfig;
  inSelectedComGraphFlow: boolean;
  inFixedComGraphFlow: boolean;
  unVisibleOtherNodes: boolean;
  isNodeRectLock: boolean;
  stableRect:boolean;
  fixedNodeId: string;
  historyPath: string[];
  layoutDirection: string;
  svgExportMode: boolean;
  isCached?: boolean,
  wrongRawMagicList?: any,
  failOpMagicList?: any[],
  failMagicList?: any[],
  nodeCount?: number,
  version: string;
  selectedNodeSemanticLabel: string;
  traceTensors: any[];
  traceOperations: any[];
  searchLevel: string;
  isLeaf: boolean;
  runningNodeId: string; // 内存可视化运行中节点的id
  renderMinimapFunc?: (root?:SModelRoot)=> void;
  centerNodeActionFunc?: (elementIdsPara: string[], animatePara?: boolean, retainZoomPara?: boolean, zoomScalePara?: number)=> void;
  updateModelActionFunc?: ( animate?: boolean, cause?: boolean)=> void;
}

interface DataStore {
  data: ComGraphData;
  setData: (key: string, value: any) => void;
}

export const comGraphStore: DataStore = reactive({
  data: {
    jsonData: '',
    fixedNodeId: '',
    historyPath: [],
    selectedNodeSemanticLabel: '',
    pathNodesSet: [],
    selectCustom: [],
    comGraphNodeData: {},
    calleeMap: {},
    CalleeOpAttrMap: {},
    magicNodeIdMap: {},
    curPath: [],
    version: '2.0',
    isDiffGraph: false,
    isNodeRectLock: false,
    stableRect: false,
    comGraphConfig: {
      isSimple: false,
      isHoverHighlightNode: true,
      showExtendBtn: true,
      canLockPath: true,
      canViewNodeDetail: true,
      canViewSubgraph: true,
    },
    inSelectedComGraphFlow:false,
    inFixedComGraphFlow:false,
    unVisibleOtherNodes:false,
    layoutDirection: 'RIGHT',
    runningNodeId: '',
    svgExportMode: false,
    isLeaf: false,
    isCached: false,
    nodeCount: 0,
  },

  setData(key: string, value: any) {
    this.data[key] = value;
  }
})
