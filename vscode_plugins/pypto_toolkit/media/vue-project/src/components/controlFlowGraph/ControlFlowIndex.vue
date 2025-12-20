<template>
  <div>
    <!-- 代码预览组件 -->
    <CodeSnippetPreview :config="codePreviewState" :theme="isDarkTheme ? 'vs-dark' : 'vs'" @close="codePreviewState.isVisible = false" />
  </div>
  <div class="g6-flow-chart" ref="graphContainerRef">
    <RightPanel ref="sideBarRef"></RightPanel>
    <div class="tool-navbar">
      <Navbar :control-flow-data="rootData" :current-record-directory-path="outPutPath" />
      <SearchSelect
        ref="searchSelectRef"
        :options="options"
        @matched-results="handleMatchedResults"
        @selected-value="handleSelectedValue"
        @activeEvent="handHoverEvent"
        class="tool-select"
      />
    </div>
    <div
      id="controlGraph"
      ref="chartContainer"
      class="chart-container"
      :class="{ 'init-graph': !isGraphVisible }"
      :style="{
        backgroundImage: 'url(' + svgPath + ')',
        backgroundRepeat: 'repeat',
        height: '100%',
      }"
    ></div>
    <template v-if="dataError">
      <DataError class="error-message" :message="dataErrorMessage" :output-path="outPutPath"></DataError>
    </template>
    <template v-else>
      <MinimapContainer class="minimap-type"></MinimapContainer>
      <div class="tool-bar">
        <button
          class="icon-minus"
          style="width: 16px; height: 16px; left: 32px; color: var(--devui-text)"
          :title="t('zoomOut')"
          @click="graphZoomTo(-10)"
        ></button>
        <input type="text" :value="zoom" class="zoom-value" @blur="inputZoomTo" @keydown.enter="$event.target.blur()" @input="onInput" />
        <span class="text-value">%</span>
        <button
          class="icon-op-add"
          style="width: 16px; height: 16px; color: var(--devui-text); margin-right: 8px"
          :title="t('zoomIn')"
          @click="graphZoomTo(10)"
        ></button>
        <div class="empty-rect"></div>
        <button
          class="icon-location-new location-icon"
          :class="{ active: isActive }"
          style="width: 16px; height: 16px; margin-left: 8px"
          :title="t('resizeWindow')"
          @click="graphFitView"
        ></button>
      </div>
    </template>
  </div>
  <Loading class="loading-index" v-if="isLoading" :loadingText="'loading'" />
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CommonEvent, ExtensionCategory, Graph, GraphEvent, register } from '@antv/g6';
import RightPanel from '@/components/controlFlowGraph/components/RightPanel.vue';
import { transformData } from '@/components/controlFlowGraph/util/parse-data';
import { getQuery } from '@/core/query';
import { getControlFlow } from '@/apis/control-flow';
import Navbar from '@/components/navbar/navbar.vue';
import SearchSelect from '@/components/controlFlowGraph/components/SearchSelect.vue';
import Loading from '@/components/comGraph/loading.vue';
import { usePathCardNodes } from '@/components/controlFlowGraph/hooks/usePathCardNode';
import { useIfCardNodes } from '@/components/controlFlowGraph/hooks/useIfCardNode';
import { useComboCardNodes } from '@/components/controlFlowGraph/hooks/useComboNode';
import { useInitGraph } from '@/components/controlFlowGraph/hooks/useInitGraph';

import DataError from './components/DataError.vue';
import { useMinimap } from './hooks/use-minimap';
import { useLevelOfDetail } from './hooks/useZoomLevel';
import { CombsType, ControlFlowNodesType, EdgesType, PreviewState, SearchSelectItem } from './type/node-detail-types';
import CodeSnippetPreview from './components/CodeSnippetPreview.vue';
import { openComputeGraph, openSwimlaneGraph } from '@/apis/opener';
import { getIsCompleteBoot } from '@/apis/welcome';
import { useViewServer } from '@/core/use-view-server';

const { isDarkTheme } = inject('root');
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
const sideBarRef = ref(null);
const chartContainer = ref<HTMLDivElement | null>(null);
let graph = null;
const { t } = useI18n();
const rootData = ref([]);
const outPutPath = ref();
const programPath = ref();
const isGraphVisible = ref(false);
const searchSelectRef = ref(null);
const isLoading = ref(true);
const zoom = ref(1);
const initZoom = ref();
const isActive = ref(false);
const options = ref([]);
const combosNode = ref(null);
const isBoot = ref(false);
const graphContainerRef = ref(null);
// 有预览相关状态
const codePreviewState = reactive<PreviewState>({
  isVisible: false,
  x: 0,
  y: 0,
  fileDir: '',
  codeStartLine: 0,
  codeEndLine: 0,
  line: 0,
  language: '',
});
const { PathCardNodes } = usePathCardNodes(sideBarRef, outPutPath, isDarkTheme);
const { LevelOfDetail } = useLevelOfDetail();
const { IfCardNode } = useIfCardNodes();
const { LogoWithRectCombo } = useComboCardNodes(isDarkTheme, codePreviewState);
const clearAllNodeState = {};

/**
 * 工具栏输入缩放正则匹配
 * @param e 工具栏输入框事件
 */
function onInput(e: InputEvent) {
  let val = e.target.value.replace(/[^0-9]/g, '');
  zoom.value = val;
}

/**
 * 工具栏点击缩放
 */
async function inputZoomTo() {
  await graph.zoomTo(zoom.value / 100);
  isActive.value = false;
}

/**
 * 工具栏输入缩放
 * @param size 缩放大小
 */
async function graphZoomTo(size: number) {
  if (zoom.value + size > 0) {
    zoom.value += size;
    await graph.zoomTo(zoom.value / 100);
  }
  isActive.value = false;
}

/**
 * 工具栏恢复初始位置
 */
async function graphFitView() {
  await graph.fitCenter(true, {
    duration: 100,
    easing: 'ease',
  });
  await graph.zoomTo(initZoom.value);
  isActive.value = true;
}

// 接收搜索子组件传递的数据
const matchedResults = ref([]); // 匹配结果
const selectedValue = ref(null); // 选中项

/**
 * 将搜索模糊匹配到的数据进行高亮
 * @param results 模糊匹配列表
 */
const handleMatchedResults = (results: SearchSelectItem[]) => {
  matchedResults.value = results;
  if (matchedResults.value.length > 0) {
    graph.setElementState(clearAllNodeState);
    matchedResults.value.forEach((item) => {
      const id = item.value;
      graph.setElementState(id, 'active');
    });
  } else {
    graph.setElementState(clearAllNodeState);
  }
};

/**
 * 鼠标选中以及enter按下类型高亮
 * @param value 搜索下拉面版选中的数据
 */
const handleSelectedValue = (value: SearchSelectItem) => {
  selectedValue.value = value;
  graph.setElementState(clearAllNodeState);

  if (selectedValue.value) {
    graph.setElementState(selectedValue.value.value, 'selected');
    graph.focusElement(selectedValue.value.value);
    graph.draw();
  }
};

/**
 * 鼠标hover以及键盘上下高亮
 * @param id hover节点的id值
 */
const handHoverEvent = (id: string) => {
  handleMatchedResults(matchedResults.value);
  graph.setElementState(id, 'selected');
  if (zoom.value < 50) {
    graph.setElementZIndex(zIndex.value);
    graph.setElementZIndex(id, Infinity);
  }
};

/**
 * 更新画布大小
 */
async function updateGraphSize() {
  await graph.layout();
  await graph.resize();
  await graph.render();
  await graph.draw();
}

const graphRef = ref<Graph>();
const { minimapPluginOptions, MinimapContainer } = useMinimap(graphRef);

/**
 * 初始化 G6 图表
 * @param nodes 传入node节点数据
 * @param edges 传入边导向数据
 * @param combos 传入组合数据
 */
const initG6Graph = async (nodes: ControlFlowNodesType[], edges: EdgesType[], combos: CombsType[]) => {
  register(ExtensionCategory.NODE, 'path-card-node', PathCardNodes);
  register(ExtensionCategory.NODE, 'if-card-node', IfCardNode);
  register(ExtensionCategory.COMBO, 'combo-with-extra-button', LogoWithRectCombo);
  register(ExtensionCategory.BEHAVIOR, 'level-of-detail', LevelOfDetail);
  const container = chartContainer.value as HTMLDivElement;
  const { g6Graph } = useInitGraph(container, minimapPluginOptions, nodes, edges, combos, isDarkTheme, combosNode, codePreviewState);
  graph = g6Graph;
  graphRef.value = g6Graph;
  // 绘制
  await graph.render();
  // 更新小地图缩放值
  graph.on(GraphEvent.AFTER_TRANSFORM, async () => {
    const zoomNow = await graph?.getZoom();
    zoom.value = Math.round(zoomNow * 100);
    if (zoomNow < 0.5) {
      // 保持缩放过程中，已选中的层级处于最高层级
      graph.setElementZIndex(zIndex.value);
      const nodes = await graph.getElementDataByState('combo', 'selected');
      if (nodes.length > 0) await graph.setElementZIndex(nodes[0].id, Infinity);
    }
  });

  /**
   * 当画布缩放或发生平移时，自适应图标置灰
   */
  function fitActive() {
    isActive.value = false;
  }

  // 监听滚轮以及拖拽事件，使得自适应按钮取消高亮
  graph.on(CommonEvent.WHEEL, fitActive);
  graph.on(CommonEvent.DRAG, fitActive);

  /**
   * 点击子combo时，最外层父combo隐藏
   * @param id 初始传入当前点击的节点id
   */
  async function setCombParentHidden(id: string) {
    const elementData = await graph.getElementData(id);
    // 仅当节点类型为 LOOP 时才执行后续逻辑
    if (elementData.data.nodeType === 'LOOP') {
      // 有组合父级：递归处理
      if (elementData.combo) {
        await setCombParentHidden(elementData.combo);
      }
      // 无组合父级：设置隐藏状态
      else {
        await graph.setElementState(id, 'comboHidden');
      }
    }
  }

  /**
   * 监听画布点击事件，
   * 点击任意时，清空所有元素附加状态，
   * 点击画布时，重置搜索框初始状态，
   * 点击节点时，节点附加选中状态，
   * 点击combo时，给当前combo层级置顶，恢复其他节点初始层级
   * @param event 点击事件CommonEvent.CLICK默认事件参数由graph.on自动传入。
   */
  async function clickFun(event: PointerEvent) {
    await graph.setElementZIndex(zIndex.value);
    graph.setElementState(clearAllNodeState);

    if (matchedResults.value.length > 0) {
      searchSelectRef.value.clear();
    }
    if (event.target.id) {
      await graph.setElementState(event.target.id, 'selected');
      const targetData = await graph.getElementData(event.target.id);
      if (targetData.data.nodeType === 'LOOP' && targetData.combo) {
        await setCombParentHidden(event.target.id);
      }
      await graph.setElementZIndex(zIndex.value);
      // 已选中的层级处于最高层级
      await graph.setElementZIndex(event.target.id, Infinity);
    }
  }

  // 监听点击事件
  graph.on(CommonEvent.CLICK, clickFun);

  // 初始化时视角自适应
  await graph.fitView();
  const initSize = await graph.getZoom();
  // 调整节点过多或过少时的缩放比例
  if (initSize > 0.7) {
    // 确保当节点较少时，节点不会太小
    zoom.value = 70;
    await graph.zoomTo(0.7);
  } else if (initSize < 0.7 && initSize > 0.05) {
    // 确保当大量节点时，有loop虚线初始化不会溢出屏幕
    zoom.value = Math.round(initSize * 100) - 5;
    await graph.zoomTo(initSize - 0.05);
  }

  initZoom.value = zoom.value / 100;
  isGraphVisible.value = true;
  isLoading.value = false;
};
const stepOpenSidebaNode = ref();

// 由引导弹窗控制打开侧边栏
function bootStepOpenSideBar() {
  sideBarRef.value.transFormPanelData(stepOpenSidebaNode.value, outPutPath.value, 0);
}
function closeSidebar() {
  sideBarRef.value.drawerVisible = false;
}

// 监听引导模式的消息
const listenExtensionMessage = () => {
  // 封装动态创建DOM的函数（核心逻辑）
  const createControlFlowDiv = () => {
    // 防重复创建：先检查是否已存在该ID的元素
    const existingElement = document.getElementById('boot-steps-controlFlow');
    if (existingElement) {
      return;
    }

    const controlFlowDiv = document.createElement('div');
    controlFlowDiv.id = 'boot-steps-controlFlow';
    controlFlowDiv.style = 'position: absolute;top: 58%;  left: 30%;';
    const controlFlowStartElement = document.querySelector('#boot-controlFlow-index');
    const mountTarget = controlFlowStartElement;
    mountTarget.appendChild(controlFlowDiv);
  };
  const { server } = useViewServer();
  watch(
    () => isLoading.value,
    (value) => {
      if (!value) {
        graph.zoomTo(50 / 100);
        createControlFlowDiv();
      }
    },
  );

  (window as any).ascEventBus.on('boot-step-tips', (event) => {
    const message = event.data;
    if (event.type === 'welcomeSkipAll') {
      server.close();
    }
    if (event.type === 'callWebviewMethod') {
      switch (message.methodName) {
        case 'checkControlFlow':
          closeSidebar();
          graph.zoomTo(50 / 100);
          break;
        case 'bootStepOpenSideBar':
          bootStepOpenSideBar();
          break;
        case 'bootStepSearch':
          closeSidebar();
          break;
        case 'viewNavigationHistory':
          closeSidebar();
          break;
        default:
          break;
      }
    }
    if (event.type === 'openWebviewWithGuide') {
      switch (message.openWebviewFn) {
        case 'openComputeGraph':
          const length = stepOpenSidebaNode.value.data.source.meta?.passes.length;
          openComputeGraph({
            outputPath: outPutPath.value as string,
            computeGraphPath: stepOpenSidebaNode.value.data.source.meta?.passes[length - 1].graphFilePath,
            pathName: stepOpenSidebaNode.value.data.source.meta?.passes[length - 1].pathName,
          });

          server.close();
          break;
        default:
          break;
      }
    }
  });
};

const dataError = ref(false);
const dataErrorMessage = ref('');
const zIndex = ref({}); //保存所有节点的初始层级
onMounted(async () => {
  if (await getIsCompleteBoot()) {
    listenExtensionMessage();
  }
  const res = await getQuery();
  outPutPath.value = res.url;
  programPath.value = res._path;
  try {
    const data = await getControlFlow(
      { outputDirPath: outPutPath.value, controlFlowFilePath: programPath.value },
      { useCustomErrorHandler: true },
    );
    rootData.value = data.data;
  } catch (e: any) {
    rootData.value = [];
    dataError.value = true;
    dataErrorMessage.value = e.name.includes('EntryNotFound') ? t('controlFlows.fileNotFoundError') : t('controlFlows.dataParseError');
  }

  const { nodes, edges, combos } = transformData(rootData.value);
  combosNode.value = [...combos, ...nodes];
  stepOpenSidebaNode.value = nodes[0];
  await initG6Graph(nodes, edges, combos);
  combosNode.value.forEach((item) => (clearAllNodeState[item.id] = []));
  // 初始化搜索组件数据源
  combos.forEach((item, index) => {
    options.value.push({
      label: item.id,
      value: item.id,
      data: item,
    });
    if (item.combo) {
      zIndex.value[item.id] = index;
    } else {
      zIndex.value[item.id] = Number.MAX_VALUE; //最外层loop层级，仅次于选中层级Infinity的值
    }
  });
  nodes.forEach(async (item) => {
    if (item.type !== 'if-card-node') {
      options.value.push({
        label: item.data.source.magicName,
        value: item.id,
        data: item,
      });
    }
    zIndex.value[item.id] = -1; //path节点处于最低层级
  });
  await graph.setElementZIndex(zIndex.value);
  updateGraphSize();
  window.addEventListener('resize', updateGraphSize);
  // 禁用原生右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // 阻止原生菜单弹出
  });
});

onUnmounted(() => {
  window.removeEventListener('resize', updateGraphSize);
});
</script>

<style lang="less" scoped>
.g6-flow-chart {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background-color: var(--control-flow-bg);
}
.loading-index {
  z-index: 99999999;
}
.tool-navbar {
  position: absolute !important;
  z-index: 10;
  width: 100%;
  height: 140px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 12px;
  gap: 8px;
  background: var(--devui-header-gradient-bg);
  pointer-events: none;
  .tool-select {
    pointer-events: all;
    position: relative;
    top: 16px;
  }
}

.chart-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.error-message {
  position: absolute;
  align-self: center;
  width: 100%;
}

.init-graph {
  visibility: hidden;
}

.minimap-type {
  position: absolute !important;
  background-color: var(--control-flow-table-minimap-bg) !important; // 设
  box-shadow: 0px -1px 6px 0px rgba(0, 0, 0, 0.08);
  border-radius: 20px 20px 0 0 !important;
  right: 16px;
  bottom: 48px;
}

.tool-select-focus {
  :deep(.devui-editable-select__clear-icon) {
    display: none !important;
  }
}

.tool-select-search {
  position: fixed;
  right: 24px;
  top: 40px;
  color: var(--devui-primary-text);
  z-index: 99;
}

.tool-select-search-icon {
  display: none;
}

.tool-bar {
  background-color: var(--control-flow-table-minimap-bg);
}

:deep(.tooltip) {
  border-radius: 8px !important;
  transition-duration: 0s !important;
}
</style>
<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.tool-bar {
  position: absolute;
  right: 16px;
  bottom: 15px;
  display: flex;
  align-items: center;
  width: 260px;
  height: 32px;
  box-shadow: 0px -1px 6px 0px rgba(0, 0, 0, 0.08);
  flex-direction: row;
  justify-content: center;
  padding: 4px 12px;
  gap: 32;
  border-radius: 0 0 12px 12px;
  transition: right $devui-animation-duration-slow $devui-animation-ease-in-out-smooth;

  button {
    font-size: 12px;
    border: none;
    background-color: unset;
    cursor: pointer;

    &.location-icon {
      font-size: 14px;
      color: $devui-text;
    }

    &.location-icon.active {
      color: rgba(49, 122, 247, 1);
    }
  }

  .zoom-value {
    width: 42px;
    border: none;
    background: transparent;
    color: $devui-text;
    font-size: 12px;
    text-align: right;
    padding: 0;
    outline: 0 !important;
    box-shadow: none !important;
  }

  .text-value {
    color: $devui-text;
    font-size: 12px;
    margin-right: 26px;
  }

  .empty-rect {
    width: 1px;
    height: 16px;
    left: 183px;
    margin-left: 8px;
    margin-right: 32px;
    background-color: rgba(255, 255, 255, 0.05);
  }

  .tool-zoom {
    font-size: 12px;
    line-height: 18px;
  }

  .icon-minus:before {
    content: '\E0DB';
  }
}
</style>
