<template>
  <div class="com-graph-container">
    <ComGraphHeader @onLocate="onLocate" :showType="showType" :outputDirPath="outputDirPath" :pathName="pathName"
      :passIndex="passIndex" :fileName="fileName" :is-loading="isLoading" :graph-type="graphType"
      :openMode="props.openMode"></ComGraphHeader>
    <div :style="{
      backgroundImage: 'url(' + svgPath + ')',
      backgroundRepeat: 'repeat',
      height: '100%',
      cursor: isDragging ? 'grabbing' : 'auto'
    }">
      <div id="sprotty"></div>
    </div>
    <div class="lock-information" v-if="switchLockInformationFlag">
      <div class="lock-information-item">{{lockText}}，{{ t('comGraph.pressEscExit') }}</div>
    </div>

    <ShowTip></ShowTip>
    <ComGraphMinimap
      :offset-right="minimapOffsetRight"
    ></ComGraphMinimap>
    <HealthReport v-model="showHealthReport" @onLocate="onLocate" @locateSubgraph="onLocateSubgraph" @open="(e) => (healthReportGraphName = e)" />
    <NodeDetail v-model="showNodeDetail" :node-id="nodeId" :json-content="props.jsonContent" />
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
    <LayerControl v-model="showLayerControl" @graph-layout-change="(e) => setDirection(e)" @node-display-change="(e) => nodeDisplayConfig(e)" @select-nodes-change="(e) => hoverFeedbackAction(e)" />
    <LeafCalledRecord v-model="showLeafCalledRecord" :called-map="leafCalledRecordMap" :leaf-name="currentLeafName" />
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, defineProps, ref, provide, inject, computed, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphHeader from './comGraphHeader.vue';
import ComGraphMinimap from './comGraphMinimap.vue';
import HealthReport from './healthReport/healthReport.vue';
import NodeDetail from './nodeDetail/nodeDetail.vue';
import Loading from './loading.vue';
import LayerControl from './layerControl/layerControl.vue';
import LeafCalledRecord from './leafCalledRecord.vue';
import { comGraphStore } from '../../service/com-graph-store';
import { setFixedComGraphFlow } from '../../utils/operation';
import { Message } from 'vue-devui/message';
import ShowTip from '../util/showTip.vue';
import { useViewServer } from '../../core/use-view-server';
import type { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { ComGraphProvideKey } from './type';

const { server } = useViewServer<IComViewServer>();
const { t } = useI18n();
const props = defineProps({
  jsonContent: {
    type: Object,
    default: {}
  },
  loadingStep: {
    type: String,
    default: ''
  },
  openMode: {
    type: String,
    default: 'all'
  },
  nodeMagic: {
    type: Number,
    default: -1
  },
  outputDirPath: {
    type: String,
    default: ''
  },
  passIndex: {
    type: String,
    default: ''
  },
  pathName: {
    type: String,
    default: ''
  },
  fileName: {
    type: String,
    default: ''
  }
});

const { isDarkTheme } = inject('root');
const showHealthReport = ref(false);
const showNodeDetail = ref(false);
const showLayerControl = ref(false);
const showLeafCalledRecord = ref(false);
const nodeId = ref('');
const isLoading = ref(false);
const loadingText = ref('');
const warningText = ref('');
const healthReportGraphName = ref('');
const showType = ref('all');
const graphType = ref('');
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
const isDragging = ref(false);
const switchLockInformationFlag = ref(false);
const leafCalledRecordMap = ref<Record<string, number>>({});
const currentLeafName = ref('');
const minimapOffsetRight = computed(() => {
  if (showNodeDetail.value || showLeafCalledRecord.value) {
    return 480;
  } else if (showHealthReport.value) {
    return healthReportGraphName.value === 'BlockGraph' ? 488 : 400;
  } else {
    return 0;
  }
})
let lockText= '';

let fitToScreenAction;
let initComDocText;
let colorBySubGraph;
let updateGraph;
let centerNodeAction;
let selectAction;
let getSelectedNodeId;
let resetModelSource;
let hoverFeedbackAction;
let setDirection: (direction: 'RIGHT' | 'DOWN') => void;


const fitToScreen = () => {
  fitToScreenAction();
}

const nodeDisplayConfig = (type: 'op' | 'all') => {
  updateGraph(isDarkTheme.value, {
    showTensorNodes: type === 'op' ? false : true,
    openMode: props.openMode, nodeMagic: props.nodeMagic
  })
  showType.value = type;
}

function isNodeInTrace(nodeId: string): boolean {
  if (!comGraphStore.data.inFixedComGraphFlow && !comGraphStore.data.unVisibleOtherNodes) {
    return true;
  }

  const fixedNodeId = comGraphStore.data.fixedNodeId;
  let nodesList;

  if (!fixedNodeId) {
    nodesList = [...comGraphStore.data.pathNodesSet].map(item => Number(item));
  } else {
    const tracedTensors = comGraphStore.data.traceTensors?.[1];
    const tracedOperations  = comGraphStore.data.traceOperations?.[1];
    const tracedNodes = [...(tracedTensors || []),...(tracedOperations || [])];
    nodesList = tracedNodes;
  }

  if (!nodesList?.length) {
    return true;
  }

  const TensorNodeIdPrefix = 'tensor-';
  const OperationNodeIdPrefix = 'operation-magic-';
  let nodeMagic;
  if (nodeId.includes(OperationNodeIdPrefix)) {
    nodeMagic = parseInt(nodeId.split(OperationNodeIdPrefix)[1]);
  } else if (nodeId.includes(TensorNodeIdPrefix)) {
    nodeMagic = parseInt(nodeId.split(TensorNodeIdPrefix)[1]);
  }
  return nodeMagic && nodesList.indexOf(nodeMagic) !== -1;
}

const onLocate = (id) => {
  if (!isNodeInTrace(id)) {
    (window as any).ascEventBus.emit('message_notice', t('comGraph.searchingNodeUntraced'));
    return;
  }
  centerNodeAction([id]);
  selectAction([id]);
}

const onLocateSubgraph = (ids) => {
  selectAction(ids);
}

const colorSubgraph = (isColor: boolean) => {
  colorBySubGraph(isColor);
}

const toggleHealthReport = (status: boolean) => {
  showHealthReport.value = status;
}
const toggleLeafCalledRecord = (status: boolean, leafName: string) => {
  showLeafCalledRecord.value = status;
  currentLeafName.value = leafName;
}
watch(server.LayoutResult, (newValue) => {
  isLoading.value = false;
  loadingText.value = '';
});

// 获取错误节点信息
watch(server.nodeErrorList, (newValue) => {
  console.log(newValue.data);
});

provide(ComGraphProvideKey, { toggleHealthReport, showLayerControl, leafCalledRecordMap, toggleLeafCalledRecord });

const LoadingStatusMap = {
  readJson: 'comGraph.readJson',
  convertData: 'comGraph.convertData',
  readJsonWarning: 'comGraph.readJsonWarning',
  rendering: 'comGraph.rendering',
};
watch(
  () => props.loadingStep,
  (val) => {
    if (!val) {return;}
    if (val === 'readJson' || val === 'rendering' || val === 'convertData') {
      isLoading.value = true;
    }
    if (val === 'readJsonWarning') {
      isLoading.value = true;
      loadingText.value = t(LoadingStatusMap['readJson']);
      warningText.value = t(LoadingStatusMap[val]);
    } else {
      loadingText.value = t(LoadingStatusMap[val]);
    }
  },
);

watch([() => props.jsonContent, isDarkTheme], ([val]) => {
  if (Object.keys(val).length) {
    graphType.value = typeof val.graphtype !== 'undefined' ? String(val.graphtype) : '';
    const jsonValue = JSON.parse(JSON.stringify(props.jsonContent));
    if (initComDocText){
      initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic);
      comGraphStore.setData('jsonData', jsonValue);
      resetModelSource();
      return;
    }
    const sprottyLoadResult = useSprottyLoad();
    fitToScreenAction = sprottyLoadResult.fitToScreenAction;
    initComDocText = sprottyLoadResult.initComDocText;
    colorBySubGraph = sprottyLoadResult.colorBySubGraph;
    updateGraph = sprottyLoadResult.updateGraph;
    centerNodeAction = sprottyLoadResult.centerNodeAction;
    selectAction = sprottyLoadResult.selectAction;
    getSelectedNodeId = sprottyLoadResult.getSelectedNodeId;
    resetModelSource = sprottyLoadResult.resetModelSource;
    setDirection = sprottyLoadResult.setModelDirection;
    hoverFeedbackAction = sprottyLoadResult.hoverFeedbackAction;
    initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic);
    comGraphStore.setData('jsonData', jsonValue);
  }
}, { immediate: true });

function onMessageNotice(text) {
  Message({
    type:'warning',
    message:text
  });
}
function onViewMouseUp(node) {
  if (node.type === 'graph' || node.id.startsWith('parent')) {
    showNodeDetail.value = false;
  } else if (node.id.endsWith('label-main')) {
    nodeId.value = node.id;
    showNodeDetail.value = true;
  }
}
function onSwitchLockInfo(attr) {
  switchLockInformationFlag.value = attr[0];
  if(attr[1]){
    lockText = t('comGraph.singlePathMode');
  }else{
    lockText = t('comGraph.pathLocked');
  }
}
function onLayoutEnding() {
  isLoading.value = false;
  loadingText.value = '';
}
function onViewMouseDown() {
  isDragging.value = true;
}
function onMouseup() {
  isDragging.value = false;
}
onMounted(() => {
  (window as any).ascEventBus.on('view_mouseup', onViewMouseUp);
  (window as any).ascEventBus.on('message_notice', onMessageNotice);
  (window as any).ascEventBus.on('switchLockInformation', onSwitchLockInfo);
  (window as any).ascEventBus.on('layoutEnding', onLayoutEnding);
  if (props.loadingStep === 'readJson' || props.loadingStep === 'convertData') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
  (window as any).ascEventBus.on('view_mousedown', onViewMouseDown);
  document.addEventListener('mouseup', onMouseup);
});

onBeforeUnmount(() => {
  (window as any).ascEventBus.remove('view_mouseup', onViewMouseUp);
  (window as any).ascEventBus.remove('message_notice', onMessageNotice);
  (window as any).ascEventBus.remove('switchLockInformation', onSwitchLockInfo);
  (window as any).ascEventBus.remove('layoutEnding', onLayoutEnding);
  (window as any).ascEventBus.remove('view_mousedown', onViewMouseDown);
  document.removeEventListener('mouseup', onMouseup);
});

// 统一出口：解除固定
function releaseFixedFlow() {
  setFixedComGraphFlow(false,false);
  switchLockInformationFlag.value = false;
}

// 在 document 上只绑定一次
document.addEventListener('keydown',async (e: KeyboardEvent) => {
  if (e.key === 'Escape' || e.code === 'Escape') {
    e.preventDefault();   // 防止浏览器默认行为（如退出全屏）
    releaseFixedFlow();
  }
  // 2. Ctrl+L  锁定通路并高亮
  if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey &&
    (e.key === 'l' || e.key === 'L')) {
    e.preventDefault();
    const selectedNodeId = await getSelectedNodeId()
    setFixedComGraphFlow(true, false,selectedNodeId);
    if(selectedNodeId && selectedNodeId !='' ){
      switchLockInformationFlag.value = true;
      lockText = t('comGraph.pathLocked');
    }

    return;
  }

  // 3. Ctrl+H  只看当前通路
  if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey &&
    (e.key === 'h' || e.key === 'H')) {
    e.preventDefault();
    const selectedNodeId = await getSelectedNodeId()
    setFixedComGraphFlow(true, true,selectedNodeId);
    if(selectedNodeId && selectedNodeId !='' ){
      switchLockInformationFlag.value = true;
      lockText = t('comGraph.singlePathMode');
    }
    return;
  }

});

</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.com-graph-container {
  width: 100%;
  height: 100vh;
  position: relative;
  background-color: var(--devui-global-bg);

  .com-graph-header {
    position: absolute;
    height: 150px;
    width: 100%;
    top: 0;
    z-index: 10;
  }

  #sprotty {
    height: 100%;
  }
}

.devui-loading {
  .devui-loading__area {
    display: flex;
    align-items: center;
  }
}
</style>
