<script setup lang="ts">
import { onMounted, ref } from 'vue';
import ComGraph from './components/comGraph/comGraph.vue';
import SwimGraph from './components/swimGraph/swimGraphComplete.vue';
import DiffComGraph from './components/diffComGraph/diffComGraph.vue';
import ErrorView from './components/comGraph/error.vue';
import { comGraphStore } from './service/com-graph-store';
import { useTheme } from './theme/use-theme';
import { getQuery } from './core/query';
import { vscode } from './core/vscode';

const graphType = ref('');
const jsonContent = ref({});
const errorMessage = ref('');
const loadingStep = ref('');
const diffInfo = ref({});
const { updateTheme } = useTheme();

getQuery().then((query) => {
  graphType.value = query.viewType;
});

const errorListener = (args) => {
  graphType.value = 'returnError';
  errorMessage.value = args;
};

(window as any).ascEventBus.on('jsonParseError', errorListener);

const returnCom = (message) => {
  jsonContent.value = message.data;
  loadingStep.value = message.step;
};

const returnInitData = (message) => {
  vscode.value.setState({
    fsPath: message.fsPath,
    funcHash: message.funcHash,
    magicName: message.magicName,
  });
};

const readJsonWarning = (message) => {
  loadingStep.value = message.command;
};

const returnSwim = (message) => {
  graphType.value = 'returnSwim';
  jsonContent.value = message.data;
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
  returnCalleeOpAttrMap,
  returnTheme,
  initComGraph,
  returnError,
  returnInitData,
  readJsonWarning,
  initDiffComGraph,
  returnDiffCom,
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

window.addEventListener('message', (event) => {
  const message = event.data;
  CommandCallbackMap[message.command]?.(message);
});

onMounted(() => {
  vscode.value.postMessage({
    command: 'getInitialData',
  });
});
</script>

<template>
  <header>
    <ComGraph v-if="graphType === 'returnCom'" :jsonContent="jsonContent" :loadingStep="loadingStep" />
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
  </header>
</template>

<style lang="scss">
header {
  min-width: 960px;
}
</style>
