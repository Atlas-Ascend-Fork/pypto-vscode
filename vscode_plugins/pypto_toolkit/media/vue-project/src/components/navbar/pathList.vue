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
        <div class="path-parent">{{ parentData }}</div>
        <div class="path-current">{{ currentData.magicName }}</div>
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
      <d-tree ref="treeEl" :data="treeData" @node-click="onNodeClick"></d-tree>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PathList } from './mock';
import { NavbarProvideKey } from './navbar-types';
import type { NavbarContext, PathData } from './navbar-types';
import { transformAndFlatTreeData } from './util';

const { t } = useI18n();
const { passList, leafFunctions } = inject(NavbarProvideKey) as NavbarContext;
const isOpen = ref(false);
const treeEl = ref();
const TreeDataMap: Record<number, PathData> = {};
transformAndFlatTreeData(PathList, TreeDataMap);
const treeData = ref(PathList);
const currentData = ref({ id: 50, magic: 50, magicName: 'TENSOR_MLA_LOOP_L0_sIdx_Unroll1_PATH0_root_50' });
leafFunctions.value = TreeDataMap[currentData.value.magic].meta?.leafFunctions ?? [];
passList.value = TreeDataMap[currentData.value.magic].meta?.passes ?? [];
const parentData = computed(() => {
  if (currentData.value) {
    return TreeDataMap[currentData.value.magic].parentNode.magicName;
  }
  return '';
});

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
}

function onNodeClick(node) {
  if (node.isLeaf) {
    currentData.value = node;
    isOpen.value = false;
    passList.value = node.meta.passes;
    leafFunctions.value = node.meta.leafFunctions;
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
  }

  .path-current {
    color: var(--devui-placeholder-text);
    font-size: 12px;
    line-height: 18px;
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
}
</style>
