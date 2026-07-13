<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
