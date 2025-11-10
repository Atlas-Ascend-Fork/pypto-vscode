<template>
  <ErrorView v-if="dataParseError" :jsonContent="t('controlFlows.dataParseError')" />
  <div v-else class="g6-flow-chart">
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
  </div>
  <Loading v-if="isLoading" :loadingText="'loading'" />
</template>

<script lang="ts" setup>
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CommonEvent, ExtensionCategory, Graph, GraphEvent, register } from '@antv/g6';
import RightPanel from '@/components/controlFlowGraph/components/RightPanel.vue';
import { transformData } from '@/components/controlFlowGraph/util/parse-data';
import { getQuery } from '@/core/query';
import { getControlFlow } from '@/apis/control-flow';
import Navbar from '@/components/navbar/navbar.vue';
import ErrorView from '@/components/comGraph/error.vue';
import SearchSelect from '@/components/controlFlowGraph/components/SearchSelect.vue';
import Loading from '@/components/comGraph/loading.vue';
import { usePathCardNodes } from '@/components/controlFlowGraph/hooks/usePathCardNode';
import { useIfCardNodes } from '@/components/controlFlowGraph/hooks/useIfCardNode';
import { useComboCardNodes } from '@/components/controlFlowGraph/hooks/useComboNode';
import { useInitGraph } from '@/components/controlFlowGraph/hooks/useInitGraph';
import { useMinimap } from './hooks/use-minimap';
import { useLevelOfDetail } from './hook/useLevelOfetail';

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
const { PathCardNodes } = usePathCardNodes(sideBarRef, outPutPath, isDarkTheme);
const { LevelOfDetail } = useLevelOfDetail();
const { IfCardNode } = useIfCardNodes();
const { LogoWithRectCombo } = useComboCardNodes(isDarkTheme);
const clearAllNodeState = {};

// 工具栏缩放
function onInput(e) {
  let val = e.target.value.replace(/[^0-9]/g, '');
  zoom.value = val;
}

async function inputZoomTo() {
  await graph.zoomTo(zoom.value / 100);
  isActive.value = false;
}

async function graphZoomTo(size: number) {
  if (zoom.value + size > 0) {
    zoom.value += size;
    await graph.zoomTo(zoom.value / 100);
  }
  isActive.value = false;
}

//工具栏恢复初始位置
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

// 处理子组件事件
// 过滤类型高亮
const handleMatchedResults = async (results) => {
  matchedResults.value = results;
  if (matchedResults.value.length > 0) {
    graph.setElementState(clearAllNodeState);
    matchedResults.value.forEach((item) => {
      const id = item.value;
      graph.setElementState(id, 'active');
      graph.setElementZIndex(zIndex.value);
      graph.setElementZIndex(id, 101);
    });
  } else {
    graph.setElementState(clearAllNodeState);
  }
};

//鼠标选中以及enter按下类型高亮
const handleSelectedValue = (value) => {
  selectedValue.value = value;
  graph.setElementState(clearAllNodeState);

  if (selectedValue.value) {
    graph.setElementState(selectedValue.value.value, 'selected');
    graph.focusElement(selectedValue.value.value);
    graph.draw();
  }
};

// 鼠标hover以及键盘上下高亮
const handHoverEvent = (value) => {
  handleMatchedResults(matchedResults.value);
  graph.setElementState(value, 'selected');
};

// 更新画布大小
async function updateGraphSize() {
  await graph.layout();
  await graph.resize();
  await graph.render();
  await graph.draw();
}

//  初始化 G6 图表（
const graphRef = ref<Graph>();
const { minimapPluginOptions, MinimapContainer } = useMinimap(graphRef);
const initG6Graph = async (nodes, edges, combos) => {
  register(ExtensionCategory.NODE, 'path-card-node', PathCardNodes);
  register(ExtensionCategory.NODE, 'if-card-node', IfCardNode);
  register(ExtensionCategory.COMBO, 'combo-with-extra-button', LogoWithRectCombo);
  register(ExtensionCategory.BEHAVIOR, 'level-of-detail', LevelOfDetail);
  const container = chartContainer.value as HTMLDivElement;
  const { g6Graph } = useInitGraph(container, minimapPluginOptions, nodes, edges, combos, isDarkTheme, combosNode);
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
      if (nodes.length > 0) await graph.setElementZIndex(nodes[0].id, 101);
    }
  });

  function fitActive() {
    isActive.value = false;
  }

  // 监听滚轮以及拖拽事件，使得自适应按钮取消高亮
  graph.on(CommonEvent.WHEEL, fitActive);
  graph.on(CommonEvent.DRAG, fitActive);

  // 点击子combo时，最外层父combo需要隐藏
  async function setCombParentHidden(id) {
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

  async function clickFun(event) {
    await graph.setElementZIndex(zIndex.value);
    graph.setElementState(clearAllNodeState);

    if (matchedResults.value.length > 0) {
      searchSelectRef.value.clear();
    }
    if (event.target.id) {
      await graph.setElementState(event.target.id, 'selected');
      const targetData = await graph.getElementData(event.target.id);
      if (targetData.data.nodeType === 'LOOP' && targetData.combo) setCombParentHidden(event.target.id);
      await graph.setElementZIndex(zIndex.value);
      // 已选中的层级处于最高层级
      await graph.setElementZIndex(event.target.id, 101);
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

const dataParseError = ref(false);
const zIndex = ref({});//保存所有节点的初始层级
onMounted(async () => {
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
    dataParseError.value = true;
    isLoading.value = false;
    return;
  }

  const { nodes, edges, combos } = transformData(rootData.value);
  combosNode.value = [...combos, ...nodes];

  await initG6Graph(nodes, edges, combos);
  combosNode.value.forEach((item) => (clearAllNodeState[item.id] = []));
  // 初始化搜索组件数据源
  combos.forEach((item) => {
    options.value.push({
      label: item.id,
      value: item.id,
      data: item,
    });
    if (item.combo) {
      zIndex.value[item.id] = graph.getElementZIndex(item.id);
    } else {
      zIndex.value[item.id] = 99;//最外层loop层级，仅次于选中层级
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
    zIndex.value[item.id] = -1;//path节点处于最低层级
  });
  await graph.setElementZIndex(zIndex.value);
  updateGraphSize();
  window.addEventListener('resize', updateGraphSize);
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
