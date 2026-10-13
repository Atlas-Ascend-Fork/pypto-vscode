<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<template>

  <div class="congraph">
    <d-splitter class="splitter-border" :orientation="orientation" :splitBarSize="splitBarSize" :showCollapseButton="false">
      <template v-slot:DSplitterPane>
        <d-splitter-pane
        >
          <div class="pane-content">
            <div class="com-graph-container">
              <ComGraphHeader ref="headerEl" @onLocate="onLocate" :showType="showType" :outputDirPath="outputDirPath"
                :pathName="pathName" :passIndex="passIndex" :fileName="fileName" :is-loading="isLoading" :graph-type="graphType"
                :openMode="props.openMode" :exist-trace-file="existTraceFile" :show-memory-allocation="showMemoryAllocation"></ComGraphHeader>
              <div :style="{
                backgroundImage: 'url(' + svgPath + ')',
                backgroundRepeat: 'repeat',
                height: '100%',
                cursor: isDragging ? 'grabbing' : 'auto'
              }">
                <div id="sprotty"></div>
              </div>
              <div class="lock-information" v-if="switchLockInformationFlag">
                <div class="lock-information-item">{{ lockText }}，{{ t('comGraph.pressEscExit') }}</div>
              </div>

              <ShowTip></ShowTip>
              <ComGraphMinimap :offset-right="minimapOffsetRight"></ComGraphMinimap>
              <ComGraphReport v-model="showComGraphReport" @onLocate="onLocate" @locateSubgraph="onLocateSubgraph"
                @open="(e) => (healthReportGraphName = e)" @op-magic-click="onOpMagicClick" />
              <NodeDetail v-model="showNodeDetail" :node-id="nodeId" :json-content="props.jsonContent" />
              <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" :waitingFlag="waitingFlag" />
              <LayerControl v-model="showLayerControl" :rightOffset="rightPanelWidth" @graph-layout-change="(e) => setDirection(e)"
                @node-display-change="(e) => nodeDisplayConfig(e)" @select-nodes-change="(e) => hoverFeedbackAction(e)"
                @node-search-level-change="(e) => nodeSearchLevelChange(e)" :openMode="openMode" />
              <LeafCalledRecord v-model="showLeafCalledRecord" :called-map="leafCalledRecordMap" :leaf-name="currentLeafName" />
              <ErrorNode v-if="nodeErrorList?.length" :showType="showType" :jsonContent="props.jsonContent"
                :nodeErrorList="nodeErrorList"></ErrorNode>
            </div>
          </div>
        </d-splitter-pane>
        <d-splitter-pane
          :size="'50%'"
          :minSize="minSize"
          :collapsible="true"
          :resizable="true"
          :maxSize="'67%'"
          ref="splitterPane"
          @sizeChange="sizeChange"
          @collapsedChange="collapsedChange"
        >
          <div ref="rightPanelEl" class="pane-content">
            <MemoryAllocation :events="selectedEvents" :graphData="selectedGraphData" :animationSpeed="animationSpeed" :onlyUpdateSpeed="onlyUpdateSpeed" :clockName="currentClockName" @timeline-change="handleTimelineChange" @play-animation="handlePlayAnimation" @mem-trace-file-change="handleMemTraceFileChange"></MemoryAllocation>
          </div>
        </d-splitter-pane>
      </template>
    </d-splitter>
    <PlaybackProgress v-if="showMemoryAllocation" :clocks="timelineData" @clock-select="handleClockSelect" @speed-change="handleSpeedChange" />
  </div>

</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, ref, provide, inject, computed, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphHeader from './comGraphHeader.vue';
import ComGraphMinimap from './comGraphMinimap.vue';
import ComGraphReport from './comGraphReport.vue';
import MemoryAllocation from './memoryAllocation.vue';
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
import ErrorNode from './error-node.vue';
import PlaybackProgress from './PlaybackProgress.vue';
import { openSwimlaneGraph } from "@/apis/opener";
import { getSwimPath, getUserRunRoot } from "@/apis/welcome";
import { getQuery } from '@/core/query';
import { searchByOperationMagic } from '../../utils/search';

const outputDirPath = ref('');
let isBootStep = false;
getQuery().then((res) => {
  outputDirPath.value = res.outputDirPath as string;
  const query = JSON.parse(res._uri.query);
  isBootStep = Boolean(query.isBootStep)
});

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
  searchLevel: {
    type: Number,
    default: -1
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
const showComGraphReport = ref(false);
const showMemoryAllocation = ref(false);
const splitterPane = ref();
const rightPanelEl = ref<HTMLElement>();
const rightPanelWidth = ref(0);
const collapsed = ref(false);
const showNodeDetail = ref(false);
const showLayerControl = ref(false);
const showLeafCalledRecord = ref(false);
const nodeId = ref('');
const isLoading = ref(false);
const loadingText = ref('');
const warningText = ref('');
const waitingFlag = ref(false);
const healthReportGraphName = ref('');
const showType = ref('all');
const graphType = ref('');
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
const isDragging = ref(false);
const switchLockInformationFlag = ref(false);
const leafCalledRecordMap = ref<Record<string, number>>({});
const currentLeafName = ref('');
const nodeErrorList = ref([]);
const headerEl = ref();
const orientation = ref('horizontal');
const splitBarSize = '2px';
const minSize = ref('20%');
const comGraphInit = ref(false);
const maxSize = ref('60%');

interface Event {
  id: string
  eventType: string
  startTime: number
  endTime: number
  animationData: any[]
}

const selectedEvents = ref<Event[]>([]);
const selectedGraphData = ref<any>(null);
const animationSpeed = ref<number>(1);
const timelineData = ref<any[]>([]);
const onlyUpdateSpeed = ref<boolean>(false);
const speedChangeCount = ref(0);

const currentClockName = ref('');

// 存储从 MemoryAllocation 组件获取的 memTraceFile 信息
const existTraceFile = ref(false);
const isComFile = ref(false);

const handleClockSelect = (events: Event[], graphData: any, speed: number, onlyUpdateSpeedFlag: boolean, clockName: string = '') => {
  selectedEvents.value = events;
  selectedGraphData.value = graphData;
  animationSpeed.value = speed;
  onlyUpdateSpeed.value = false;
  speedChangeCount.value = 0;
  currentClockName.value = clockName;
};

const handleSpeedChange = (speed: number, onlyUpdateSpeedFlag: boolean) => {
  animationSpeed.value = speed;
  onlyUpdateSpeed.value = onlyUpdateSpeedFlag;
  speedChangeCount.value++;
};

const handleTimelineChange = (timeline: any[]) => {
  timelineData.value = timeline;
};

const handlePlayAnimation = () => {
  onlyUpdateSpeed.value = false;
};

const handleMemTraceFileChange = (data: { existTraceFile: boolean; isComFile: boolean }) => {
  if (comGraphInit.value) {
    return;
  }

  comGraphInit.value = true;
  existTraceFile.value = data.existTraceFile;
  isComFile.value = data.isComFile;

  if (!isComFile.value) {
    toggleMemoryAllocation();
  }
};

const sizeChange = (size) => {
  window.dispatchEvent(new Event('resize'));
  fitToScreen();
  updateRightPanelWidth();
};
const collapsedChange = (event) => {
  console.log(event);
};
const minimapOffsetRight = computed(() => {
  if (showNodeDetail.value || showLeafCalledRecord.value) {
    return 480;
  } else if (showComGraphReport.value) {
    return 488;
  } else {
    return 0;
  }
})

let lockText = '';

let fitToScreenAction;
let initComDocText;
let colorBySubGraph;
let updateGraph;
let centerNodeAction;
let selectAction;
let getSelectedNodeId;
let resetModelSource;
let hoverFeedbackAction;
let updateModelAction;
let setDirection: (direction: 'RIGHT' | 'DOWN') => void;


const fitToScreen = () => {
  const timer = setTimeout(() => {
    fitToScreenAction();
    clearTimeout(timer);
  });
}

const nodeDisplayConfig = (type: 'op' | 'all') => {
  updateGraph(isDarkTheme.value, {
    showTensorNodes: type === 'op' ? false : true,
    openMode: props.openMode, nodeMagic: props.nodeMagic
  })
  showType.value = type;
  comGraphStore.setData("historyPath", []);
}


const nodeSearchLevelChange = (newSearchLevel: string) => {
  comGraphStore.data.searchLevel = newSearchLevel;
  updateGraph(isDarkTheme.value, {
    openMode: props.openMode, nodeMagic: props.nodeMagic, searchLevel: Number(newSearchLevel)
  })
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
    const tracedOperations = comGraphStore.data.traceOperations?.[1];
    const tracedNodes = [...(tracedTensors || []), ...(tracedOperations || [])];
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

const onOpMagicClick = (opMagic) => {
  if (opMagic === "") {
    return;
  }
  const clickOpmagic = Number(opMagic);
  let node_id = `operation-magic-${clickOpmagic}--1`;
  const operations = comGraphStore.data.jsonData.operations;
  operations.forEach(element => {
    if (element.opmagic === Number(clickOpmagic)) {
      const subgraphId = element.subgraphid !== undefined ? element.subgraphid : -1;
      node_id = `operation-magic-${element.opmagic}-${subgraphId}`;
    }
  });
  centerNodeAction([node_id]);
  selectAction([node_id]);
}

const colorSubgraph = (isColor: boolean) => {
  colorBySubGraph(isColor);
}

const toggleHealthReport = (status: boolean) => {
  showComGraphReport.value = status;
  if (status && showMemoryAllocation.value) {
    toggleMemoryAllocation();
  }
}
const toggleMemoryAllocation = () => {
  splitterPane.value.updateCollapsed();
  collapsed.value = !collapsed.value;
  setTimeout(() => {
    showMemoryAllocation.value = !showMemoryAllocation.value;
    window.dispatchEvent(new Event('resize'));
    fitToScreen();
  }, 50);
}

const toggleLeafCalledRecord = (status: boolean, leafName: string) => {
  showLeafCalledRecord.value = status;
  currentLeafName.value = leafName;
}
function updateRightPanelWidth() {
  nextTick(() => {
    rightPanelWidth.value =  rightPanelEl.value.offsetWidth;
  });
}
watch(showMemoryAllocation, updateRightPanelWidth);
watch(server.LayoutResult, (newValue) => {
  isLoading.value = false;
  waitingFlag.value = false;
  loadingText.value = '';
});

// 获取错误节点信息
watch(server.nodeErrorList, (newValue) => {
  nodeErrorList.value = newValue.data;
});

const updateRunningNode = (id: number | string) => {
  const nodeId = comGraphStore.data.magicNodeIdMap[Number(id)];
  if (id === '') {
    comGraphStore.setData('runningNodeId', '');
    updateModelAction();
  } else if (nodeId) {
    selectAction([]);
    releaseFixedFlow();
    centerNodeAction([nodeId]);
    comGraphStore.setData('runningNodeId', nodeId);
  } else {
    onMessageNotice(t('comGraph.nodeNotExist'));
  }
};

provide(ComGraphProvideKey, { updateRunningNode, toggleHealthReport, showLayerControl, showMemoryAllocation, leafCalledRecordMap, toggleLeafCalledRecord, toggleMemoryAllocation });

const LoadingStatusMap = {
  readJson: 'comGraph.readJson',
  convertData: 'comGraph.convertData',
  readJsonWarning: 'comGraph.readJsonWarning',
  rendering: 'comGraph.rendering',
  loading: 'loadTraceData',
};
watch(
  () => props.loadingStep,
  (val) => {
    if (!val) { return; }
    if (val === 'readJson' || val === 'rendering' || val === 'convertData' || val === 'loading') {
      isLoading.value = true;
      const nodeCount = comGraphStore.data?.pathNodesSet.size ?? comGraphStore.data?.nodeCount ?? 0;
      waitingFlag.value = (nodeCount >= 5000) && (comGraphStore.data.isCached === false);
    }
    if (val === 'readJsonWarning') {
      isLoading.value = true;
      loadingText.value = t(LoadingStatusMap['readJson']);
      warningText.value = t(LoadingStatusMap[val]);
    } else {
      loadingText.value = t(LoadingStatusMap[val]);
    }
  },
  { immediate: true },
);

watch([() => props.jsonContent, isDarkTheme], ([val]) => {
  if (Object.keys(val).length) {
    graphType.value = typeof val.graphtype !== 'undefined' ? String(val.graphtype) : '';
    const jsonValue = JSON.parse(JSON.stringify(props.jsonContent));
    const searchLevel = comGraphStore.data?.searchLevel ?? props.searchLevel;
    if (initComDocText) {
      resetModelSource(true);
      initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic, searchLevel);
      comGraphStore.setData('jsonData', jsonValue);
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
    updateModelAction = sprottyLoadResult.updateModelAction;
    initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic, searchLevel);
    comGraphStore.setData('jsonData', jsonValue);
  }
}, { immediate: true });

function onMessageNotice(text) {
  Message({
    type: 'warning',
    message: text
  });
}

function onNodeHiddenMessageNotice(text) {
  onMessageNotice(t(text));
}

function onViewMouseUp(node) {
  if (node.type === 'graph' || node.id.startsWith('parent') || node.isTokenLabel) {
    showNodeDetail.value = false;
  } else if (node.id.endsWith('label-main') && !node.isEmptyLabel) {
    nodeId.value = node.id;
    showNodeDetail.value = true;
    if (showMemoryAllocation.value) {
      toggleMemoryAllocation();
    }
  }
}
function onSwitchLockInfo(attr) {
  switchLockInformationFlag.value = attr[0];
  if (attr[1]) {
    lockText = t('comGraph.singlePathMode');
  } else {
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

// 步骤1查看计算图
function viewComGraph() {
  // 还原步骤2的选中并居中节点
  centerNodeAction([], undefined, undefined, 1);
  selectAction([]);
  // 根据窗口大小渲染计算图
  fitToScreenAction();
}
// 步骤2查看节点详情
function viewNodeDetail(params: Record<string, any>) {
  // 清空步骤3搜索条件并关闭搜索结果下拉框，清空用户选中的节点
  headerEl.value.updateSearchParams({ searchKey: '', selectedTags: [] });
  headerEl.value.hideSearchResMenu();
  selectAction([]);
  // 选中并居中节点
  centerNodeAction([params.nodeId], undefined, undefined, 1);
}

// 步骤3搜索节点
function searchNode(params: Record<string, any>) {
  // 还原步骤4的只看当前通路
  setFixedComGraphFlow(false, false);
  // 还原到步骤2的节点选中和居中
  const { nodeId, ...rest } = params;
  centerNodeAction([nodeId], undefined, undefined, 1);
  // 延迟填充搜索条件，给引导系统准备时间
  setTimeout(() => {
    headerEl.value.updateSearchParams(rest);
  }, 100);
}

// 步骤4只看当前通路
function focusCurrentPath(params) {
  // 清空用户选中的节点
  selectAction([]);
  // 填充步骤3的搜索结果
  const { searchNodeId, ...rest } = params;
  headerEl.value.updateSearchParams({ searchKey: '', selectedTags: [] });
  nextTick(() => {
    headerEl.value.updateSearchParams(rest);
  });
  // 聚焦搜索的节点
  centerNodeAction([searchNodeId]);
}
const stepsMap = {
  viewComGraph,
  viewNodeDetail,
  searchNode,
  focusCurrentPath
}
async function onStepsChange(args) {
  if (args.type === 'openWebviewWithGuide') {
    openSwimlaneGraph({
      swimlaneGraphPath: `${await getSwimPath()}`,
      isBootStep: true
    });
    server.closeWebview();
    return;
  }
  if (args.type === 'welcomeSkipAll') {
    server.closeWebview();
  }
  stepsMap[args.data.methodName](args.data.params);
}
onMounted(() => {
  (window as any).ascEventBus.on('view_left_mouseup', onViewMouseUp);
  (window as any).ascEventBus.on('message_notice', onMessageNotice);
  (window as any).ascEventBus.on('node_hidden_message_notice', onNodeHiddenMessageNotice);
  (window as any).ascEventBus.on('switchLockInformation', onSwitchLockInfo);
  (window as any).ascEventBus.on('layoutEnding', onLayoutEnding);
  if (props.loadingStep === 'readJson' || props.loadingStep === 'convertData') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
  (window as any).ascEventBus.on('view_mousedown', onViewMouseDown);
  document.addEventListener('mouseup', onMouseup);
  document.addEventListener('keydown', onDocumentKeyDown);
  // 监听操作指引每个步骤需要触发的操作
  (window as any).ascEventBus.on('boot-step-tips', onStepsChange);
  if (splitterPane.value) {
    splitterPane.value.updateCollapsed();
  }
});

onBeforeUnmount(() => {
  (window as any).ascEventBus.remove('view_left_mouseup', onViewMouseUp);
  (window as any).ascEventBus.remove('message_notice', onMessageNotice);
  (window as any).ascEventBus.remove('node_hidden_message_notice', onNodeHiddenMessageNotice);
  (window as any).ascEventBus.remove('switchLockInformation', onSwitchLockInfo);
  (window as any).ascEventBus.remove('layoutEnding', onLayoutEnding);
  (window as any).ascEventBus.remove('view_mousedown', onViewMouseDown);
  document.removeEventListener('mouseup', onMouseup);
  document.removeEventListener('keydown', onDocumentKeyDown);
  (window as any).ascEventBus.remove('boot-step-tips', onStepsChange);
});

// 统一出口：解除固定
function releaseFixedFlow() {
  setFixedComGraphFlow(false, false);
  switchLockInformationFlag.value = false;
}

// 在 document 上只绑定一次
async function onDocumentKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' || e.code === 'Escape') {
    e.preventDefault();   // 防止浏览器默认行为（如退出全屏）
    releaseFixedFlow();
  }
  // 2. Ctrl+L  锁定通路并高亮
  if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey &&
    (e.key === 'l' || e.key === 'L') && !isBootStep) {
    e.preventDefault();
    const selectedNodeId = await getSelectedNodeId()
    setFixedComGraphFlow(true, false, selectedNodeId);
    if (selectedNodeId && selectedNodeId != '') {
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
    setFixedComGraphFlow(true, true, selectedNodeId);
    if (selectedNodeId && selectedNodeId != '') {
      switchLockInformationFlag.value = true;
      lockText = t('comGraph.singlePathMode');
    }
    return;
  }

  // 4. 左右键跳转
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.shiftKey && !e.altKey && !e.metaKey) {
    const eTarget = e.target as HTMLElement;
    if (eTarget.id !== 'sprotty_root') {
      return;
    }
    e.preventDefault();
    const selectedNodeId = await getSelectedNodeId()
    if (!selectedNodeId) {
      (window as any).ascEventBus.emit('message_notice', (window as any).ascLang === 'en' ? 'Please select the node first' : '请先选中节点');
      return;
    }
    const disabledFlag = comGraphStore.data.inFixedComGraphFlow ||
                       (comGraphStore.data?.pathNodesSet && (comGraphStore.data.pathNodesSet.size > 0));
    (window as any).ascEventBus.emit('jump2SiblingNodeByHotKey', {nodeId: selectedNodeId, eventKey: e.key});
    return;
  }
};

</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.com-graph-container {
  width: 100%;
  height: 100%;
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
    padding-bottom: 50px;
  }

  :deep(.playback-progress-container) {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
  }
}

.devui-loading {
  .devui-loading__area {
    display: flex;
    align-items: center;
  }
}

.pane-content {
  height: 100%;
}

.devui-splitter {
  flex: 1;
  min-height: 0;
}

.congraph {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
</style>

<style lang="scss" scoped>
:deep(.devui-splitter__bar) {
  background-color: var(--pto-border-default);
}
</style>
