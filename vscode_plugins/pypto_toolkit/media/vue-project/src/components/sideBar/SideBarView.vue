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

      <d-select v-model="contentOption" class="filter-select" :options="contentOptions" placeholder="选择显示内容">
        <template #default>
        </template>
      </d-select>
    </div>
    <!-- 树组件：双插槽用法 -->
    <div class="tree-container">
      <d-tree ref="treeRef" :data="visibleItems" show-line="false" :expanded-keys="expandedKeys"
              @expand="handleNodeExpand"
              @collapse="handleNodeCollapse"  :height="1150" @node-click="nodeClick" :node-class="() => 'custom-tree-node'">

        <!-- 1. content插槽：自定义节点主内容（图标+文本） -->
        <template #content="{ nodeData }">
          <div class="tree-container-content">
            <div class="icon">
              <!-- 节点图标（文件夹/文件） -->
              <i v-if="nodeData.type === 'dir'&&!nodeData.executeTime" class=" icon-folder-new"></i>
              <i v-if="nodeData.fileType==='computeGraph'" class="icon-json"></i>
              <i v-if="nodeData.extname==='json'" class="icon-file "></i>
            </div>

            <!-- 节点文本区域（两行布局） -->
            <div v-if="nodeData.type === 'dir'" :class="{
              'node-text-folder':nodeData.level===1,
            }" @dblclick="nodeClick(nodeData)">
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
              <div v-if="nodeData.date" @click="(event) => {
                            event.stopPropagation();
                            toggleNode(nodeData);
                        }" class="devui-tree-node-icon">

                <i class="icon icon-chevron-right" :style="{
                                transform: nodeData.expanded ? 'rotate(90deg)' : '',
                                cursor: 'pointer'
                            }"></i>
              </div>

              <div v-else @click="(event) => {
                            event.stopPropagation();
                            toggleNode(nodeData);
                        }" class="devui-tree-children-node-icon">

                <i class="devui-tree-children-node-icon icon icon-chevron-right " :style="{
                                transform: nodeData.expanded ? 'rotate(90deg)' : '',
                                cursor: 'pointer'
                            }"></i>
              </div>
            </div>
          </div>
        </template>
      </d-tree>


    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, watch, onMounted} from 'vue';
import {useI18n} from 'vue-i18n';
import {getOutputDetail, getOutputRecords} from "@/apis/workspace";
import {GetOutputRecordsRes} from "../../../../../src/services/workspace";
import {DevUITreeChildrenNode, DevUITreeNode} from "@/components/sideBar/types/sidebarModle";
import {openComputeGraph, openControlFlow, openSwimlaneGraph} from "@/apis/opener";

const {t} = useI18n();
const treeRef = ref(null);

/**
 * 下拉选择器数据源
 */
const contentOptions = [
  {value: 'all', name: 'mla_prolog.cpp'},
  {value: 'folders', name: '仅文件夹'},
  {value: 'files', name: '仅文件'}
];

/**
 * 树节点数据
 * - 文件夹节点：type='dir', isLeaf=false, 可包含children
 * - 文件节点：type='file', isLeaf=true, 无children
 */
const treeData = ref<DevUITreeNode[]>([])
/**
 * 状态管理
 */
const sortOption = ref(false);
const contentOption = ref('all');
const allItems = ref<DevUITreeNode[]>(treeData.value);
const expandedKeys = ref<string[]>([]);

/**
 * 计算属性：节点筛选与排序
 */

const sortedLoadedItems = computed(() => {

  return [...treeData.value].sort((a, b) => {
    if (sortOption.value) {
      new Date(a.date).getTime()
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }else {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }

  });
});

const visibleItems = computed(() => sortedLoadedItems.value);


/**
 * 事件处理
 */
const handleNodeExpand = (node: DevUITreeNode) => {
  if (!expandedKeys.value.includes(node.id)) {
    expandedKeys.value = [...expandedKeys.value, node.id];
  }
  node.expanded = true;
};

const handleNodeCollapse = (node: DevUITreeNode) => {
  expandedKeys.value = expandedKeys.value.filter(key => key !== node.id);
  node.expanded = false;
};

async function nodeClick(node: DevUITreeNode) {
  if (node.label === '结果总览') {
    openControlFlow({
      controlFlowPath: node.absolutePath,
      outputPath: node.outputPath
    })
  }
  if (node.label === '泳道图') {
    openSwimlaneGraph({swimlaneGraphPath:node.absolutePath})
  }
  if (node.extname === '.json') {
    openComputeGraph({
      outputPath:node.outputPath,
      computeGraphPath:node.absolutePath,
      passName:node.name
    })

  }

}

/**
 * 工具函数
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

/**
 * 监听筛选条件变化
 */
watch([sortOption, contentOption], ([newSort, newFilter], [oldSort, oldFilter]) => {
  if (newFilter !== oldFilter) {
    expandedKeys.value = [];
  }
});

async function transformData(outputData: GetOutputRecordsRes) {
  try {
    for (let i = 0; i < outputData.data.length; i++) {
      const detail = await getOutputDetail(outputData.data[i].directoryPath)
      const child: DevUITreeChildrenNode[] = detail.data.directoryTree.children

      function transformChild(child: DevUITreeChildrenNode[]) {
        for (let j = 0; j < child.length; j++) {
          child[j].id = child[j].absolutePath;
          child[j].label = child[j].name;
          child[j].type = child[j].type === 'dir' ? 'dir' : 'file';
          child[j].isLeaf = !(child[j].type === 'dir'&&child[j].children.length);
          if (child[j].type === 'dir'&&!child[j].isLeaf) {
            transformChild(child[j].children)
          }
        }

      }
      transformChild(child);

      treeData.value.push({
        id: outputData.data[i].title,
        type: 'dir',
        isLeaf: false, ...outputData.data[i],
        children: child,
        date: outputData.data[i].executeTime,
        label: outputData.data[i].title,
      });
    }
  } catch (e) {
    console.log(e)
  }


}

onMounted(async () => {
  try {
    const outputData: GetOutputRecordsRes = await getOutputRecords({})
    await transformData(outputData);

  } catch (error) {
    console.log(error)

  }

})
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
  font-family: 'HarmonyOS Sans SC 2025';
  height: 28px;
  padding: 0 16px;
  gap: 200px;
  .title {
    display: flex;
    align-items: center;
    gap: 2px;

    .name {
      color: #FFFFFF;
      margin: 0;
      font-size: 14px;
      line-height: 22px;
    }

    .icon {
      font-size: 20px;
      opacity: 0.8;
    }
  }
.tree-search{
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

:deep(#app ) {
  :deep(header) {
    min-width: 300px !important;
  }
}

:deep(.tree-container) {
  flex: 1;
  justify-content: space-between;
  min-height: 0;
  padding: 0px 16px;
  margin-top: 4px;
  box-sizing: border-box;

  /* 节点文本样式 */

  .devui-tree__node {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    height: fit-content;
    padding: 0px 12px;

    .devui-tree__node-content {
      padding: 0;


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

            .icon-folder-new {
            }

            .icon-file {
              color: orange
            }

            .icon-json {
              color: orange
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
              color: #E6E6E6;
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
              color: #B3B3B3;

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

    }

    .devui-tree__node-content.active {
      background-color: rgba(255, 255, 255, 0.1);

      .node-label {
        color: #FFFFFF !important;

      }
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


  .devui-tree-node__indent {
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
    color: #E6E6E6 !important;
  }
}
</style>