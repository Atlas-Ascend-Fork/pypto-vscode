<template>
  <div class="sidebar-container">
    <!-- 标题栏 -->
    <div class="header">
      <div class="name">
        {{ t('sideBar.title') }}
      </div>
      <div class="expand" @click="treeExpand">
        <d-icon :name="isExpanded ? 'icon-chevron-up-2' : 'icon-chevron-down-2'"></d-icon>
      </div>
      <div class="refresh" :class="{ hidden: isExpanded }" @click="handleReload">
        <d-icon name="refresh"></d-icon>
      </div>
      <div :class="{ hidden: isExpanded }" class="flex1"></div>
      <SideBarSearch :class="{ hidden: isExpanded }" @search="updateKeyword"></SideBarSearch>
    </div>
    <!-- 筛选区 -->
    <div class="filters" :class="{ hidden: isExpanded }">
      <div class="sort" operable @click="sortOption = !sortOption">
        <span class="sort-name">{{ t('sideBar.sortName') }}</span>
        <div class="sort-group">
          <img v-if="sortOption" :src="sortUp" class="sort-icon" />
          <img v-else :src="sortDown" class="sort-icon" />
        </div>
      </div>
    </div>
    <!-- 树组件：双插槽用法 -->
    <div class="tree-container" :class="{ hidden: isExpanded }" v-loading="isLoading">
      <d-tree
        ref="treeRef"
        :data="visibleTreeData"
        :node-class="() => 'custom-tree-node'"
        show-line="false"
        @node-click="nodeClick"
        @lazy-load="lazyLoad"
      >
        <!-- 1. content插槽：自定义节点主内容（图标+文本）-->
        <template #content="{ nodeData }">
          <div class="tree-container-content">
            <div class="icon">
              <!-- 节点图标（文件夹/文件） -->
              <i v-if="nodeData.type === 'dir' && !nodeData.executeTime" class="icon-folder-new"></i>
              <i v-if="nodeData.fileType === 'computeGraph'" class="icon-json"></i>
              <i v-if="nodeData.extname === 'json'" class="icon-file"></i>
            </div>

            <!-- 节点文本区域（两行布局） -->
            <div v-if="nodeData.type === 'dir'" :class="{ 'node-text-folder': nodeData.level === 1 }">
              <div class="node-label" v-html="textToHighlightHtml(nodeData.label)"></div>
              <div class="node-date" v-if="nodeData.date">{{ nodeData.date }}</div>
            </div>
            <div v-else class="node-text-children">
              <div class="node-label" v-html="textToHighlightHtml(nodeData.label)"></div>
            </div>
          </div>
        </template>

        <!-- 2. icon插槽：自定义展开/折叠按钮 -->
        <template #icon="{ nodeData, toggleNode }">
          <div class="toggle-icon-container">
            <!-- 叶子节点：显示空白占位 -->
            <span v-if="nodeData.isLeaf" class="devui-tree-node__indent"></span>
            <!-- 非叶子节点：显示展开/折叠箭头 -->
            <div v-else>
              <div @click.stop="() => toggleNode(nodeData)" :class="{ 'devui-tree-node-icon': nodeData.date }">
                <i
                  class="icon icon-chevron-right"
                  :style="{
                    transform: nodeData.expanded ? 'rotate(90deg)' : '',
                    cursor: 'pointer',
                  }"
                ></i>
              </div>
            </div>
          </div>
        </template>
      </d-tree>
      <LoadMoreTrigger :all-loaded="allLoaded" @load-more="handleLoadMore" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getOutputDetail, getOutputRecords } from '@/apis/workspace';
import { DevUITreeNode } from '@/components/sideBar/types/sidebarModle';
import { openComputeGraph, openControlFlow, openSwimlaneGraph } from '@/apis/opener';

import { useSearchingHighlight } from '../hooks/use-searching-highlight';
import { debounce } from 'lodash-es';
import SideBarSearch from './SideBarSearch.vue';
import LoadMoreTrigger from '../../util/LoadMoreTrigger.vue';

type OutputRecords = Awaited<ReturnType<typeof getOutputRecords>>['data'];

type DirectoryTree = Awaited<ReturnType<typeof getOutputDetail>>['data']['directoryTree'];
const sortDown = ref(`${window.staticPath}/static-assets/control_flow_sidebar_sort_down.svg`);
const sortUp = ref(`${window.staticPath}/static-assets/control_flow_sidebar_sort_up.svg`);
const { t } = useI18n();
const { updateKeyword, textToHighlightHtml } = useSearchingHighlight();

const isExpanded = ref(false);
const emit = defineEmits<{ (e: 'tree-expand', value: boolean) }>();
function treeExpand() {
  isExpanded.value = !isExpanded.value;
  emit('tree-expand', isExpanded.value);
}

/**
 * 树节点数据
 * - 文件夹节点：type='dir', isLeaf=false, 可包含children
 * - 文件节点：type='file', isLeaf=true, 无children
 */
const treeData = ref<DevUITreeNode[]>([]);
const visibleTreeData = computed(() => [...treeData.value]);

function nodeClick(node: DevUITreeNode): void {
  if (node.fileType === 'controlFlow') {
    // 打开控制流
    openControlFlow({
      controlFlowPath: node.absolutePath,
      outputPath: node.outputPath,
    });
  } else if (node.fileType === 'swimlaneGraph') {
    // 打开泳道图
    openSwimlaneGraph({ swimlaneGraphPath: node.absolutePath });
  } else if (node.fileType === 'computeGraph') {
    // 打开计算图
    openComputeGraph({
      computeGraphPath: node.absolutePath,
      outputPath: node.pathName ? node.outputPath : undefined,
      pathName: node.pathName,
    });
  } else {
    toggleNode(node);
  }
}

const treeRef = ref(null);
/**
 * 展开/折叠
 */
function toggleNode(node: DevUITreeNode): void {
  treeRef.value.treeFactory.toggleNode(node);
}

const nodeChildrenMap = new Map<string, Promise<DevUITreeNode[]>>();

function transformData(outputData: OutputRecords): DevUITreeNode[] {
  nodeChildrenMap.clear();

  function transformChild(subDirOrFile: DirectoryTree['children']): DevUITreeNode[] {
    const children: DevUITreeNode[] = [];
    for (const dirOrFile of subDirOrFile) {
      const child: DevUITreeNode = {
        id: dirOrFile.absolutePath,
        label: dirOrFile.name,
        type: dirOrFile.type,
        expanded: false,
        isLeaf: !(dirOrFile.type === 'dir' && dirOrFile.children.length),
        ...dirOrFile,
        children: undefined,
      };
      children.push(child);
      if (dirOrFile.type === 'dir' && !child.isLeaf) {
        nodeChildrenMap.set(child.id, Promise.resolve(transformChild(dirOrFile.children as unknown as DirectoryTree['children'])));
      }
    }
    return children;
  }

  const records: DevUITreeNode[] = [];
  for (const record of outputData) {
    const rootNode: DevUITreeNode = {
      id: record.title,
      label: record.title,
      type: 'dir',
      date: record.executeTime,
      expanded: false,
      isLeaf: false,
      ...record,
    };

    // 记录子节点
    const child = getOutputDetail(record.directoryPath).then((detail) => {
      return transformChild(detail.data?.directoryTree.children ?? []);
    });
    nodeChildrenMap.set(rootNode.id, child);

    records.push(rootNode);
  }
  return records;
}

async function lazyLoad(parentNode: DevUITreeNode, callback: (response: { treeItems: DevUITreeNode[]; node: DevUITreeNode }) => void) {
  const treeItems = await nodeChildrenMap.get(parentNode.id);
  callback({ treeItems, node: parentNode });
}

onMounted(() => {
  getOutputs();
  // 禁用原生右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 阻止原生菜单弹出
  });
});

const isLoading = ref(false);
let page = 1;
const pageSize = 50;
const allLoaded = ref(false);

/**
 * 刷新、修改筛选条件
 */
function handleReload() {
  page = 1;
  getOutputs();
}

/**
 * 加载更多
 */
function handleLoadMore() {
  if (isLoading.value) {
    return;
  }
  page += 1;
  getOutputs();
}

async function getOutputs(): Promise<void> {
  isLoading.value = true;
  try {
    const { data } = await getOutputRecords({ page, pageSize, sortOrder: sortOption.value ? 'asc' : 'desc' });
    if (page === 1) {
      treeData.value = [];
    }
    if (data.length < pageSize) {
      allLoaded.value = true;
    }
    treeData.value.push(...transformData(data));
  } catch (e: unknown) {
    isLoading.value = false;
    if (e instanceof Error) {
      throw e;
    }
  }
  isLoading.value = false;
}

const debouncedGetRecords = debounce(handleReload, 500);

const sortOption = ref(false);

watch(sortOption, () => {
  debouncedGetRecords();
});
</script>

<style>
/**
 * 基础样式
 */
.sidebar-container {
  background: var(--devui-card-bg);
  color: var(--control-flow-sidebar-search-icon);
  min-height: 100%;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 11px;
  padding-top: 8px;
}
</style>
<style scoped lang="less">
@import url('@devui-design/icons/icomoon/devui-icon.css');

.header {
  display: flex;
  justify-content: start;
  align-items: center;
  height: 28px;
  padding: 0 16px;

  .name {
    color: var(--control-flow-sidebar-search-title);
    margin: 0;
    font-size: 14px;
    line-height: 27px;
  }
  .expand {
    width: 28px;
    height: 28px;
    padding: 7px;
    font-size: 14px;
    cursor: pointer;
    :deep(*) {
      color: var(--control-flow-sidebar-search-icon);
    }
  }
  .refresh {
    width: 28px;
    height: 28px;
    padding: 7px;
    font-size: 14px;
    cursor: pointer;

    &:hover {
      :deep(*) {
        color: var(--devui-link-text);
      }
    }

    :deep(*) {
      color: var(--control-flow-sidebar-search-icon);
    }
  }

  .flex1 {
    flex: 1;
  }

  .tree-search {
    width: 150px;
  }

  .icon {
    font-size: 16px;
    opacity: 0.8;
  }
}

.filters {
  display: flex;
  width: 100%;
  flex-direction: row;
  justify-content: start;
  align-items: center;
  padding: 0 16px;
  gap: 24px;
  height: 28px;

  .sort {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    background-color: var(--control-flow-sidebar-search-button);
    border-radius: 4px;
    box-sizing: border-box;
    white-space: nowrap;
    text-overflow: ellipsis;
    height: 28px;
    line-height: 28px;
    padding: 8px;

    .sort-name {
      font-size: 13px;
    }

    .sort-group {
      height: 28px;
      display: flex;
      align-items: center;
      cursor: pointer;
      .sort-icon {
        width: 16px;
        height: 16px;
        font-size: 16px;
      }
    }
  }

  .filter-select {
    width: 132px;
    height: 28px;
    border-radius: 8px !important;
  }
}

.tree-container {
  width: 100%;
  flex: 1;
  min-height: 0;
  margin-top: 4px;
  box-sizing: border-box;
  overflow: auto;

  :deep(.devui-tree) {
    min-width: 100%;
    width: fit-content;
    height: fit-content;
    min-height: 48px;

    /* 节点文本样式 */
    .devui-tree__node {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      padding: 0px 12px;

      &[style*='padding-left: 0px'] {
        height: 48px;
      }

      // 顶层节点之间显示分隔线
      border-bottom: 1px solid transparent;

      &:has(+ .devui-tree__node[style*='padding-left: 0px']),
      &:last-of-type {
        border-bottom-color: var(--vscode-sideBar-border);
      }

      &.active {
        background-color: var(--devui-input-active-bg);

        .node-label {
          color: var(--control-flow-sidebar-tree-label) !important;
        }
      }

      &:hover {
        background-color: var(--devui-input-hover-bg);
        .node-label {
          color: var(--control-flow-sidebar-tree-label) !important;
        }
      }

      .devui-tree__node-content--value-wrapper {
        height: max-content !important;

        .tree-container-content {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
          margin-left: 4px;

          .icon {
            font-size: 16px;

            .icon-file {
              color: orange;
            }

            .icon-json {
              color: orange;
            }
          }

          .node-text-folder {
            display: flex;
            justify-content: center;
            flex-direction: column;
            height: 48px !important;

            .node-label {
              font-size: 14px;
              line-height: 22px;
              color: var(--control-flow-sidebar-tree-main-label);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .node-date {
              font-size: 12px;
              line-height: 18px;
              color: var(--control-flow-sidebar-tree-placeholder);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }

          .node-text-children {
            display: flex;
            justify-content: center;
            flex-direction: column;
            height: 28px !important;

            .node-label {
              font-size: 13px;
              color: var(--devui-secondary-text);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 20px;
            }
          }
        }
      }

      .toggle-icon-container {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        height: 100%;

        .devui-tree-node-icon {
          font-size: 16px;
          display: flex;
          flex-direction: column;

          .icon {
            align-items: start;
          }
        }
      }

      .devui-tree__node-content {
        &.active,
        &:hover {
          background-color: transparent;
        }
      }

      .devui-tree__node-vline {
        opacity: 0 !important;
        height: 0px !important;
      }

      .devui-tree__node-hline {
        opacity: 0 !important;
        height: 0px !important;
      }
    }
  }
}
</style>
