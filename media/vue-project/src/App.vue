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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { getQuery } from './core/query';
import { useTheme } from './theme/use-theme';
import ControlFlowIndex from './components/controlFlowGraph/ControlFlowIndex.vue';
import MiddleLayer from './components/comGraph/middleLayer.vue';
import RunConfig from './components/runConfig/RunConfig.vue';
import SideBarViewIndex from './components/sideBar/SideBarViewIndex.vue';
import WelcomeIndex from './components/welcome/WelcomeIndex.vue';
import BootStepTips from './components/welcome/components/BootStepTips.vue';
import OpCheckIndex from './components/opCheck/OpCheckIndex.vue';
import TaskCheckIndex from './components/taskCheck/TaskCheckIndex.vue';
import { getIsCompleteBoot } from './apis/welcome';

const graphType = ref('');
const outputDirPath = ref('');
const { updateTheme } = useTheme();
const showGlobalGuide = ref(false);

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

onMounted(async () => {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); //阻止原生菜单弹出
  });
  showGlobalGuide.value = await getIsCompleteBoot();
});
</script>

<template>
  <!-- 导航栏 -->
  <SideBarViewIndex v-if="graphType === 'returnSidBar'"></SideBarViewIndex>
  <!-- 控制流 -->
  <div id="boot-controlFlow-index" class="parent-container" v-else-if="graphType === 'controlFlow'">
    <ControlFlowIndex></ControlFlowIndex>
  </div>
  <!-- 欢迎页面 -->
  <WelcomeIndex class="parent-container" v-else-if="graphType === 'welcome'"></WelcomeIndex>
  <!-- OpCheck -->
  <OpCheckIndex class="parent-container" v-else-if="graphType === 'opCheck'"></OpCheckIndex>
  <!-- TaskCheck -->
  <TaskCheckIndex class="parent-container" v-else-if="graphType === 'taskCheck'"></TaskCheckIndex>
  <!-- 运行配置 -->
  <RunConfig v-else-if="graphType === 'editRunConfig'"></RunConfig>
  <header id="boot-middleLayer" v-else-if="graphType" :class="[outputDirPath && 'com-graph-with-navbar']">
    <MiddleLayer :graphType="graphType"></MiddleLayer>
  </header>
  <!-- 全局引导弹窗 -->
  <BootStepTips
    v-if="showGlobalGuide && graphType !== 'returnSidBar' && graphType !== 'editRunConfig' && graphType !== 'welcome' && graphType !== 'opCheck' && graphType !== 'taskCheck'"
    v-model:visible="showGlobalGuide"
    :graphType="graphType"
  />
</template>
<style scoped>
.parent-container {
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
