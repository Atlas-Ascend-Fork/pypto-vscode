<script setup lang="ts">
import { onMounted, ref, watch, toRef, computed, shallowRef } from 'vue';
import ComGraph from '../../components/comGraph/comGraph.vue';
import DiffComGraph from '../../components/diffComGraph/diffComGraph.vue';
import ErrorView from '../../components/comGraph/error.vue';
import SearchEntry from '../../components/comGraph/searchEntry.vue';
import SearchMode from '../../components/comGraph/searchMode.vue';
import SimpleComGraph from '../../components/comGraph/simpleComGraph.vue';
import ThreeColumn from '../../components/threeColumn/threeColumn.vue';
import { comGraphStore } from '../../service/com-graph-store';
import { useViewServer } from '../../core/use-view-server';
import SwimGraph from '../../components/swimGraph/swimGraphComplete.vue';
import { pushState } from '../../core/state';
import NoDataFile from '../../components/comGraph/noDataFile.vue';
import { ICommonViewServer } from 'ext:/view/servers/view-server-interface';
import { round } from 'lodash-es';
import { useI18n } from 'vue-i18n';
const { t: $t } = useI18n();
const graphName = ref('');
const isHovered = ref(false);
const graphNameTemp = ref('');
const jsonContent = ref({});
const errorMessage = ref('');
const swimGrahRef = ref();
const loadingStep = ref('');
const searchMode = ref(0);
const subGraphType = ref('');
const outputDirPath = ref('');
const passIndex = ref('');
const pathName = ref('');
const fileName = ref('');
const diffInfo = ref({});
const openMode = ref('all');
const nodeMagic = ref(0);
const comLoadFlag = ref(false);
const swimLoadFlag = ref(false);
const errorGraphType = ref('');
const noComFile = ref(false);
const noSwimFile = ref(false);
const disabledSearchMode = computed(() => !(Object.keys(jsonContent.value).length));
let inThreeColumnMode = false;
const modalVisible = ref(false);
const replaceMsg = ref({graphType:"", paths:{swimPath: "", comPath: ""}, selectPath:""});
//
const props = defineProps({
  graphType: {
    type: String,
  },
});
const graphType = toRef(props, 'graphType');
const filePaths = ref({swimPath: '', comPath: ''});
const { server } = useViewServer<ICommonViewServer>();

// 控制需要哪些监听器
if (graphType.value === 'computeGraph' || graphType.value === 'diffGraph' || graphType.value === 'threeColumnGraph') {
  setupComWatchers(server);
}
if (graphType.value === 'threeColumnGraph') {
  setupThreeWatchers(server);
}

if (graphType.value === 'swimGraph') {
  setupSwimWatchers(server);
}

(window as any).ascEventBus.on('jsonParseError', (args) => {
  errorMessage.value = args.msg;
  errorGraphType.value = args.graphType;
});

function setupComWatchers(server: any) {
  watch(server.ErrorMessage, (newValue) => {
    errorMessage.value = newValue.data;
    errorGraphType.value = newValue.graphType;
  });
  watch(server.ReadJsonWarning, (newValue) => {
    if (!inThreeColumnMode) {
      loadingStep.value = 'readJsonWarning';
      searchMode.value = 1;
    }
  });

  watch(server.ComData, (newValue) => {
    comGraphStore.setData('version', newValue.version || '2.0')
    jsonContent.value = newValue.data;
    loadingStep.value = newValue.step;
    outputDirPath.value = newValue.outputDirPath;
    passIndex.value = newValue.passIndex;
    pathName.value = newValue.pathName;
    fileName.value = newValue.fileName;
  });
  watch(server.DiffComData, (newValue) => {
    diffInfo.value = newValue.diffInfo;
    loadingStep.value = newValue.step;
  });

  watch(server.InitComGraph, (newValue) => {
    loadingStep.value = newValue.step;
  });

  watch(server.InitDiffComGraph, (newValue) => {
    comGraphStore.setData('isDiffGraph', true);
    loadingStep.value = newValue.step;
  });

  watch(server.CalleeMap, (newValue) => {
    comGraphStore.setData('calleeMap', newValue.data);
  });

  watch(server.CalleeOpAttrMap, (newValue) => {
    comGraphStore.setData('CalleeOpAttrMap', newValue.data);
  });

  watch(server.PathNodesSet, (newValue) => {
    const nodesSet = new Set(newValue.data);
    comGraphStore.setData('pathNodesSet', nodesSet);
  });

  watch(server.SetThreeColumnMode, () => {
    inThreeColumnMode = true;
  });
  watch(server.JsonContent, (newValue) => {
    jsonContent.value = newValue.data;
  });
  watch(server.InitData, (newValue) => {
    pushState({
      fsPath: newValue.fsPath,
      funcHash: newValue.funcHash,
      magicName: newValue.magicName,
      outputDirPath: newValue.outputDirPath,
      pathName: newValue.pathName,
    });
  });
}

function setupThreeWatchers(server: any) {
  watch(server.InitFlag, async () => {
    if (server.InitFlag.value == 'true') {
      await server.getInitialData();
      server.returnFuncTree();
    }
  }, { immediate: true });
  watch(server.SetThreeColumnMode, () => {
    inThreeColumnMode = true;
  });
  watch(server.returnInitPath, async (path) => {
    if (server.returnInitPath.value) {
      const {swimPath, comPath} = path.data;
      filePaths.value = { swimPath, comPath };
      if (swimPath) {
        noSwimFile.value = false;
        await server.getInitialSwimData();
      } else {
        noSwimFile.value = true;
      }
      if (comPath) {
        noComFile.value = false;
        await server.getInitialComData();
        server.returnFuncTree();
      } else {
        noComFile.value = true;
      }
    }
  }, { immediate: true });
  watch(server.returnSearchPath, async (path) => {
    const {swimPath, comPath} = path.data;
    filePaths.value = { swimPath, comPath };
    const promises = [];
    if (swimPath) {
      noSwimFile.value = false;
      promises.push(server.getInitialSwimData());
    }
    if (comPath) {
      noComFile.value = false;
      promises.push(server.getInitialComData());
    }
    await Promise.all(promises);
  }); 
  watch(server.returnReplace, async (path) => {
    modalVisible.value = true;
    replaceMsg.value = path.data;
    graphName.value = replaceMsg.value.graphType === 'swimGraph' ? $t('comGraphName') : $t('swimGraph');
    graphNameTemp.value = replaceMsg.value.graphType === 'swimGraph' ?  $t('swimGraph') : $t('comGraphName');
  });      
}

function setupSwimWatchers(server: any) {
  watch(server.returnSwim, (newValue) => {
    jsonContent.value = newValue.data;
  });
}

onMounted(async () => {
  if (graphType.value === 'computeGraph' || graphType.value === 'diffGraph') {
    await server.getInitialData();
  }
  if (graphType.value === 'swimGraph') {
    await server.getInitialData();
  }
  (window as any).ascEventBus.on('comGraphRendering', (args) => {
    loadingStep.value = args;
  });
  (window as any).ascEventBus.on('searchNode', searchNodeListener);
});

const searchNodeListener = (args) => {
  searchMode.value = 0;
  openMode.value = 'path';
  nodeMagic.value = args;
  loadingStep.value = 'convertData';
};

function dealConfig(config) {
  if (!config) {
    return;
  }

  if (config.tensorAttr) {
    comGraphStore.setData('tensorAttrFunc', eval(config.tensorAttr));
  }

  if (config.tensorColor) {
    comGraphStore.setData('tensorColorFunc', eval(config.tensorColor));
  }

  if (config.operationAttr) {
    comGraphStore.setData('operationAttrFunc', eval(config.operationAttr));
  }

  if (config.operationColor) {
    comGraphStore.setData('operationColorFunc', eval(config.operationColor));
  }
}

function onFullRender() {
  if (Object.keys(jsonContent.value).length) {
    loadingStep.value = 'convertData';
  } else {
    loadingStep.value = 'readJson';
  }
  graphType.value = 'computeGraph';
  searchMode.value = 0;
}


function modeSearchModeSet() {
  if (openMode.value !== 'path') {
    searchMode.value = 0;
  }
}

function entrySearchModeSet() {
  searchMode.value = 2;
  openMode.value = 'path';
}

const modelConfirm = async () => {
  modalVisible.value = false;
  const selectPath = replaceMsg.value.selectPath;
  if (replaceMsg.value.graphType === "swimGraph") {
    const swimPath = replaceMsg.value.paths.swimPath;
    const comPath = selectPath;
    await server.innerGetSubgraph({ paramObj: { calleehash: comPath, subFuncmagicname: comPath}});
    await server.replaceFile({options: {swimPath, comPath: ""}});
  } else {
    const comPath = replaceMsg.value.paths.comPath;
    const swimPath = selectPath;
    swimGrahRef.value.loading = true;
    await server.replaceFile({options: {swimPath, comPath}});
    await server.resetSwimData().then((newValue) => {
      swimGrahRef.value.setPageState(newValue);
      swimGrahRef.value.loadTraceData(newValue.data);
    });
  }
};

const modelCancel = async () => {
  modalVisible.value = false;
  if (replaceMsg.value.graphType === "swimGraph") {
    const swimPath = replaceMsg.value.paths.swimPath;
    const comPath = "";
    await server.replaceFile({options: {swimPath, comPath}});
  } else {
    const comPath = replaceMsg.value.paths.comPath;
    const swimPath = "";
    await server.replaceFile({options: {swimPath, comPath}});
  }
};

const onInputFocus = (event) => {
  isHovered.value = true;
};

const onInputLeave = (event) => {
  isHovered.value = false;
};

</script>

<template>
  <template v-if="graphType !== 'threeColumnGraph' && errorMessage !== ''">
    <ErrorView style="height: 100vh" :jsonContent="errorMessage" />
  </template>
  <template v-else>
    <ThreeColumn v-if="graphType === 'threeColumnGraph'">
      <template #comGraph>
        <ErrorView v-if="errorMessage && errorGraphType === 'comGraph'" :jsonContent="errorMessage" />
        <SimpleComGraph v-else-if="!noComFile" :jsonContent="jsonContent" :loadingStep="loadingStep" />
        <NoDataFile v-else="noComFile" :graphType="'computeGraph'" :filePath="filePaths"/>
      </template>
      <template #swimGraph>
        <ErrorView v-if="errorMessage && errorGraphType === 'swimGraph'" :jsonContent="errorMessage" />
        <SwimGraph v-if="!noSwimFile"  ref="swimGrahRef" style="height: 100%" :is-three-column="true" :graphType="graphType" />
        <NoDataFile v-if="noSwimFile" :graphType="'swimGraph'" :filePath="filePaths"/>
      </template>
    </ThreeColumn>
    <ComGraph v-if="graphType === 'computeGraph' && searchMode == 0" :outputDirPath="outputDirPath"
      :jsonContent="jsonContent" :loadingStep="loadingStep" :openMode="openMode" :nodeMagic="nodeMagic"
      :pass-index="passIndex" :path-name="pathName" :file-name="fileName" />
    <DiffComGraph v-if="graphType === 'diffGraph'" :afterJson="diffInfo.afterJson"
      :afterFileName="diffInfo.afterFileName" :beforeJson="diffInfo.beforeJson"
      :beforeFileName="diffInfo.beforeFileName" :loadingStep="loadingStep" />
    <SearchEntry v-if="graphType === 'computeGraph' && searchMode === 1" :disabled-search-mode="disabledSearchMode"
      @full-render="onFullRender" @search-mode="entrySearchModeSet" />
    <SearchMode v-if="graphType === 'computeGraph' && searchMode === 2" :jsonContent="jsonContent"
      @searchMode="modeSearchModeSet" />
    <SwimGraph v-if="graphType === 'swimGraph'" :is-three-column="false" />
  </template>
  <template>
    <d-modal v-model="modalVisible" :title="$t('confirm')" class="modal-containner">
      <div class="modal-background">{{ $t('replaceFileInfo', { graphName, graphNameTemp } ) }}</div>
      <template #footer>
        <d-modal-footer class="modal-button">
          <d-button variant="solid" color='secondary' @click="modelCancel" @mouseenter="onInputFocus" @mouseleave="onInputLeave">{{ $t('no') }}</d-button>
          <d-button variant="solid" color='primary' @click="modelConfirm">{{ $t('yes') }}</d-button>
        </d-modal-footer>
      </template>
    </d-modal>
  </template>
</template>
<style scoped>
.parent-container {
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
}

.com-skeleton-line {
  display: flex;
}

.com-skeleton-item {
  width: 80px;
  height: 24px;
  margin: 8px 16px 8px 16px;
}

.swim-skeleton-grid {
  border-right: 1px solid var(--devui-split-line);
}

.swim-skeleton-line {
  display: flex;
  border: 1px solid var(--devui-split-line);
  border-bottom: 0;
}

.swim-skeleton-item {
  width: 208px;
  height: 16px;
  margin-left: 16px;
  margin-right: 16px;
}

.swim-skeleton-item-3-1 {
  margin-top: 12px;
  margin-bottom: 12px;
}

.swim-skeleton-item-3-2 {
  margin: 1px;
}

.swim-skeleton-item-3-2-line {
  display: flex;
  margin: 11px 16px 11px 16px;
}
</style>
<style lang="scss">
header {
  min-width: 960px;

  &.com-graph-with-navbar {
    min-width: 1076px;
  }
}
.modal-background {
  background-color: var(--devui-swim-split-line);
  padding: 10px;
}
.modal-containner.devui-modal {
  width: 402px;
  height: 199px;
  background-color: var(--devui-tooltip-bg);
  border: 1px solid var(--devui-modal-line);
}

.devui-modal__header {
  padding: 16px 20px 0 20px !important;
}

.modal-button.devui-modal__footer {
  text-align: right; 
  padding-right: 20px;
}

.modal-button {
  .devui-button {
    height: 28px;
    border-radius: 8px;
  }
  .devui-button--solid--secondary {
    color: var(--devui-secondary-text);
    background: var(--devui-input-hover-bg);
  }
  .devui-button--solid--secondary:hover {
    background: var(--devui-secondary-button-hover-bg);
  }
  .devui-button--solid--secondary:active {
    background: var(--devui-input-hover-bg);
  }
  .devui-button--solid--primary {
    color: var(--devui-primary-tooltip-text);
    background: var(--devui-primary-button-bg);
  }
  .devui-button--solid--primary:hover {
    background: var(--devui-primary-button-hover-bg);
  }  
  .devui-button--solid--primary:active {
    background: var(--devui-primary-button-active-bg);
  }  
}

</style>