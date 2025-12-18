<template>
  <div class="full-screen-layout">
    <SplitViewContainer>
      <template #view1="{ locked, lock, unlock }">
        <SideBarTreeView :isExpandable="locked" @tree-expand="(collapse) => (collapse ? lock(44) : unlock())"></SideBarTreeView>
      </template>
      <!-- TODO 临时屏蔽运行配置入口 -->
      <!-- <template #view2="{ locked, lock, unlock }">
        <SideBarRunConfigView :isExpandable="locked" @tree-expand="(collapse) => (collapse ? lock(28) : unlock())"></SideBarRunConfigView>
      </template> -->
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
