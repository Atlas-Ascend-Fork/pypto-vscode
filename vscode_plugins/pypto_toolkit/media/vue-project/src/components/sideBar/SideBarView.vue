<template>
  <div class="sidebar-container">
    <!-- 标题栏 -->
    <div class="header">
      <div class="name">
        {{ t('sideBar.title') }}
      </div>
      <div class="refresh" @click="getAllRecords">
        <d-icon name="refresh"></d-icon>
      </div>
      <div class="flex1"></div>
      <SideBarSearch @search="updateKeyword"></SideBarSearch>
    </div>
    <!-- 筛选区 -->
    <div class="filters">
      <div class="sort" operable @click="sortOption = !sortOption">
        <span class="sort-name">{{ t('sideBar.sortName') }}</span>
        <div class="sort-group">
          <img v-if="sortOption" :src="sortUp" class="sort-icon">
          <img v-else :src="sortDown" class="sort-icon">
        </div>
      </div>
    </div>
    <!-- 树组件：双插槽用法 -->
    <div class="tree-container" v-loading="isLoading">
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getOutputDetail, getOutputRecords } from '@/apis/workspace';
import { DevUITreeNode } from '@/components/sideBar/types/sidebarModle';
import { openComputeGraph, openControlFlow, openSwimlaneGraph } from '@/apis/opener';

import SideBarSearch from './SideBarSearch.vue';
import { useSearchingHighlight } from './hooks/use-searching-highlight';

type OutputRecords = Awaited<ReturnType<typeof getOutputRecords>>['data'];

type DirectoryTree = Awaited<ReturnType<typeof getOutputDetail>>['data']['directoryTree'];
const sortDown = ref(`${window.staticPath}/static-assets/control_flow_sidebar_sort_down.svg`);
const sortUp = ref(`${window.staticPath}/static-assets/control_flow_sidebar_sort_up.svg`);
const { t } = useI18n();
const treeRef = ref(null);

const { updateKeyword, textToHighlightHtml } = useSearchingHighlight();

/**
 * 树节点数据
 * - 文件夹节点：type='dir', isLeaf=false, 可包含children
 * - 文件节点：type='file', isLeaf=true, 无children
 */
const treeData = ref<DevUITreeNode[]>([]);
const visibleTreeData = computed(() => [...treeData.value]);

async function nodeClick(node: DevUITreeNode) {
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
  }
}

const nodeChildrenMap = new Map();

async function transformData(outputData: OutputRecords) {
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
        nodeChildrenMap.set(child.id, transformChild(dirOrFile.children as unknown as DirectoryTree['children']));
      }
    }
    return children;
  }

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
    const detail = await getOutputDetail(record.directoryPath);
    const child = transformChild(detail.data.directoryTree.children);
    nodeChildrenMap.set(rootNode.id, child);

    treeData.value.push(rootNode);
  }
}

function lazyLoad(parentNode: DevUITreeNode, callback: (response: { treeItems: DevUITreeNode[]; node: DevUITreeNode }) => void) {
  callback({ treeItems: nodeChildrenMap.get(parentNode.id), node: parentNode });
}

onMounted(() => {
  getAllRecords();
});

const isLoading = ref(false);
const sortOption = ref(false);

watch(sortOption, () => {
  getAllRecords();
});

async function getAllRecords(): Promise<void> {
  isLoading.value = true;
  treeData.value = [];
  try {
    const { data } = await getOutputRecords({ sortOrder: sortOption.value ? 'asc' : 'desc' });
    await transformData(data);
  } catch (e: unknown) {
    isLoading.value = false;
    if (e instanceof Error) {
      throw e;
    }
  }
  isLoading.value = false;
}
</script>

<style scoped lang="less">
@import url('@devui-design/icons/icomoon/devui-icon.css');

/**
 * 基础样式
 */
.sidebar-container {
  background: var(--devui-card-bg);
  color: var(--control-flow-sidebar-search-icon);
  min-height: 100vh;
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 11px;
  padding: 8px 0;
}

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
    box-sizing: border-box ;
    white-space: nowrap;
    text-overflow: ellipsis;
    height: 28px;
    line-height: 28px ;
    padding: 8px;

    .sort-name {
      font-size: 13px;
    }

    .sort-group {
      height: 28px;
      display: flex;
      align-items: center;

      .sort-icon{
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

      .devui-tree__node-content.active {
        background-color: transparent;
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
