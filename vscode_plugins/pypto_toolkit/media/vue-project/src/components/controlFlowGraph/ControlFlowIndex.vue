<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 -->
<template>
  <div>
    <!-- 代码预览组件 -->
    <CodeSnippetPreview :config="codePreviewState" :theme="isDarkTheme ? 'vs-dark' : 'vs'" @close="codePreviewState.isVisible = false" />
  </div>
  <div class="g6-flow-chart" ref="graphContainerRef">
    <RightPanel ref="sideBarRef" :is-have-csv="isHaveCSV"></RightPanel>
    <div class="tool-navbar">
      <Navbar :control-flow-data="rootData" :current-record-directory-path="outPutPath" />
      <div class="navbar-right">
        <SearchSelect
          ref="searchSelectRef"
          :options="options"
          @matched-results="handleMatchedResults"
          @selected-value="handleSelectedValue"
          @activeEvent="handHoverEvent"
          class="tool-select"
        />
        <d-tooltip v-if="isHaveCSV" :content="t('controlFlows.openAccuracyReport')" :mouse-enter-delay="100" position="left">
          <div class="accuracy-report-btn" @click="openAccuracyReport">
            <d-icon name="icon-diagnose" size="16px"></d-icon>
          </div>
        </d-tooltip>
      </div>
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
      <div class="tool-bar" :style="{ right: `${minimapOffsetRight + 16}px` }">
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
  <Loading class="loading-index" v-if="isLoading" :loadingText="t('public.loading')" />
  <AccuracyReport v-model="showAccuracyReport" :data="accuracyReportData" @block-click="handleBlockClick"> </AccuracyReport>
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
import { openComputeGraph } from '@/apis/opener';
import { getIsCompleteBoot } from '@/apis/welcome';
import { useViewServer } from '@/core/use-view-server';
import { ControlFlowViewServer } from 'ext:/view/servers/controlFlow-server';
import { JsxEmit } from 'typescript';
import AccuracyReport from './components/AccuracyReport.vue';

const { isDarkTheme } = inject('root');
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
const sideBarRef = ref(null);
const chartContainer = ref<HTMLDivElement | null>(null);
let graph = null;
const { t } = useI18n();
const rootData = ref([]);
const outPutPath = ref();
const computeGraphDirPath = ref();
const flowVerifyPath = ref();
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
const showAccuracyReport = ref(false); // 显示精度执行报告
const isHaveCSV = ref(false); // 是否有CSV文件
const allNodes = ref<ControlFlowNodesType[]>([]); // 已渲染的所有节点
const currentHighlightNodeIds = ref<string[]>([]); // 当前边框高亮的节点
const currentHightLightState = ref(''); // 高亮状态-pass/fail/exception
const tagNodeId = ref(''); // 标签显示节点
const hasBothTags = ref(false); // 是否同时有first-fail和first-exception标签
const accuracyReportData = ref(); // 精度执行报告数据
const tagPass = ref(); // tag标签跳转的对应pass
const firstFailNodeId = ref(''); // 第一个FAIL节点的ID
const firstExcNodeId = ref(''); // 第一个EXCEPTION节点的ID
// 保存每个节点的高亮状态映射
const nodeHighlightStates = ref<Record<string, string[]>>({});
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
const { PathCardNodes } = usePathCardNodes(sideBarRef, outPutPath, isDarkTheme, tagPass, computeGraphDirPath, flowVerifyPath);
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
  setHighLight();
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
    setHighLight();
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
// 打开精度执行报告时小地图左移
const minimapOffsetRight = computed(() => {
  return showAccuracyReport.value ? 480 : 0;
});
const { minimapPluginOptions, MinimapContainer } = useMinimap(graphRef, minimapOffsetRight);

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
      // 有tag的PATH处于最高级，避免tag被遮挡
      if (tagNodeId.value) {
        await graph.setElementZIndex(tagNodeId.value, Infinity);
      }
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
    setHighLight();
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
  sideBarRef.value.transFormPanelData(
    stepOpenSidebaNode.value,
    outPutPath.value,
    0,
    computeGraphDirPath.value,
    flowVerifyPath.value,
  );
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
    controlFlowDiv.style = 'position: absolute;top: 40%;  left: 40%;';
    const controlFlowStartElement = document.querySelector('#boot-controlFlow-index');
    const mountTarget = controlFlowStartElement;
    mountTarget.appendChild(controlFlowDiv);
  };
  const { server } = useViewServer();

  watch(
    () => isLoading.value,
    async (value) => {
      if (!value) {
        createControlFlowDiv();
      }
    },
  );

  (window as any).ascEventBus.on('boot-step-tips', (event) => {
    const message = event.data;
    if (event.type === 'welcomeSkipAll') {
      server.closeWebview();
    }
    if (event.type === 'callWebviewMethod') {
      switch (message.methodName) {
        case 'checkControlFlow':
          closeSidebar();
          break;
        case 'bootStepOpenSideBar':
          bootStepOpenSideBar();
          searchSelectRef.value.clear();
          break;
        case 'bootStepSearch':
          closeSidebar();
          break;
        case 'viewNavigationHistory':
          closeSidebar();
          searchSelectRef.value.clear();
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
            isBootStep: true,
            computeGraphDirPath: computeGraphDirPath.value,
            flowVerifyPath: flowVerifyPath.value,
          });

          server.closeWebview();
          break;
        default:
          break;
      }
    }
  });
};

// 打开精度执行报告
const openAccuracyReport = () => {
  showAccuracyReport.value = true;
};

// 点击精度执行报告中的pass block，高亮对应PATH节点
const handleBlockClick = (item, activeType) => {
  if (!graph) return;

  // 清除之前的高亮状态
  currentHighlightNodeIds.value.forEach((id) => {
    graph.setElementState(id, []);
    if (id === tagNodeId.value) {
      graph.setElementZIndex(id, zIndex.value[id] ?? -1);
    }
  });

  // 目前点击高亮node节点只支持fail和exception状态
  if (!item || (!item.status.includes('FAIL') && !item.status.includes('EXCEPTION'))) {
    currentHighlightNodeIds.value = [];
    graph.draw();
    currentHightLightState.value = '';
    tagNodeId.value = '';
    hasBothTags.value = false;
    firstFailNodeId.value = '';
    firstExcNodeId.value = '';
    nodeHighlightStates.value = {};
    return;
  }

  const hasFail = item.status.includes('FAIL');
  const hasException = item.status.includes('EXCEPTION');

  // 获取需要高亮的节点列表
  const failMagicNames =
    hasFail && item.failFuncMagicName ? item.failFuncMagicName.map((name) => name.replace(/_hiddenfunc0(_\d+)?$/, '')) : [];
  const excMagicNames =
    hasException && item.excFuncMagicName ? item.excFuncMagicName.map((name) => name.replace(/_hiddenfunc0(_\d+)?$/, '')) : [];

  // 找出重复的节点（同时出现在两个列表中）
  const duplicateMagicNames = failMagicNames.filter((name) => excMagicNames.includes(name));

  // 找出所有目标节点
  const allMagicNames = [...new Set([...failMagicNames, ...excMagicNames])];
  const targetNodes = allNodes.value.filter((node) => allMagicNames.includes(node.data.source?.magicName));

  if (targetNodes.length === 0) {
    currentHighlightNodeIds.value = [];
    graph.draw();
    currentHightLightState.value = '';
    tagNodeId.value = '';
    firstFailNodeId.value = '';
    firstExcNodeId.value = '';
    nodeHighlightStates.value = {};
    return;
  }

  // 记录第一个FAIL节点和第一个EXCEPTION节点
  let tempFirstFailNodeId = '';
  let tempFirstExcNodeId = '';

  // 找出第一个FAIL节点
  if (hasFail && failMagicNames.length > 0) {
    const firstFailNode = targetNodes.find((node) => node.data.source?.magicName === failMagicNames[0]);
    if (firstFailNode) {
      tempFirstFailNodeId = firstFailNode.id;
    }
  }
  // 找出第一个EXCEPTION节点
  if (hasException && excMagicNames.length > 0) {
    const firstExcNode = targetNodes.find((node) => node.data.source?.magicName === excMagicNames[0]);
    if (firstExcNode) {
      tempFirstExcNodeId = firstExcNode.id;
    }
  }

  // 保存到ref
  firstFailNodeId.value = tempFirstFailNodeId;
  firstExcNodeId.value = tempFirstExcNodeId;

  // 根据 activeType 决定重合节点的边框颜色
  // activeType === 'FAIL' 时，重合节点使用 FAIL 高亮（橙色）
  // activeType === 'EXCEPTION' 或 null 时，重合节点使用 EXCEPTION 高亮（红色）
  const failPriority = activeType === 'FAIL';

  // 清空之前的状态映射
  nodeHighlightStates.value = {};

  // 为每个节点设置高亮状态
  targetNodes.forEach((node) => {
    const nodeMagicName = node.data.source?.magicName;
    const isFailNode = failMagicNames.includes(nodeMagicName);
    const isExcNode = excMagicNames.includes(nodeMagicName);
    const isDuplicate = duplicateMagicNames.includes(nodeMagicName);

    let states: string[] = [];

    if (isDuplicate) {
      // 重合节点：根据activeType决定边框颜色
      if (failPriority) {
        states.push('highlight-FAIL');
      } else {
        states.push('highlight-EXCEPTION');
      }
    } else if (isFailNode) {
      // 只属于FAIL的节点：橙色边框
      states.push('highlight-FAIL');
    } else if (isExcNode) {
      // 只属于EXCEPTION的节点：红色边框
      states.push('highlight-EXCEPTION');
    }

    // 添加tag状态（不受activeType影响）
    if (node.id === tempFirstFailNodeId) {
      states.push('first-fail');
      graph.setElementZIndex(node.id, Infinity);
    }
    if (node.id === tempFirstExcNodeId) {
      states.push('first-exception');
      graph.setElementZIndex(node.id, Infinity);
    }

    // 保存状态映射
    nodeHighlightStates.value[node.id] = states;
    graph.setElementState(node.id, states);
  });

  // 判断是否同时有两个标签
  if (tempFirstFailNodeId && tempFirstExcNodeId && tempFirstFailNodeId === tempFirstExcNodeId) {
    hasBothTags.value = true;
    tagNodeId.value = tempFirstFailNodeId;
  } else {
    hasBothTags.value = false;
    tagNodeId.value = tempFirstExcNodeId || tempFirstFailNodeId;
  }

  // 保存当前高亮的节点ID列表
  currentHighlightNodeIds.value = targetNodes.map((node) => node.id);

  // 根据activeType设置currentHightLightState（用于setHighLight恢复状态）
  if (activeType === 'FAIL') {
    currentHightLightState.value = 'highlight-FAIL';
  } else {
    currentHightLightState.value = 'highlight-EXCEPTION';
  }

  // 设置tagPass
  if (tagNodeId.value) {
    tagPass.value = targetNodes[0]?.data.source?.meta?.passes?.findIndex(val => val.passName.includes(item.pass_name));
  }

  // 聚焦到第一个有tag的节点或第一个目标节点
  let focusNodeId = '';
  if (tempFirstFailNodeId && tempFirstExcNodeId && tempFirstFailNodeId === tempFirstExcNodeId) {
    focusNodeId = tempFirstFailNodeId;
  } else if (tempFirstExcNodeId) {
    focusNodeId = tempFirstExcNodeId;
  } else if (tempFirstFailNodeId) {
    focusNodeId = tempFirstFailNodeId;
  } else {
    focusNodeId = targetNodes[0].id;
  }

  graph.focusElement(focusNodeId);
  graph.draw();
};

// 根据handleBlockClick的数据高亮对应PATH节点的边框
const setHighLight = () => {
  if (currentHighlightNodeIds.value.length > 0 && Object.keys(nodeHighlightStates.value).length > 0) {
    currentHighlightNodeIds.value.forEach((id) => {
      const states = nodeHighlightStates.value[id];
      if (states && states.length > 0) {
        graph.setElementState(id, states);
        // 如果节点有tag，设置最高层级
        if (states.includes('first-fail') || states.includes('first-exception')) {
          graph.setElementZIndex(id, Infinity);
        }
      }
    });
  }
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
  computeGraphDirPath.value = res.computeGraphDirPath;
  flowVerifyPath.value = res.flowVerifyPath;
  const { server } = useViewServer<ControlFlowViewServer>();
  // 通知后端，查询是否有csv，获取精度执行报告数据
  server.getAccurancyResult({ controwFlowFilePath: res._path, flowVerifyPath: flowVerifyPath.value, computeGraphDirPath: computeGraphDirPath.value });
  watch(server.accurancyResult, (newValue) => {
    isHaveCSV.value = newValue.parseResult === 'Success' ? true : false;
    if (newValue.parseResult) {
      console.log('newValue.allResultSum', newValue.allResultSum);
      accuracyReportData.value = newValue.allResultSum;
    }
  });
  try {
    const data = await getControlFlow(
      { outputDirPath: outPutPath.value, controlFlowFilePath: res._uri.path },
      { useCustomErrorHandler: true },
    );
    rootData.value = data.data;
  } catch (e: any) {
    rootData.value = [];
    dataError.value = true;
    dataErrorMessage.value = e.name.includes('EntryNotFound') ? t('controlFlows.fileNotFoundError') : t('controlFlows.dataParseError');
  }
  const { nodes, edges, combos } = transformData(rootData.value);
  allNodes.value = nodes;
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

watch(
  () => sideBarRef.value?.drawerVisible,
  (val) => {
    if (val) {
      showAccuracyReport.value = false;
    }
  },
);

onUnmounted(() => {
  window.removeEventListener('resize', updateGraphSize);
});
</script>

<style lang="less" scoped>
.g6-flow-chart {
  display: flex;
  height: 100%;
  box-sizing: border-box;
  background-color: var(--control-flow-bg);
  position: relative;
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
  }
}

.navbar-right {
  display: flex;
  flex-direction: row;
  align-self: flex-start;
  /* 固定在顶部 */
  gap: 8px;
  position: relative;
  top: 16px;
  pointer-events: all;
}

.accuracy-report-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background-color: var(--devui-secondary-button-bg);
  cursor: pointer;
  transition: background-color 0.2s ease;

  .devui-icon__container {
    color: var(--devui-icon);
  }

  &:hover {
    background-color: var(--devui-secondary-button-hover-bg);

    .devui-icon__container {
      color: var(--devui-operation-text-hover);
    }
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
  background-color: var(--control-flow-table-minimap-bg) !important;
  box-shadow: 0px -1px 6px 0px rgba(0, 0, 0, 0.08);
  border-radius: 20px 20px 0 0 !important;
  right: calc(var(--minimap-offset-right, 0px) + 16px);
  bottom: 48px;
  transition: right 0.3s ease;
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
  transition: right 0.3s ease;

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
