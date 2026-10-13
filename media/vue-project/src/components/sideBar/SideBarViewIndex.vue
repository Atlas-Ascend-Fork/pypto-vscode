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
  <div class="full-screen-layout">
    <SplitViewContainer>
      <template #view1="{ locked, lock, unlock }">
        <SideBarTreeView :isExpandable="locked" @tree-expand="(collapse) => (collapse ? lock(44) : unlock())"></SideBarTreeView>
      </template>
      <template #view2="{ locked, lock, unlock }">
        <SideBarRunConfigView :isExpandable="locked" @tree-expand="(collapse) => (collapse ? lock(28) : unlock())"></SideBarRunConfigView>
      </template>
    </SplitViewContainer>
  </div>
</template>

<script setup>
import SideBarTreeView from './components/SideBarTreeView.vue';
import SideBarRunConfigView from './components/SideBarRunConfigView.vue';
import SplitViewContainer from '../util/split-view/SplitViewContainer.vue';

</script>

<style scoped lang="less">
/* 父容器：无默认边距，高度100% */
.full-screen-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow-x: hidden;
  overflow-y: scroll;
  margin: 0;
  padding: 0;

  &::-webkit-scrollbar {
    width: 0;
  }
}
</style>
