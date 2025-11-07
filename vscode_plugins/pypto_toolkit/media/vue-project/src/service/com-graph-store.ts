import { reactive } from "vue";
import { SModelRoot } from 'sprotty-protocol';

interface ComGraphData {
  jsonData: Object;
  comGraphNodeData: any;
  calleeMap: any;
  CalleeOpAttrMap: any;
  pathNodesSet: any,
  curPath: any;
  isDiffGraph: boolean;
  inSelectedComGraphFlow: boolean;
  inFixedComGraphFlow: boolean;
  visibleOtherNodes: boolean;
  fixedNodeId: string;
  layoutDirection: string;
  svgExportMode: boolean;
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
    pathNodesSet: [],
    comGraphNodeData: {},
    calleeMap: {},
    CalleeOpAttrMap: {},
    curPath: [],
    isDiffGraph: false,
    inSelectedComGraphFlow:false,
    inFixedComGraphFlow:false,
    visibleOtherNodes:false,
    layoutDirection: 'RIGHT',
    svgExportMode: false,
  },

  setData(key: string, value: any) {
    this.data[key] = value;
  }
})
