<script setup lang="ts">
import {onMounted, ref} from 'vue';
import SwimGraph from './components/swimGraph/swimGraphComplete.vue';
import ErrorView from './components/comGraph/error.vue';
import SearchMode from './components/comGraph/searchMode.vue';
import {getQuery} from './core/query';
import {vscode} from './core/vscode';
import {useTheme} from './theme/use-theme';
import SideBarView from './components/sideBar/SideBarView.vue';
import ControlFlowIndex from "./components/controlFlowGraph/ControlFlowIndex.vue";
import MiddleLayer from './components/comGraph/middleLayer.vue';

const graphType = ref('');
const jsonContent = ref({});
const errorMessage = ref('');
const outputDirPath = ref('');
const {updateTheme} = useTheme();

getQuery().then((query) => {
  graphType.value = query._viewType;
});

const errorListener = (args) => {
  graphType.value = 'returnError';
  errorMessage.value = args;
};


(window as any).ascEventBus.on('jsonParseError', errorListener);

const returnSidBar = (message) => {
  graphType.value = 'returnSidBar';
  jsonContent.value = message.data;
};

const returnTheme = (message) => {
  updateTheme(message.data);
};



const CommandCallbackMap = {
  returnSidBar,
  returnTheme,
};

window.addEventListener('message', (event) => {
  const message = event.data;
  CommandCallbackMap[message.command]?.(message);
});


onMounted(() => {
  document.addEventListener('contextmenu',(e) =>{
    e.preventDefault();//阻止原生菜单弹出
  });
});

const layout = ref('triangular');


</script>

<template>
  <header :class="[outputDirPath && 'com-graph-with-navbar']">
    
    <MiddleLayer v-if="graphType" :graphType="graphType" ></MiddleLayer>
    <SearchMode v-if="graphType === 'comGraphSearchMode'" :jsonContent="jsonContent" />
    <ErrorView v-if="graphType === 'returnError'" :jsonContent="errorMessage" />
  </header>
  <div class="parent-container" v-if="graphType === 'controlFlow'">
    <ControlFlowIndex></ControlFlowIndex>
  </div>
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
