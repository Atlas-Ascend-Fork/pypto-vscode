<script setup lang="ts">
import {onMounted, ref, computed} from 'vue';
import ComGraph from './components/comGraph/comGraph.vue';
import SwimGraph from './components/swimGraph/swimGraphComplete.vue';
import DiffComGraph from './components/diffComGraph/diffComGraph.vue';
import ErrorView from './components/comGraph/error.vue';
import SearchEntry from './components/comGraph/searchEntry.vue';
import SearchMode from './components/comGraph/searchMode.vue';
import {comGraphStore} from './service/com-graph-store';
import {useTheme} from './theme/use-theme';
import {getQuery} from './core/query';
import {vscode} from './core/vscode';
import SideBarView from './components/sideBar/SideBarView.vue';
import ControlFlowIndex from "./components/controlFlowGraph/ControlFlowIndex.vue";

const graphType = ref('');
const jsonContent = ref({});
const errorMessage = ref('');
const loadingStep = ref('');
const outputDirPath = ref('');
const passIndex = ref('');
const pathName = ref('');
const fileName = ref('');
const diffInfo = ref({});
const openMode = ref('all');
const nodeMagic = ref(0);
const disabledSearchMode = computed(() => !(Object.keys(jsonContent.value).length));
const {updateTheme} = useTheme();

getQuery().then((query) => {
  graphType.value = query._viewType;
});

const errorListener = (args) => {
  graphType.value = 'returnError';
  errorMessage.value = args;
};

const searchNodeListener = (args) => {
  graphType.value = 'returnCom';
  openMode.value = 'path';
  nodeMagic.value = args;
  loadingStep.value = 'convertData';
};

(window as any).ascEventBus.on('jsonParseError', errorListener);
(window as any).ascEventBus.on('searchNode', searchNodeListener);

const returnCom = (message) => {
  jsonContent.value = message.data;
  loadingStep.value = message.step;
  outputDirPath.value = message.outputDirPath;
  passIndex.value = message.passIndex;
  pathName.value = message.pathName;
  fileName.value = message.fileName;
};

const returnInitData = (message) => {
  vscode.value.setState({
    fsPath: message.fsPath,
    funcHash: message.funcHash,
    magicName: message.magicName,
    outputDirPath: message.outputDirPath,
    pathName: message.pathName,
  });
};

const readJsonWarning = (message) => {
  graphType.value = 'comGraphFullSearchEntry';
  loadingStep.value = message.command;
};

const returnSwim = (message) => {
  graphType.value = 'returnSwim';
  jsonContent.value = message.data;
};

const returnSidBar = (message) => {
  graphType.value = 'returnSidBar';
  jsonContent.value = message.data;
  console.log(message.data)
};

const returnError = (message) => {
  graphType.value = 'returnError';
  errorMessage.value = message.data;
};

const returnCalleeMap = (message) => {
  comGraphStore.setData('calleeMap', message.data);
};

const returnTheme = (message) => {
  updateTheme(message.data);
};

const returnCalleeOpAttrMap = (message) => {
  comGraphStore.setData('CalleeOpAttrMap', message.data);
};

const returnPathNodesSet = (message) => {
  const nodesSet = new Set(message.data);
  comGraphStore.setData('pathNodesSet', nodesSet);
};

const initComGraph = (message) => {
  graphType.value = 'returnCom';
  loadingStep.value = message.step;
  dealConfig(message.configration);
};

const initDiffComGraph = (message) => {
  comGraphStore.setData('isDiffGraph', true);
  graphType.value = 'returnDiffCom';
  loadingStep.value = message.step;
};

const returnDiffCom = (message) => {
  diffInfo.value = message.diffInfo;
  loadingStep.value = message.step;
};

const CommandCallbackMap = {
  returnCom,
  returnSwim,
  returnCalleeMap,
  returnPathNodesSet,
  returnCalleeOpAttrMap,
  returnTheme,
  initComGraph,
  returnError,
  returnInitData,
  readJsonWarning,
  initDiffComGraph,
  returnDiffCom,
  returnSidBar,
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
  graphType.value = 'returnCom';
}

window.addEventListener('message', (event) => {
  const message = event.data;
  CommandCallbackMap[message.command]?.(message);
});

onMounted(() => {
  vscode.value.postMessage({
    command: 'getInitialData',
  });
  (window as any).ascEventBus.on('comGraphRendering', (args) => {
    loadingStep.value = args;
  })
});
</script>

<template>
  <header :class="[outputDirPath && 'com-graph-with-navbar']">
    <ComGraph
      v-if="graphType === 'returnCom'"
      :outputDirPath="outputDirPath"
      :jsonContent="jsonContent"
      :loadingStep="loadingStep"
      :openMode="openMode"
      :nodeMagic="nodeMagic"
      :pass-index="passIndex"
      :path-name="pathName"
      :file-name="fileName"
    />
    <SearchEntry
      v-if="graphType === 'comGraphFullSearchEntry'"
      :disabled-search-mode="disabledSearchMode"
      @full-render="onFullRender"
      @search-mode="() => (graphType = 'comGraphSearchMode')"
    />
    <SearchMode v-if="graphType === 'comGraphSearchMode'" :jsonContent="jsonContent" />
    <SwimGraph v-if="graphType === 'returnSwim'" />
    <ErrorView v-if="graphType === 'returnError'" :jsonContent="errorMessage" />
    <DiffComGraph
      v-if="graphType === 'returnDiffCom'"
      :afterJson="diffInfo.afterJson"
      :afterFileName="diffInfo.afterFileName"
      :beforeJson="diffInfo.beforeJson"
      :beforeFileName="diffInfo.beforeFileName"
      :loadingStep="loadingStep"
    />
    <div class="parent-container" v-if="graphType === 'controlFlow'">
      <ControlFlowIndex></ControlFlowIndex>
    </div>
  </header>
  <!-- 导航栏 -->
  <SideBarView v-if="graphType === 'returnSidBar'"></SideBarView>
</template>
<style scoped>
.parent-container {
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
}
</style>
<style lang="scss">
header {
  min-width: 960px;

  &.com-graph-with-navbar {
    min-width: 1076px;
  }
}
</style>
