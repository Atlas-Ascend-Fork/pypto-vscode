<template>
  <d-dropdown
    :visible="isOpen"
    trigger="manually"
    close-scope="blank"
    :position="['bottom']"
    class="path-list-menu-wrap"
    @toggle="onToggle"
  >
    <div :class="['path-list-container', isOpen && 'is-open']" @click="() => (isOpen = !isOpen)">
      <div class="selected-path">
        <div class="path-parent" :title="parentData">{{ parentData }}</div>
        <div class="path-current" :title="currentData?.label">{{ currentData?.label }}</div>
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
      <d-tree ref="treeEl" :data="treeData" class="path-list-tree" @node-click="onNodeClick">
        <template #content="{ nodeData }">
          <span class="path-list-tree-node-content" :title="nodeData.label">{{ nodeData.label }}</span>
        </template>
      </d-tree>
      <div v-if="searchNoRes" class="search-no-res">{{ t('noDataMatched') }}</div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { NavbarProvideKey } from './navbar-types';
import type { NavbarContext, PathTreeData } from './navbar-types';
import type { ControlFlowPath } from '../../../../../src/types/control-flow/path';
import { transformAndFlatTreeData } from './util';

const { t } = useI18n();
const { rootProps, controlFlowList, passList } = inject(NavbarProvideKey) as NavbarContext;
const isOpen = ref(false);
const treeEl = ref();
const TreeDataMap: Record<PathTreeData['label'], PathTreeData> = {};
const treeData = ref<PathTreeData[]>([]);
const currentData = ref<PathTreeData>();
const searchNoRes = ref(false);
const parentData = computed(() => {
  if (currentData.value) {
    return TreeDataMap[currentData.value.label]?.parentNode?.label;
  }
  return '';
});

watch(
  controlFlowList,
  (val) => {
    if (val?.length) {
      treeData.value = transformAndFlatTreeData(val, TreeDataMap);
    }
  },
  { immediate: true },
);

watch(
  [treeData, () => rootProps.currentPathMagicName],
  () => {
    if (treeData.value.length && rootProps.currentPathMagicName) {
      const keys = Object.keys(TreeDataMap);
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].startsWith(rootProps.currentPathMagicName)) {
          currentData.value = TreeDataMap[keys[i]];
          passList.value = (currentData.value?.controlFlowData as ControlFlowPath).meta?.passes ?? [];
        }
      }
    }
  },
  { immediate: true },
);

const onToggle = (val) => {
  isOpen.value = val;
  if (val) {
    nextTick(() => {
      treeEl.value.treeFactory.selectNode(currentData.value);
    });
  }
};

function onSearch(val: string) {
  treeEl.value.treeFactory.searchTree(val, { isFilter: true });
  searchNoRes.value = treeEl.value.treeFactory.treeData.value.every((item) => item.isHide);
}

function onNodeClick(node: PathTreeData) {
  if (node.isLeaf) {
    isOpen.value = false;
    currentData.value = node;
    passList.value = (node.controlFlowData as ControlFlowPath).meta.passes ?? [];
  } else {
    treeEl.value.treeFactory.deselectNode(node);
    treeEl.value.treeFactory.selectNode(currentData.value);
  }
}
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.path-list-container {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
  cursor: pointer;

  .path-parent {
    color: var(--devui-primary-text);
    font-size: 12px;
    font-weight: bold;
    line-height: 18px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
.path-list-menu-wrap {
  width: 400px;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--devui-select-bg);
  box-sizing: border-box;

  .path-list-search {
    margin-bottom: 16px;

    .devui-search__icon {
      svg path {
        fill: var(--devui-placeholder-text);
      }
    }
    .devui-input {
      border: none;
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
    .devui-tree__node-content {
      &:not(.active):hover {
        background-color: var(--devui-input-hover-bg);
      }

      &.active {
        color: var(--devui-operation-text-hover);
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
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
