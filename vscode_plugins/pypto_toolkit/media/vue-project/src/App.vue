<script setup lang="ts">
import { onMounted, ref } from 'vue';
import ComGraph from './components/comGraph/comGraph.vue';
import SwimGraph from './components/swimGraph/swimGraphComplete.vue';
import ErrorView from './components/comGraph/error.vue'
import { comGraphStore } from './service/com-graph-store';
import { useTheme } from './theme/use-theme';

const graphType = ref('');
const jsonContent = ref({});
const errorMessage = ref('');
const loadingStep = ref('');
const { updateTheme } = useTheme();

const errorListener = (args) => {
  graphType.value = 'returnError';
  errorMessage.value = args;
}

(window as any).ascEventBus.on('jsonParseError', errorListener);

const returnCom = (message) => {
  jsonContent.value = message.data;
  loadingStep.value = message.step;
};

const returnInitData = (message) => {
  vscode.setState({
    fsPath: message.fsPath,
    funcHash: message.funcHash,
    magicName: message.magicName
  })
};

const readJsonWarning = (message) => {
  loadingStep.value = message.command;
}

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

const initComGraph = (message) => {
  graphType.value = 'returnCom';
  loadingStep.value = message.step;
  dealConfig(message.configration);
}

const CommandCallbackMap = {
  returnCom,
  returnSwim,
  returnCalleeMap,
  returnTheme,
  initComGraph,
  returnError,
  returnInitData,
  readJsonWarning
};

function dealConfig(config){
  if(!config) {
    return;
  }

  if (config.tensorAttr) {
    comGraphStore.setData('tensorAttrFunc', eval(config.tensorAttr))
  }

  if (config.tensorColor) {
    comGraphStore.setData('tensorColorFunc', eval(config.tensorColor))
  }

  if (config.operationAttr) {
    comGraphStore.setData('operationAttrFunc', eval(config.operationAttr))
  }

  if (config.operationColor) {
    comGraphStore.setData('operationColorFunc', eval(config.operationColor))
  }
}

window.addEventListener('message', (event) => {
  const message = event.data;
  CommandCallbackMap[message.command]?.(message);
});

onMounted(() => {
  window.vscode.postMessage({
    command: 'getInitialData',
  });
});
</script>

<template>
  <header>
    <ComGraph v-if="graphType === 'returnCom'" :jsonContent="jsonContent" :loadingStep="loadingStep" />
    <SwimGraph v-if="graphType === 'returnSwim'" />
    <ErrorView v-if="graphType === 'returnError'" :jsonContent="errorMessage"  />
  </header>
</template>

<style lang="scss">
header {
  min-width: 960px;
}
</style>
