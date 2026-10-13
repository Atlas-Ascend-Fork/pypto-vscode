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
  <d-dropdown
    :visible="isOpen"
    trigger="manually"
    close-scope="blank"
    :position="['bottom']"
    :offset="7"
    class="path-list-menu-wrap"
    :appendToBody="false"
    :style="{ '--menu-width': `${menuWidth}px` }"
    @toggle="onToggle"
  >
    <div :class="['path-list-container', isOpen && 'is-open']" @click="() => (isOpen = !isOpen)">
      <div class="selected-path">
        <div class="path-parent" v-if="pathName === 'program'" :title="pathTitle">{{ pathTitle }}</div>
        <div class="path-parent" v-else :title="parentData">{{parentData}}</div>
        <div class="path-current" :title="currentData?.label">{{ currentData ? parsePathMagicName(currentData?.label) : '' }}</div>
      </div>
      <i class="icon-chevron-down-2"></i>
    </div>
    <template #menu>
      <d-search
        icon-position="left"
        is-keyup-search
        :placeholder="`${t('comGraph.search')}path`"
        :show-glow-style="false"
        class="path-list-search"
        @click.stop
        @search="onSearch"
      ></d-search>
      <d-tree ref="treeEl" :data="treeData" class="path-list-tree pypto-scrollbar" @node-click="onNodeClick">
        <template #content="{ nodeData }">
          <PathIcon v-if="nodeData.controlFlowData.nodeType === 'PATH'" />
          <LoopIcon v-if="nodeData.controlFlowData.nodeType === 'LOOP'" />
          <IfIcon v-if="nodeData.controlFlowData.nodeType === 'IF'" />
          <span class="path-list-tree-node-content" :title="nodeData.label">
            {{ nodeData.controlFlowData.nodeType === 'PATH' ? parsePathMagicName(nodeData.label) : nodeData.label }}
          </span>
        </template>
      </d-tree>
      <div v-if="searchNoRes" class="search-no-res">{{ t('noDataMatched') }}</div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { getQuery } from '@/core/query';
import { NavbarProvideKey } from './navbar-types';
import type { NavbarContext, PathTreeData, ControlFlowData } from './navbar-types';
import type { ControlFlowPath } from '../../../../../src/types/control-flow/path';
import { transformAndFlatTreeData, parsePathMagicName, pruneControlFlowData, getMaxDepth } from './util';
import LoopIcon from './icons/loop-icon.vue';
import PathIcon from './icons/path-icon.vue';
import IfIcon from './icons/if-icon.vue';

const { t } = useI18n();
const { rootProps, controlFlowList, passList, currentPathCalledLeafRecord, jumpComGraph } = inject(NavbarProvideKey) as NavbarContext;
const isOpen = ref(false);
const treeEl = ref();
const TreeDataMap: Record<PathTreeData['label'], PathTreeData> = {};
const treeData = ref<PathTreeData[]>([]);
const currentData = ref<PathTreeData>();
const searchNoRes = ref(false);
const pathName = ref('')
const pathTitle = ref('');
const prunedDataRef = ref<ControlFlowData[]>([]);

const parentData = computed(() => {
  if (currentData.value) {
    return TreeDataMap[currentData.value.label]?.parentNode?.label;
  }
  return '';
});

const menuWidth = computed(() => {
  const depth = getMaxDepth(prunedDataRef.value);
  const baseWidth = 400;
  const widthPerLevel = 30;
  const maxWidth = 800;
  const threshold = 12;
  if (depth <= threshold) {
    return baseWidth;
  }
  return Math.min(baseWidth + (depth - threshold) * widthPerLevel, maxWidth);
});

watch(
  controlFlowList,
  (val) => {
    if (val?.length) {
      const prunedData = pruneControlFlowData(val);
      prunedDataRef.value = prunedData;
      treeData.value = transformAndFlatTreeData(prunedData, TreeDataMap);
    }
  },
  { immediate: true },
);

watch(
  [treeData, () => rootProps.currentPathMagicName],
  () => {
    if (treeData.value.length && rootProps.currentPathMagicName) {
      const fileNameRegExp = new RegExp(
        `^After_0${rootProps.currentPassIndex}_[a-z0-9A-Z]*(?:_\\d+)?_(\\w+_PATH\\d+)_\\d+(?:_(ROOT|LEAF)(?:_program_id_(\\d+)_(\\d+))?)?\\.json$`,
      );
      const [_, pathName] = rootProps.currentLeafName.match(fileNameRegExp) ?? [];
      let magicName = rootProps.currentPathMagicName;
      if (rootProps.currentPathMagicName !== pathName) {
        magicName = pathName;
      }
      const keys = Object.keys(TreeDataMap);
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].startsWith(rootProps.currentPathMagicName)) {
          currentData.value = TreeDataMap[keys[i]];
          passList.value = (currentData.value?.controlFlowData as ControlFlowPath).meta?.passes ?? [];
        }
        if (keys[i].startsWith(magicName)) {
          currentPathCalledLeafRecord.value = (TreeDataMap[keys[i]].controlFlowData as ControlFlowPath).meta?.calledRecords ?? [];
        }
      }
    }
  },
  { immediate: true },
);

let timer: ReturnType<typeof setTimeout>;
const onToggle = (val) => {
  isOpen.value = val;
  if (val) {
    nextTick(() => {
      treeEl.value.treeFactory.selectNode(currentData.value);
      timer = setTimeout(() => {
        const listDom = treeEl.value.$el;
        const activeItem = listDom.querySelector('.devui-tree__node.active');
        if (activeItem) {
          const activeItemTop = activeItem.getBoundingClientRect().top;
          const listTop = listDom.getBoundingClientRect().top;
          listDom.scrollTop = activeItemTop - listTop;
        }
        timer && clearTimeout(timer);
      });
    });
  }
};

function onSearch(val: string) {
  treeEl.value.treeFactory.searchTree(val, { isFilter: true, matchKey: 'magicName' });
  searchNoRes.value = treeEl.value.treeFactory.treeData.value.every((item) => item.isHide);
}

let isBootStep = false;
function onNodeClick(node: PathTreeData) {
  if (node.isLeaf) {
    isOpen.value = false;
    currentData.value = node;
    const tempPassList = (node.controlFlowData as ControlFlowPath).meta.passes ?? [];
    if (tempPassList.length) {
      const lastPass = tempPassList[tempPassList.length - 1];
      jumpComGraph(lastPass.graphFilePath, lastPass.pathName, isBootStep);
    }
  } else {
    treeEl.value.treeFactory.deselectNode(node);
    treeEl.value.treeFactory.selectNode(currentData.value);
  }
}

onMounted(async () => {
  const res = await getQuery();
  const query = JSON.parse(res._uri.query);
  isBootStep = Boolean(query.isBootStep);
  pathName.value = query.pathName;
  pathTitle.value = res?.subFuncmagicname ? res?.subFuncmagicname : 'Program';
});
</script>

<style scoped lang="scss">
@use 'devui-theme/styles-var/devui-var.scss' as *;

.path-list-container {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
  min-width: 80px;
  cursor: pointer;

  &:hover {
    .path-parent {
      color: var(--devui-operation-text-hover);
    }
  }

  .path-parent {
    color: var(--devui-primary-text);
    font-size: 12px;
    font-weight: bold;
    line-height: 18px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
  }

  .path-current {
    color: var(--devui-placeholder-text);
    font-size: 12px;
    line-height: 18px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  i {
    font-size: 16px;
    color: var(--devui-primary-text);
    transition: transform $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
  }

  &.is-open {
    i {
      transform: rotate(180deg);
    }
  }
}
</style>

<style lang="scss">
.devui-flexible-overlay:has(.path-list-menu-wrap) {
  border-radius: 8px;
  box-shadow: var(--devui-select-shadow);
}

.path-list-menu-wrap {
  width: var(--menu-width, 400px);
  padding: 8px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;

  .path-list-search {
    margin-bottom: 16px;

    &:not(.devui-search--focus):hover {
      .devui-input {
        border-color: var(--devui-primary-button-hover-bg) !important;
      }
    }

    &.devui-search--focus {
      .devui-input {
        border-color: var(--devui-primary-button-active-bg);
      }
    }

    .devui-search__icon {
      height: 28px;
      svg path {
        fill: var(--devui-placeholder-text);
      }
    }
    .devui-input {
      height: 28px;
      border-color: transparent;
      background-color: var(--devui-input-bg);

      .devui-input__wrapper,
      input {
        background-color: transparent;

        &::placeholder {
          color: var(--devui-placeholder-text);
        }
      }
    }
  }

  .path-list-tree {
    max-height: 400px;
    overflow: auto;
  }

  .devui-tree__node-folder {
    .devui-tree__node-indent {
      width: 0;
      margin-left: 0;
    }
    svg {
      display: none;
    }
  }

  .devui-tree__node-vline,
  .devui-tree__node-hline {
    background-color: var(--devui-disabled-icon);
  }

  .devui-tree__node {
    color: var(--devui-primary-text);

    &.devui-tree__node--open {
      color: var(--devui-secondary-text);
    }

    .devui-tree__node-content {
      &:not(.active):hover {
        background-color: var(--devui-input-hover-bg);
      }

      &.active {
        background-color: var(--devui-input-active-bg);
      }

      &:has(span.toggle-disabled) {
        cursor: default;
        &:hover {
          background-color: transparent;
        }

        .devui-tree__node-title {
          cursor: default;
        }
      }
    }

    .devui-tree__node-title {
      margin-left: 0;
    }
  }

  .search-no-res {
    text-align: center;
    color: var(--devui-placeholder-text);
    font-size: 12px;
    line-height: 16px;
  }
}

.path-list-tree-node-content {
  flex: 1;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: 4px;
}
</style>
