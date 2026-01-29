<script setup lang="ts">
import { onMounted, ref, watch, toRef, computed, shallowRef, provide } from 'vue';
import ComGraph from '../../components/comGraph/comGraph.vue';
import DiffComGraph from '../../components/diffComGraph/diffComGraph.vue';
import ErrorView from '../../components/comGraph/error.vue';
import SearchEntry from '../../components/comGraph/searchEntry.vue';
import SearchMode from '../../components/comGraph/searchMode.vue';
import SimpleComGraph from '../../components/comGraph/simpleComGraph.vue';
import ThreeColumn from '../../components/threeColumn/threeColumn.vue';
import RundataModal from '../../components/threeColumn/rundataModal.vue';
import { comGraphStore } from '../../service/com-graph-store';
import { useViewServer } from '../../core/use-view-server';
import SwimGraph from '../../components/swimGraph/swimGraphComplete.vue';
import { pushState, pullState } from '../../core/state';
import NoDataFile from '../../components/comGraph/noDataFile.vue';
import { ICommonViewServer } from 'ext:/view/servers/view-server-interface';
import { threadCache } from '../../components/swimGraph/swimGraphUtils';
import { useI18n } from 'vue-i18n';
const { t: $t } = useI18n();
const graphName = ref('');
const isHovered = ref(false);
const graphNameTemp = ref('');
const jsonContent = ref({});
const comErrorMessage = ref('');
const swimErrorMessage = ref('');
const errorLog = ref('');
const swimGrahRef = ref();
const loadingStep = ref('');
const searchMode = ref(0);
const passIndex = ref('');
const pathName = ref('');
const fileName = ref('');
const diffInfo = ref<Record<string, any>>({});
const openMode = ref('all');
const nodeMagic = ref(0);
const searchLevel = ref(-1);
const noComFile = ref(true);
const noSwimFile = ref(true);
const runDataVisible = ref(false);
const missGraphType = ref('');
const baseChoose = ref('');
const pagetotal = ref(0);
const disabledSearchMode = computed(() => !(Object.keys(jsonContent.value).length));
let inThreeColumnMode = false;
const modalVisible = ref(false);
const shouldUpdateComGraphHashList = ref(false);
const replaceMsg = ref({ graphType: "", paths: { swimPath: "", comPath: "" }, selectPath: "" });
//
const props = defineProps({
  graphType: {
    type: String,
  },
});
enum RequestType {
  NodeOverLimit = 1,
  SearchNoMagic = 2,
  SearchMagic = 3,
}
const graphType = toRef(props, 'graphType');
const filePaths = ref({ swimPath: null, comPath: null });
const swimFileName = ref('merged_swimlane.json');
const comFileName = ref('program.json');
const isHeaderEnter = ref(false);
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
  swimErrorMessage.value = args.msg;
});

function setupComWatchers(server: any) {
  watch(server.ErrorMessage, (newValue) => {
    comErrorMessage.value = newValue.data;
    jsonContent.value = '';
    errorLog.value = newValue.log;
  });

  watch(server.ComData, (newValue) => {
    comGraphStore.setData('version', newValue.version || '2.0');
    shouldUpdateComGraphHashList.value = true;
    jsonContent.value = newValue.data;
    loadingStep.value = newValue.step;
    passIndex.value = newValue.passIndex;
    pathName.value = newValue.pathName;
    fileName.value = newValue.fileName;
  }, {});

  const canLoadComData = computed(() =>
    server.PathOriginMode.value?.data
  );
  watch(canLoadComData, (modeType) => {
    switch (modeType) {
      case RequestType.NodeOverLimit:
        loadingStep.value = 'readJsonWarning';
        searchMode.value = 1;
        const nodeCount = server.PathOriginMode.value?.nodeCount ?? -1;
        comGraphStore.setData('nodeCount', nodeCount);
        break;
      case RequestType.SearchNoMagic:
        searchMode.value = 2;
        openMode.value = 'path';
        break;
      case RequestType.SearchMagic:
        nodeMagic.value = server.PathOriginMode.value?.nodeMagic;
        openMode.value = 'path';
        searchMode.value = 0;
        break;
      default:
        break;
    }
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
    shouldUpdateComGraphHashList.value = false;
  });
  watch(server.InitData, (newValue) => {
    pushState({
      fsPath: newValue.fsPath,
      funcHash: newValue.funcHash,
      magicName: newValue.magicName,
      pathName: newValue.pathName,
    });
  });
}

function setupThreeWatchers(server: any) {
  watch(server.InitFlag, async () => {
    if (server.InitFlag.value) {
      noComFile.value = false;
      noSwimFile.value = false;
      baseChoose.value = server.InitFlag.value.runDataTitle;
      await server.getInitialData();
      server.returnFuncTree();
    }
  }, { immediate: true });
  watch(server.SetThreeColumnMode, () => {
    inThreeColumnMode = true;
  });
  watch(server.returnInitPath, async (path) => {
    if (server.returnInitPath.value) {
      let { swimPath, comPath } = path.data;
      const state = pullState();
      if (!swimPath) {
        swimPath = state.swimDataPath
      }
      if (!comPath) {
        comPath = state.comPath
      }
      filePaths.value = { swimPath: swimPath || '', comPath: comPath || '' };
      if (swimPath) {
        if (noSwimFile.value) {
          noSwimFile.value = false;
          swimFileName.value = swimPath.split(/[\/\\]/).pop();
          await server.getInitialSwimData();
        }
      } else {
        noSwimFile.value = true;
      }
      if (comPath) {
        if (noComFile.value) {
          noComFile.value = false;
          comFileName.value = comPath.split(/[\/\\]/).pop();
          await server.getInitialComData();
          server.returnFuncTree();
        }
      } else {
        noComFile.value = true;
      }
    }
  }, { immediate: true });
  watch(server.returnSearchPath, async (path) => {
    let { swimPath, comPath } = path.data;
    const state = pullState();
    if (!swimPath) {
      swimPath = state.swimDataPath
    }
    if (!comPath) {
      comPath = state.comPath
    }
    filePaths.value = { swimPath: swimPath || '', comPath: comPath || '' };
    const promises = [];
    if (swimPath) {
      swimFileName.value = swimPath.split(/[\/\\]/).pop();
      promises.push(server.getInitialSwimData());
      if (noSwimFile.value) {
        noSwimFile.value = false;
      } else {
        // 如果泳道图不缺省，则要重载泳道图
        promises.push(reloadSwimGraph(swimGrahRef, swimErrorMessage, server, threadCache));
      }
    }
    if (comPath) {
      noComFile.value = false;
      comFileName.value = comPath.split(/[\/\\]/).pop();
      loadingStep.value = 'loading';
      promises.push(server.getInitialComData());
    }
    await Promise.all(promises);
  });
  watch(server.returnReplace, async (path) => {
    modalVisible.value = true;
    replaceMsg.value = path.data;
    graphName.value = replaceMsg.value.graphType === 'swimGraph' ? $t('comGraphName') : $t('swimGraph');
    graphNameTemp.value = replaceMsg.value.graphType === 'swimGraph' ? $t('swimGraph') : $t('comGraphName');
  });
  watch(server.SetVscodeState, async (newValue) => {
    if (newValue.comPath) {
      pushState({ comPath: newValue.comPath });
    }
    if (newValue.swimDataPath) {
      pushState({ swimDataPath: newValue.swimDataPath });
    }
    if (newValue.codePath) {
      pushState({ codePath: newValue.codePath });
    }
  });
  watch(server.returnComPath, async (path) => {
    const { comPath } = path.data;
    comFileName.value = comPath.split(/[\/\\]/).pop();
    if (comErrorMessage.value) {
      comErrorMessage.value = '';
    }
    loadingStep.value = 'loading';
    await server.getInitialComData();
  });
  watch(server.returnSwimPath, async (path) => {
    const { swimPath } = path.data;
    swimFileName.value = swimPath.split(/[\/\\]/).pop();
    await server.getInitialSwimData();
    await reloadSwimGraph(swimGrahRef, swimErrorMessage, server, threadCache);
  });
}

function setupSwimWatchers(server: any) {
  watch(server.returnSwim, (newValue) => {
    jsonContent.value = newValue.data;
  });
}

onMounted(async () => {
  const state = pullState();
  if (server.fetchVscodeState) {
    server.fetchVscodeState(state);
  }
  if (filePaths.value.swimPath === null) {
    filePaths.value = { swimPath: state.swimDataPath, comPath: state.comPath };
  }
  if (state.swimDataPath) {
    if (noSwimFile.value) {
      noSwimFile.value = false;
      await server.getInitialSwimData();
    }
  }
  if (state.comPath) {
    if (noComFile.value) {
      noComFile.value = false;
      await server.getInitialComData();
      server.returnFuncTree();
    }
  }
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
  (window as any).ascEventBus.on('searchNodeGlobal', searchNodeGlobalListener);
});

const searchNodeListener = (args) => {
  searchMode.value = 0;
  openMode.value = 'path';
  searchLevel.value = args.nodeSearchLevel;
  comGraphStore.setData('searchLevel', searchLevel.value);
  nodeMagic.value = args.nodeMagic;
  loadingStep.value = 'convertData';
};

const searchNodeGlobalListener = (args) => {
  jsonContent.value = undefined;
  searchMode.value = 0;
  
  if(args.nodeMagic === -1) {
    openMode.value = args.openMode;
    nodeMagic.value = undefined
  } else {
    nodeMagic.value = args.nodeMagic;
    searchLevel.value = args.nodeSearchLevel;
    comGraphStore.setData('searchLevel', searchLevel.value);
  }

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
    if (comErrorMessage.value) {
      comErrorMessage.value = '';
    }
    await server.replaceFile({ options: { swimPath, comPath: comPath } });
  } else {
    const comPath = replaceMsg.value.paths.comPath;
    const swimPath = selectPath;
    await server.replaceFile({ options: { swimPath, comPath } });
    await reloadSwimGraph(swimGrahRef, swimErrorMessage, server, threadCache);
  }
};

const reloadSwimGraph = async (swimGrahRef, swimErrorMessage, server, threadCache) => {
  swimGrahRef.value.loading = true;
  swimGrahRef.value.labelRender = false;
  if (swimErrorMessage.value) {
    swimErrorMessage.value = '';
  }
  let data = {};
  const state = pullState();
  const Reader = await server.getSwimData({ swimDataPath: state.swimDataPath });
  const originalReader = Reader.getReader();
  let result = await originalReader.read();
  swimGrahRef.value.loadingText = $t('receiveTraceData');

  while (!result.done) {
    const val = result.value;
    if (val.type == 'first') {
      data.swimData = val.data;
    } else {
      data.swimData.processes[val.processId].threads[val.threadId].events.push(...val.data);
    }
    result = await originalReader.read();
  }

  try {
    const res = await server.getOtherData();
    data.config = res.configuration;
    data.comGraphPath = res.comGraphPath;
    data.swimPath = res.swimPath;
  } catch (err) {
    console.log('parse other data error:', err);
  }

  threadCache.clear();
  swimGrahRef.value.labelRender = true;
  swimGrahRef.value.setPageState(data);
  swimGrahRef.value.loadTraceData(data.swimData);
};

const modelCancel = async () => {
  modalVisible.value = false;
  if (replaceMsg.value.graphType === "swimGraph") {
    const swimPath = replaceMsg.value.paths.swimPath;
    const comPath = "";
    await server.replaceFile({ options: { swimPath, comPath } });
  } else {
    const comPath = replaceMsg.value.paths.comPath;
    const swimPath = "";
    await server.replaceFile({ options: { swimPath, comPath } });
  }
};

const onInputFocus = (event) => {
  isHovered.value = true;
};

const onInputLeave = (event) => {
  isHovered.value = false;
};
provide('runDataList', {runDataVisible, missGraphType, pagetotal, baseChoose, isHeaderEnter});
</script>

<template>
  <template v-if="graphType !== 'threeColumnGraph' && (comErrorMessage || swimErrorMessage)">
    <ErrorView style="height: 100vh" :jsonContent="(comErrorMessage || swimErrorMessage)" :errorLog="errorLog" />
  </template>
  <template v-else>
    <ThreeColumn v-if="graphType === 'threeColumnGraph'">
      <template #comGraph>
        <ErrorView v-if="comErrorMessage" :jsonContent="comErrorMessage" :errorLog="errorLog" />
        <SimpleComGraph v-else-if="!noComFile" :jsonContent="jsonContent" :loadingStep="loadingStep"
          :com-file-name="comFileName" :should-update-hash-list="shouldUpdateComGraphHashList" />
        <NoDataFile v-else="noComFile" :graphType="'computeGraph'" :filePath="filePaths" />
      </template>
      <template #swimGraph>
        <ErrorView v-if="swimErrorMessage" :jsonContent="swimErrorMessage" />
        <SwimGraph v-if="!noSwimFile" ref="swimGrahRef" style="height: 100%" :is-three-column="true"
          :swim-file-name="swimFileName" :graphType="graphType" />
        <NoDataFile v-if="noSwimFile" :graphType="'swimGraph'" :filePath="filePaths" />
      </template>
    </ThreeColumn>
    <ComGraph v-if="graphType === 'computeGraph' && searchMode == 0"
      :jsonContent="jsonContent" :loadingStep="loadingStep" :openMode="openMode" :nodeMagic="nodeMagic" :searchLevel="searchLevel"
      :pass-index="passIndex" :path-name="pathName" :file-name="fileName" />
    <DiffComGraph v-if="graphType === 'diffGraph'" :afterJson="diffInfo.afterJson"
      :afterFileName="diffInfo.afterFileName" :beforeJson="diffInfo.beforeJson"
      :beforeFileName="diffInfo.beforeFileName" :beforeFilePath="diffInfo.beforeFilePath" :loadingStep="loadingStep" />
    <SearchEntry v-if="graphType === 'computeGraph' && searchMode === 1" :disabled-search-mode="disabledSearchMode"
      @full-render="onFullRender" @search-mode="entrySearchModeSet" />
    <SearchMode v-if="graphType === 'computeGraph' && searchMode === 2 && jsonContent.hash" :jsonContent="jsonContent"
      @searchMode="modeSearchModeSet" />
    <SwimGraph v-if="graphType === 'swimGraph'" :is-three-column="false" />
  </template>
  <template>
    <d-modal v-model="modalVisible" :title="$t('confirm')" class="modal-containner" :close-on-click-overlay="false">
      <div class="modal-background">{{ $t('replaceFileInfo', { graphName, graphNameTemp }) }}</div>
      <template #footer>
        <d-modal-footer class="modal-button">
          <d-button variant="solid" color='secondary' @click="modelCancel" @mouseenter="onInputFocus"
            @mouseleave="onInputLeave">{{ $t('no') }}</d-button>
          <d-button variant="solid" color='primary' @click="modelConfirm">{{ $t('yes') }}</d-button>
        </d-modal-footer>
      </template>
    </d-modal>
  </template>
  <template>
    <RundataModal ref="runDataListRef" :filePath="filePaths" />
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

.modal-button, .devui-modal__footer.runData-modal-button {
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