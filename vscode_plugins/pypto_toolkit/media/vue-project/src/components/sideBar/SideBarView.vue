<template>
  <div class="sidebar-container">
    <!-- 标题栏 -->
    <div class="header">
      <div class="title">
        <div class="name">{{ t('sideBar.title') }}</div>
      </div>
      <i class="icon icon-search-new"></i>
    </div>
    <!-- 筛选区 -->
    <div class="filters">
      <d-icon class="sort" operable @click="sortOption = !sortOption">
        <template #prefix>
          <span class="sort-name">{{ t('sideBar.sortName') }}</span>
          <div class="icon-group">
            <i v-if="sortOption" class="icon-run-o icon-up"></i>
            <i v-if="!sortOption" class="icon-run-o icon-down"></i>
          </div>
        </template>
      </d-icon>
    </div>
    <!-- 树组件：双插槽用法 -->
    <div class="tree-container">
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
            <div v-if="nodeData.type === 'dir'" :class="{ 'node-text-folder': nodeData.level === 1 }" @dblclick="nodeClick(nodeData)">
              <div class="node-label">{{ nodeData.label }}</div>
              <div class="node-date" v-if="nodeData.date">{{ nodeData.date }}</div>
            </div>
            <div v-else class="node-text-children" @dblclick="nodeClick(nodeData)">
              <div class="node-label">{{ nodeData.label }}</div>
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
              <div
                v-if="nodeData.date"
                @click="
                  (event) => {
                    event.stopPropagation();
                    toggleNode(nodeData);
                  }
                "
                class="devui-tree-node-icon"
              >
                <i
                  class="icon icon-chevron-right"
                  :style="{
                    transform: nodeData.expanded ? 'rotate(90deg)' : '',
                    cursor: 'pointer',
                  }"
                ></i>
              </div>

              <div
                v-else
                @click="
                  (event) => {
                    event.stopPropagation();
                    toggleNode(nodeData);
                  }
                "
                class="devui-tree-children-node-icon"
              >
                <i
                  class="devui-tree-children-node-icon icon icon-chevron-right"
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

type OutputRecords = Awaited<ReturnType<typeof getOutputRecords>>['data'];

type DirectoryTree = Awaited<ReturnType<typeof getOutputDetail>>['data']['directoryTree'];

const { t } = useI18n();
const treeRef = ref(null);

/**
 * 树节点数据
 * - 文件夹节点：type='dir', isLeaf=false, 可包含children
 * - 文件节点：type='file', isLeaf=true, 无children
 */
const treeData = ref<DevUITreeNode[]>([]);
const visibleTreeData = computed(() => [...treeData.value]);
/**
 * 状态管理
 */
const sortOption = ref(false);

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
  treeData.value = [];

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
    treeData.value.push(rootNode);
    const detail = await getOutputDetail(record.directoryPath);
    const child = transformChild(detail.data.directoryTree.children);
    nodeChildrenMap.set(rootNode.id, child);
  }
}

function lazyLoad(parentNode: DevUITreeNode, callback: (response: { treeItems: DevUITreeNode[]; node: DevUITreeNode }) => void) {
  callback({ treeItems: nodeChildrenMap.get(parentNode.id), node: parentNode });
}

onMounted(() => {
  getAllRecords();
});

watch(sortOption, () => {
  getAllRecords();
});

async function getAllRecords() {
  const { data } = await getOutputRecords({ sortOrder: sortOption.value ? 'asc' : 'desc' });
  console.log('output records', data);
  await transformData(data);
}
</script>

<style scoped lang="less">
@import url('@devui-design/icons/icomoon/devui-icon.css');

/**
 * 基础样式
 */
.sidebar-container {
  background: #181818;
  color: #ffffff;
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
  .title {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 2px;

    .name {
      color: #ffffff;
      margin: 0;
      font-size: 14px;
      line-height: 22px;
    }

    .icon {
      font-size: 20px;
      opacity: 0.8;
    }
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
    justify-content: space-around;
    align-items: center;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    box-sizing: border-box !important;
    white-space: nowrap;
    text-overflow: ellipsis;
    height: 28px !important;
    width: 100px !important;
    padding-left: 4px !important;

    .sort-name {
      // color: #E6E6E6;
      font-size: 13px;
    }

    .icon-group {
      display: flex;
      flex-direction: column;

      .icon-up {
        transform: rotate(-90deg);
      }

      .icon-down {
        transform: rotate(90deg);
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

    /* 节点文本样式 */
    .devui-tree__node {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      padding: 0px 12px;

      &[style*='padding-left: 0px'] {
        height: 48px;
      }

      &:has(+ .devui-tree__node[style*='padding-left: 0px']),
      &:last-of-type {
        border-bottom: 1px solid var(--vscode-sideBar-border);
      }

      &.active {
        background-color: rgba(255, 255, 255, 0.1);

        .node-label {
          color: #ffffff !important;
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
              color: #e6e6e6;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .node-date {
              font-size: 12px;
              line-height: 18px;
              color: #999999;
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
              color: #b3b3b3;
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

      .devui-tree__node-content:not(.active):hover {
        background-color: rgba(49, 122, 247, 0);
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

:deep(.devui-select__selection) {
  height: 28px !important;
  border: none;
  background-color: rgba(255, 255, 255, 0.05) !important;

  .devui-select__input {
    height: 28px !important;
    border: none;
    font-size: 13px;
    color: #e6e6e6 !important;
  }
}
</style>
