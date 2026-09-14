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
      <div class="refresh" :class="{ hidden: isExpanded }" @click="handleReload(true)">
        <d-icon name="refresh"></d-icon>
      </div>
      <div :class="{ hidden: isExpanded }" class="flex1"></div>
      <d-popover :content="$t('sideBar.batchDelete')" trigger="hover" :position="['left']" >
        <div class="batch-delete-icon" :class="{ hidden: isExpanded, active: isBatchDelete }" @click="changeBatchDeleteCheck">
          <d-icon name="batch-delete"></d-icon>
        </div>
      </d-popover>
      <SideBarSearch :class="{ hidden: isExpanded }" @search="setKeyword"></SideBarSearch>
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
    <div class="tree-container" :class="{ hidden: isExpanded, addButtom: isBatchDelete }" v-loading="isLoading">
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
          <div
            class="tree-container-content"
            :class="{ 'indentation': nodeData.level !== 1 }"
            @mouseenter="nodeData.showSingleDelete = true"
            @mouseleave="nodeData.showSingleDelete = false"
          >
            <div class="icon">
              <!-- 节点图标（文件夹/文件） -->
              <i v-if="nodeData.type === 'dir' && !nodeData.executeTime" class="icon-folder-new"></i>
              <i v-if="nodeData.fileType === 'computeGraph'" class="icon-json"></i>
              <i v-if="nodeData.fileType === 'opCheck'" class="icon-diagnose"></i>
              <i v-if="nodeData.fileType === 'taskCheck'" class="icon-diagnose"></i>
              <i v-if="nodeData.extname === 'json'" class="icon-file"></i>
            </div>

            <!-- 节点文本区域（两行布局） -->
            <div v-if="nodeData.type === 'dir'" :class="{ 'node-text-folder': nodeData.level === 1 }">
              <div class="node-label" :title="nodeData.label" v-html="textToHighlightHtml(nodeData.label)"></div>
              <div class="node-date" v-if="nodeData.date">{{ nodeData.date }}</div>
            </div>
            <div v-else class="node-text-children">
              <div class="node-label" v-html="textToHighlightHtml(nodeData.label)"></div>
            </div>
            <div v-if="nodeData.level === 1" class="node-left">
              <d-icon v-if="!isBatchDelete && nodeData.showSingleDelete" @click.stop="handleDelete(nodeData)" name="delete" />
              <d-checkbox v-if="isBatchDelete" v-model="nodeData.checked" :showAnimation="false" @click.stop="handleCheck(nodeData)" />
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
      <LoadMoreTrigger v-show="page > 1 || !allLoaded" :all-loaded="allLoaded" @load-more="handleLoadMore" />
    </div>
    <transition>
      <div v-if="isBatchDelete" class="batch-delete-bar">
        <div class="batch-delete-num" :class="{ active: selectedNodes.length }">
          {{ selectedNodes.length }}
        </div>
        {{ t('sideBar.selected') }}
        <div class="empty-rect"></div>
        <button class="batch-delete-button" :class="{ active: selectedNodes.length }" @click="handleBatchDelet">
          <i class="icon-delete"></i>
          {{ t('delete') }}
        </button>
        <div class="empty-rect"></div>
        <i class="icon-close" style="margin-right: 8px;" @click="changeBatchDeleteCheck"></i>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchRunDataDetail, getRunDataList, deleteRunData } from '@/apis/workspace';
import { DevUITreeNode } from '@/components/sideBar/types/sidebarModle';
import { Message } from 'vue-devui/message';
import { openComputeGraph, openControlFlow, openSwimlaneGraph, openOpCheck, openTaskCheck } from '@/apis/opener';

import { useSearchingHighlight } from '../hooks/use-searching-highlight';
import { debounce } from 'lodash-es';
import SideBarSearch from './SideBarSearch.vue';
import LoadMoreTrigger from '../../util/LoadMoreTrigger.vue';
import { openPyPTOWelcome } from '@/apis/opener';
import { getWelcomeState } from '@/apis/welcome';

type OutputRecords = Awaited<ReturnType<typeof getRunDataList>>['data'];

type DirectoryTree = Awaited<ReturnType<typeof fetchRunDataDetail>>['data']['directoryTree'];
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
const nodeChildrenMap = new Map<string, Promise<DevUITreeNode[]>>();
const visibleTreeData = computed(() => [...treeData.value]);

function nodeClick(node: DevUITreeNode): void {
  if (node.fileType === 'controlFlow') {
    openControlFlow({ controlFlowPath: node.absolutePath, outputPath: node.outputPath });
  } else if (node.fileType === 'swimlaneGraph') {
    openSwimlaneGraph({ swimlaneGraphPath: node.absolutePath, outputPath: node.outputPath });
  } else if (node.fileType === 'computeGraph') {
    openComputeGraph({
      computeGraphPath: node.absolutePath,
      outputPath: node.pathName ? node.outputPath : undefined,
      pathName: node.pathName,
      computeGraphDirPath: node.computeGraphDirPath,
      flowVerifyPath: node.flowVerifyPath,
    });
  } else if (node.fileType === 'opCheck') {
    openOpCheck({ outputPath: node.outputPath, opeCheckDirPath: node.opeCheckDirPath, flowVerifyPath: node.flowVerifyPath, computeGraphDirPath: node.computeGraphDirPath });
  } else if (node.fileType === 'taskCheck') {
    openTaskCheck({ outputPath: node.outputPath, taskCheckDirPath: node.taskCheckDirPath, flowVerifyPath: node.flowVerifyPath, computeGraphDirPath: node.computeGraphDirPath });
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

function transformChild(
  subDirOrFile: DirectoryTree['children'],
  prefix: string,
  computeGraphDirPath?: string | null,
  flowVerifyPath?: string | null,
): DevUITreeNode[] {
  const children: DevUITreeNode[] = [];
  for (const dirOrFile of subDirOrFile) {
    const child: DevUITreeNode = {
      id: `${prefix}/${dirOrFile.name}`,
      label: dirOrFile.name,
      type: dirOrFile.type,
      expanded: false,
      isLeaf: !(dirOrFile.type === 'dir' && dirOrFile.children.length),
      ...dirOrFile,
      children: undefined,
      // 如果是计算图节点，添加这两个参数
      computeGraphDirPath: dirOrFile.type === 'file' && dirOrFile.fileType === 'computeGraph' ? computeGraphDirPath : undefined,
      flowVerifyPath: dirOrFile.type === 'file' && dirOrFile.fileType === 'computeGraph' ? flowVerifyPath : undefined,
    };
    children.push(child);
    if (dirOrFile.type === 'dir' && !child.isLeaf) {
      nodeChildrenMap.set(
        child.id,
        Promise.resolve(
          transformChild(
            dirOrFile.children as unknown as DirectoryTree['children'],
            child.id,
            computeGraphDirPath,
            flowVerifyPath,
          ),
        ),
      );
    }
  }
  return children;
}

/**
 * 获取根节点（运行结果记录）的子节点，每次展开重新请求详情，无数据时每次提示
 */
async function fetchRootNodeChildren(rootNode: DevUITreeNode): Promise<DevUITreeNode[]> {
  const detail = await fetchRunDataDetail(rootNode.directoryPath);
  // 无数据（文件可能已删除，扩展侧已提示）：返回空，由调用方收起节点
  if (!detail.data) {
    return [];
  }
  const children = transformChild(
    detail.data?.directoryTree?.children ?? [],
    rootNode.id,
    detail.data?.computeGraphDirPath,
    detail.data?.flowVerifyPath,
  );
  if (rootNode.hasOpeCheck && rootNode.opeCheckDirPath) {
    children.push({
      id: `${rootNode.id}/opCheck`,
      label: 'OP Check',
      type: 'file',
      expanded: false,
      isLeaf: true,
      fileType: 'opCheck',
      outputPath: rootNode.directoryPath,
      opeCheckDirPath: rootNode.opeCheckDirPath,
      flowVerifyPath: detail.data?.flowVerifyPath,
      computeGraphDirPath: detail.data?.computeGraphDirPath,
    });
  }
  if (rootNode.hasTaskCheck && rootNode.taskCheckDirPath) {
    children.push({
      id: `${rootNode.id}/taskCheck`,
      label: 'Task Check',
      type: 'file',
      expanded: false,
      isLeaf: true,
      fileType: 'taskCheck',
      outputPath: rootNode.directoryPath,
      taskCheckDirPath: rootNode.taskCheckDirPath,
      flowVerifyPath: detail.data?.flowVerifyPath,
      computeGraphDirPath: detail.data?.computeGraphDirPath,
    });
  }
  return children;
}

function transformData(outputData: OutputRecords): DevUITreeNode[] {
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
    records.push(rootNode);
  }
  return records;
}

async function lazyLoad(parentNode: DevUITreeNode, callback: (response: { treeItems: DevUITreeNode[]; node: DevUITreeNode }) => void) {
  // 根节点（运行结果记录）：每次展开重新请求详情，无数据时每次提示
  if (parentNode.date) {
    // 折叠触发的加载直接返回空，避免重复请求提示
    if (!parentNode.expanded) {
      callback({ treeItems: [], node: parentNode });
      return;
    }
    let treeItems: DevUITreeNode[] = [];
    try {
      treeItems = await fetchRootNodeChildren(parentNode);
    } catch {
      // 请求失败视为无数据
    }
    callback({ treeItems, node: parentNode });
    // 无数据（扩展侧已提示文件可能已删除）：收起节点，不展开
    if (!treeItems.length) {
      treeRef.value?.treeFactory?.collapseNode(parentNode);
    }
    return;
  }
  const treeItems = await nodeChildrenMap.get(parentNode.id);
  callback({ treeItems, node: parentNode });
}

onMounted(async () => {
  getOutputs(1);
  const isOpenWith = await getWelcomeState({
    key: 'guideSteps-isOpenWithPyPto',
  });
  if (isOpenWith !== false) {
    openPyPTOWelcome();
  }

  // 禁用原生右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 阻止原生菜单弹出
  });
});

// 侧边栏激活时刷新数据
window.addEventListener('message', async event => {
  const message = event.data;
  if (message.type === 'SIDEBAR_VISIBILITY_CHANGED' && message.isVisible) {
    handleReload(true);
  }
});

const isLoading = ref(false);
const page = ref(1);
const pageSize = 50;
const allLoaded = ref(false);
const currentTotal = ref(0)

function clearList() {
  treeData.value = [];
  nodeChildrenMap.clear();
  allLoaded.value = false;
}

/**
 * 刷新、修改筛选条件
 * @param forceReload 强制刷新
 */
function handleReload(forceReload?: boolean) {
  clearList();
  page.value = 1;
  getOutputs(page.value, forceReload);
}

/**
 * 加载更多
 */
function handleLoadMore() {
  if (isLoading.value) {
    return;
  }
  page.value += 1;
  getOutputs(page.value);
}

/**
 * 获取运行记录
 * @param forceReload 强制刷新
 */
async function getOutputs(loadingPage: number, forceReload?: boolean, titleKeyword?: string, isExactMatch?: boolean): Promise<void> {
  isLoading.value = true;
  try {
    const { data, total } = await getRunDataList({
      page: loadingPage,
      pageSize,
      sortOrder: sortOption.value ? 'asc' : 'desc',
      forceReloadFromFiles: forceReload,
      titleKeyword,
      isExactMatch
    });
    currentTotal.value = total
    // 再次清空列表，避免并发请求导致数据异常
    if (page.value === 1) {
      clearList();
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

const isBatchDelete = ref(false) // 是否开启批量删除
const selectedNodes = ref<DevUITreeNode[]>([]) // 已勾选数据

// 单个删除
const handleDelete = async (node: DevUITreeNode) => {
  try {
    await deleteRunData({ directoryPaths: [node.directoryPath] });
    treeRef.value.treeFactory.removeNode(node);
    Message({
      type: 'success',
      message: t('sideBar.deleteSuccess'),
    });
  } catch (e) {
    Message({
      type: 'success',
      message: t('sideBar.deleteFailed'),
    });
  }
}

// 勾选数据
function handleCheck(node: DevUITreeNode) {
  if (selectedNodes.value.includes(node)) {
    node.checked = false
    selectedNodes.value = selectedNodes.value.filter(item => item !== node);
  } else {
    node.checked = true
    selectedNodes.value.push(node)
  }
}

// 开启/关闭批量删除数据勾选
function changeBatchDeleteCheck() {
  if (isBatchDelete.value) {
    if (selectedNodes.value.length > 0) {
      selectedNodes.value.forEach(item => {
        item.checked = false
      });
    }
    selectedNodes.value = []
    isBatchDelete.value = false
  } else {
    isBatchDelete.value = true
  }
}
// 批量删除
async function handleBatchDelet() {
  try {
    const directoryPaths = selectedNodes.value.map(item => item.directoryPath)
    await deleteRunData({ directoryPaths: directoryPaths });
    for (let i = 0; i < selectedNodes.value.length; i++) {
      treeRef.value.treeFactory.removeNode(selectedNodes.value[i]);
    }
    selectedNodes.value = []
    Message({
      type: 'success',
      message: t('sideBar.deleteSuccess'),
    });
  } catch (e) {
    Message({
      type: 'warning',
      message: t('sideBar.deleteFailed'),
    });
  }
}
const keyword = ref('');
function setKeyword(val: string) {
  keyword.value = val;
  searchKeyword();
}
// 根据关键词搜索标题
const searchKeyword = debounce(() => {
  clearList();
  page.value = 1;
  getOutputs(page.value, false, keyword.value, true);
  updateKeyword(keyword.value);
}, 500)
watch(sortOption, () => {
  searchKeyword();
});
</script>

<style scoped lang="less">
@import url('@devui-design/icons/icomoon/devui-icon.css');

/**
 * 基础样式
 */
.sidebar-container {
  color: var(--pto-font-color-title);
  min-height: 100%;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 11px;
  padding-top: 8px;
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
  .expand {
    width: 28px;
    height: 28px;
    padding: 7px;
    font-size: 14px;
    cursor: pointer;
    :deep(*) {
      color: var(--pto-font-color-title);
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
      color: var(--pto-font-color-title);
    }
  }

  .batch-delete-icon {
    width: 28px;
    height: 28px;
    padding: 7px;
    font-size: 14px;
    cursor: pointer;

    &:hover {
      :deep(*) {
        color: var(--pto-font-color-link-hover);
      }
    }

    &.active {
      :deep(*) {
        color: var(--pto-font-color-link-hover);
      }
    }

    :deep(*) {
      color: var(--pto-font-color-title);
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

.batch-delete-bar {
  align-items: center;
  padding: 6px;
  display: flex;
  height: 48px;
  background-color: var(--devui-base-bg);
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  border: 1px solid var(--devui-line);
  border-radius: 12px;
  font-size: 14px;
  flex-wrap: nowrap;
  white-space: nowrap;

  .empty-rect {
    width: 1px;
    height: 16px;
    left: 183px;
    margin: 0 12px;
    background-color: var(--pto-border-default);
  }

  .batch-delete-num {
    height: 28px;
    border-radius: 8px;
    background-color: var(--pto-font-color-disabled);
    margin-right: 8px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 9px;

    &.active {
      background-color: var(--devui-brand);
      color: var(--devui-light-text);
    }
  }

  .batch-delete-button {
    background-color: var(--devui-base-bg);
    border: none;
    color: var(--pto-font-color-disabled);

    &.active {
      color: var(--pto-font-color-title);
    }
     
    &:hover {
      cursor: pointer;
    }
  }
}

.tree-container {
  width: 100%;
  flex: 1;
  min-height: 0;
  margin-top: 4px;
  box-sizing: border-box;
  overflow: auto;

  &.addButtom {
    padding-bottom: 112px;
  }

  :deep(.devui-tree) {
    width: 100%;
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
        border-bottom-color: var(--pto-border-default);
      }

      &.active {
        background-color: var(--devui-input-active-bg);

        .node-label {
          color: var(--control-flow-sidebar-tree-label) !important;
        }
      }

      &:hover {
        background-color: var(--pto-background-hover);
        .node-label {
          color: var(--control-flow-sidebar-tree-label) !important;
        }
      }

      .devui-tree__node-content--value-wrapper {
        height: max-content !important;
        width: 100%;

        .indentation{
          margin-left: 4px;
        }

        .tree-container-content {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 4px;

          .icon {
            font-size: 16px;

            .icon-file {
              color: orange;
            }

            .icon-json {
              color: orange;
            }
          }

          .node-left {
            display: flex;
            align-items: center;
            margin-left: auto;
            gap: 8px;
          }

          .node-text-folder {
            display: flex;
            justify-content: center;
            flex-direction: column;
            height: 48px !important;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;

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

