<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getQuery } from './core/query';
import { useTheme } from './theme/use-theme';
import ControlFlowIndex from './components/controlFlowGraph/ControlFlowIndex.vue';
import MiddleLayer from './components/comGraph/middleLayer.vue';
import PtoConfigIndex from './components/titleFwkConfig/PtoConfigIndex.vue';
import SideBarViewIndex from './components/sideBar/SideBarViewIndex.vue';

const graphType = ref('');
const outputDirPath = ref('');
const { updateTheme } = useTheme();

getQuery().then((query) => {
  graphType.value = query._viewType;
});

const returnTheme = (message) => {
  updateTheme(message.data);
};

const CommandCallbackMap = {
  returnTheme,
};

window.addEventListener('message', (event) => {
  const message = event.data;
  CommandCallbackMap[message.command]?.(message);
});

onMounted(() => {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); //阻止原生菜单弹出
  });
});
</script>

<template>
  <!-- 导航栏 -->
  <SideBarViewIndex v-if="graphType === 'returnSidBar'"></SideBarViewIndex>
  <!-- 控制流 -->
  <div class="parent-container" v-else-if="graphType === 'controlFlow'">
    <ControlFlowIndex></ControlFlowIndex>
  </div>
  <header v-else-if="graphType" :class="[outputDirPath && 'com-graph-with-navbar']">
    <PtoConfigIndex v-if="graphType === 'ptoNewConfig'"></PtoConfigIndex>    
    <MiddleLayer v-else :graphType="graphType"></MiddleLayer>
  </header>
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
