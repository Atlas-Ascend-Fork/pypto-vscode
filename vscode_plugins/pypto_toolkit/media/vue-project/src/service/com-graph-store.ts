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
  layoutDirection: string;
  svgExportMode: boolean;
  isCached?: boolean,
  nodeCount?: number,
  version: string;
  selectedNodeSemanticLabel: string;
  traceTensors: any[];
  traceOperations: any[];
  tensorAttrFunc?: (node) => Array<string>;
  operationAttrFunc?: (node) => Array<string>;
  tensorColorFunc?: (node, list: Array<string>) => string;
  operationColorFunc?: (node, list: Array<string>) => string;
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
    selectedNodeSemanticLabel: '',
    pathNodesSet: [],
    selectCustom: [],
    comGraphNodeData: {},
    calleeMap: {},
    CalleeOpAttrMap: {},
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
    svgExportMode: false,
  },

  setData(key: string, value: any) {
    this.data[key] = value;
  }
})
