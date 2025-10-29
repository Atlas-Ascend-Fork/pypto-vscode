<template>
  <div class="com-graph-container">
    <div v-if="outputDirPath" :class="['com-graph-navbar-wrap', Boolean(currentLeaf) && 'with-leaf-name']">
      <Navbar
        current-step="comGraph"
        :current-record-directory-path="outputDirPath"
        :current-path-magic-name="pathName"
        :current-pass-index="passIndex"
        :current-leaf-name="fileName"
        @leaf-change="(e) => (currentLeaf = e)"
      />
      <ComGraphHeader in-navbar @onLocate="onLocate" :showType="showType" :is-loading="isLoading" :graph-type="graphType" :openMode="props.openMode"></ComGraphHeader>
    </div>
    <ComGraphHeader v-else @onLocate="onLocate" :showType="showType" :is-loading="isLoading" :graph-type="graphType" :openMode="props.openMode"></ComGraphHeader>
    <div :style="{
        backgroundImage: 'url(' + svgPath + ')',
        backgroundRepeat: 'repeat',
      height: '100%'
    }">
      <div id="sprotty"></div>
    </div>
    <div class="lock-information" v-if="switchLockInformationFlag">
      <div class="lock-information-item">{{lockText}}，{{ t('comGraph.pressEscExit') }}</div>
    </div>
    <ShowTip></ShowTip>
    <ComGraphMinimap
      v-if="!isLoading"
      :offset-right="showNodeDetail ? 480 : showHealthReport ? (healthReportGraphName === 'KernelGraph' ? 488 : 400) : 0"
    ></ComGraphMinimap>
    <HealthReport v-model="showHealthReport" @onLocate="onLocate" @locateSubgraph="onLocateSubgraph" @open="(e) => (healthReportGraphName = e)" />
    <NodeDetail v-model="showNodeDetail" :node-id="nodeId" :json-content="props.jsonContent" />
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
    <LayerControl v-model="showLayerControl" @graph-layout-change="(e) => setDirection(e)" @node-display-change="(e) => nodeDisplayConfig(e)" />
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, defineProps, ref, provide, inject, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ComGraphHeader from './comGraphHeader.vue';
import ComGraphMinimap from './comGraphMinimap.vue';
import HealthReport from './healthReport/healthReport.vue';
import NodeDetail from './nodeDetail/nodeDetail.vue';
import Loading from './loading.vue';
import LayerControl from './layerControl/layerControl.vue';
import Navbar from '../navbar/navbar.vue';
import { comGraphStore } from '../../service/com-graph-store';
import { setFixedComGraphFlow } from '../../utils/operation';
import { Message } from 'vue-devui/message';
import { debounce } from 'lodash-es';
import ShowTip from '../util/showTip.vue';

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
const nodeId = ref('');
const isLoading = ref(false);
const loadingText = ref('');
const warningText = ref('');
const healthReportGraphName = ref('');
const showType = ref('all');
const graphType = ref('');
const currentLeaf = ref('');
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);

const switchLockInformationFlag = ref(false);
let lockText= '';

let fitToScreenAction;
let initComDocText;
let colorBySubGraph;
let updateGraph;
let centerNodeAction;
let selectAction;
let getSelectedNodeId;
let resetModelSource;
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

const onLocate = (id) => {
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

window.addEventListener('message', (event) => {
  if (event.data.type === 'postLayoutResult') {
    isLoading.value = false;
    loadingText.value = '';
  }
});

provide('comGraph', { toggleHealthReport, showLayerControl });

const LoadingStatusMap = {
  readJson: 'comGraph.readJson',
  convertData: 'comGraph.convertData',
  readJsonWarning: 'comGraph.readJsonWarning',
  rendering: 'comGraph.rendering',
};
watch(
  () => props.loadingStep,
  (val) => {
    if (val === 'rendering' || val === 'convertData') {
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
    initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic);
    comGraphStore.setData('jsonData', jsonValue);
  }
}, { immediate: true });

onMounted(() => {
  (window as any).ascEventBus.on('view_mouseup', (node) => {
    if (node.type === 'graph' || node.id.startsWith('parent')) {
      showNodeDetail.value = false;
    } else if (node.id.endsWith('label-main')) {
      nodeId.value = node.id;
      showNodeDetail.value = true;
    }
  });
  (window as any).ascEventBus.on('message_notice', (text) => {
    Message({
      type:'warning',
      message:text
    });
  });
  (window as any).ascEventBus.on('switchLockInformation', (attr) => {
    switchLockInformationFlag.value = attr[0];
    if(attr[1]){
      lockText = t('comGraph.singlePathMode');
    }else{
      lockText = t('comGraph.pathLocked');
    }
  });
  (window as any).ascEventBus.on('layoutEnding', (args) => {
    isLoading.value = false;
    loadingText.value = '';
  })
  if (props.loadingStep === 'readJson' || props.loadingStep === 'convertData') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
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

  .com-graph-navbar-wrap {
    position: absolute;
    width: 100%;
    height: 150px;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    background: var(--devui-header-gradient-bg);

    .navbar-container {
      flex: 1;
    }

    .com-graph-header {
      position: relative;
      max-width: 541px;
      background: unset;

      .toolbar-row {
        max-width: 470px;
        top: 16px;
        left: 8px;

        .category-search {
          width: calc(100% - var(--select-width));

          .dp-category-search-icon {
            background-color: var(--devui-base-bg);
            z-index: 2;
          }

          .dp-category-search-input {
            min-width: 120px;
          }
        }
      }
    }
  }

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

@media screen and (max-width: 1396px) {
  .com-graph-container {
    .com-graph-navbar-wrap.with-leaf-name {
        .navbar-container {
          padding-right: 80px;
        }

        .com-graph-header {
          .toolbar-row {
            position: fixed;
            max-width: unset;
            top: 68px;
            left: 16px;
          }
        }
      }
  }
}

@media screen and (max-width: 1254px) {
  .com-graph-navbar-wrap:not(.with-leaf-name) {
    .navbar-container {
      padding-right: 80px;
    }

    .com-graph-header {
      .toolbar-row {
        position: fixed;
        max-width: unset;
        top: 68px;
        left: 16px;
      }
    }
  }
}

@media screen and (min-width: 1255px) {
  .com-graph-navbar-wrap:not(.with-leaf-name) {
    .com-graph-header {
      .toolbar-row {
        width: calc(100% - 80px) !important;
      }
    }
  }
}

@media screen and (min-width: 1397px) {
  .com-graph-navbar-wrap.with-leaf-name {
    .com-graph-header {
      .toolbar-row {
        width: calc(100% - 80px) !important;
      }
    }
  }
}

.devui-loading {
  .devui-loading__area {
    display: flex;
    align-items: center;
  }
}
</style>
