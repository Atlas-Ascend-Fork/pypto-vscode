<template>
  <ErrorView v-if="dataParseError" :jsonContent="t('controlFlows.dataParseError')"/>
  <div v-else class="g6-flow-chart">
    <RightPanel ref="sideBarRef"></RightPanel>
    <div class="tool-navbar">
      <Navbar :control-flow-data="rootData" :current-record-directory-path="outPutPath"/>
      <SearchSelect
          ref="searchSelectRef"
          :options="options"
          @matched-results="handleMatchedResults"
          @selected-value="handleSelectedValue"
          @activeEvent="handHoverEvent"
          class="tool-select"
      />
    </div>
    <div id="controlGraph" ref="chartContainer" class="chart-container"
         :class="{ 'init-graph': !isGraphVisible }" :style="{
        backgroundImage: 'url(' + svgPath + ')',
        backgroundRepeat: 'repeat',
      height: '100%'
    }"></div>

    <div ref="minimapRef" class="minimap-type"></div>
    <div class="tool-bar">
      <button class="icon-minus" style="width: 16px; height: 16px; left: 32px; color: var(--devui-text);"
              :title="t('zoomOut')" @click="graphZoomTo(-10)"></button>
      <input type="text" :value="zoom" class="zoom-value" @blur="inputZoomTo" @keydown.enter="$event.target.blur()"
             @input="onInput "/>
      <span class="text-value">%</span>
      <button class="icon-op-add" style="width: 16px; height: 16px; color: var(--devui-text); margin-right: 8px;"
              :title="t('zoomIn')" @click="graphZoomTo(10)"></button>
      <div class="empty-rect"></div>
      <button class="icon-location-new location-icon" :class="{active: isActive}"
              style="width: 16px; height: 16px; margin-left: 8px;" :title="t('resizeWindow')"
              @click="graphFitView"></button>
    </div>
  </div>
  <Loading v-if="isLoading" :loadingText="'loading'"/>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CommonEvent,
  Diamond,
  ExtensionCategory,
  Graph,
  GraphEvent,
  NodeEvent,
  Rect,
  RectCombo,
  type RectStyleProps,
  register
} from '@antv/g6';
import type { BaseCustomElementStyleProps, Group } from '@antv/g-lite';
import RightPanel from '@/components/controlFlowGraph/components/RightPanel.vue';
import { transformData } from '@/components/controlFlowGraph/util/parse-data';
import { getQuery } from '@/core/query';
import { getControlFlow } from '@/apis/control-flow';
import Navbar from '@/components/navbar/navbar.vue';
import { IfCardData, PathCardData } from "@/components/controlFlowGraph/type/node-detail-types";
import ErrorView from '@/components/comGraph/error.vue';
import SearchSelect from "@/components/controlFlowGraph/components/SearchSelect.vue";
import Loading from "@/components/comGraph/loading.vue";
import { openComputeGraph } from "@/apis/opener";

const { isDarkTheme } = inject('root');
const iconPathRight = ref(`${window.staticPath}/static-assets/control_flow_path_right.svg`);
const iconPathRightLight = ref(`${window.staticPath}/static-assets/control_flow_path_right-light.svg`);
const iconPathLeft = ref(`${window.staticPath}/static-assets/control_flow_path_left.svg`);
const iconPathLeftLight = ref(`${window.staticPath}/static-assets/control_flow_path_left-light.svg`);
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);
const loopLeftSvg = ref(`${window.staticPath}/static-assets/loop.svg`);
const loopLeftSvgLight = ref(`${window.staticPath}/static-assets/loop-light.svg`);
const sideBarRef = ref(null);
const minimapRef = ref(null);
const chartContainer = ref<HTMLDivElement | null>(null);
const PATH_CARD_NODE_TYPE = 'path-card-node';
let graph = null;
const { t } = useI18n();
const rootData = ref([])
const outPutPath = ref();
const programPath = ref();
const isEditableSelected = ref(false);
const isGraphVisible = ref(false);
const searchSelectRef = ref(null);
const isLoading = ref(true);
const zoom = ref(1)
const initZoom = ref()
const isActive = ref(false);

// 工具栏缩放
function onInput(e) {
  let val = e.target.value.replace(/[^0-9]/g, '');
  zoom.value = val;
}

async function inputZoomTo() {
  await graph.zoomTo(zoom.value / 100);
  isActive.value = false
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

// 自定义节点类（继承 Rect）,path节点
class PathCardNode extends Rect {
  /**
   * 1. 获取节点原始数据
   */
  get nodeData() {
    return this.context.graph.getNodeData(this.id) as { data?: PathCardData };
  }

  /**
   * 2. 处理数据默认值
   */
  get cardData(): Required<PathCardData> {
    const rawData = this.nodeData.data || {};
    return {
      name: rawData.name || 'PATH', // 默认名
      functionStats: {
        leafFunction: rawData.functionStats?.leafFunction,
        called: rawData.functionStats?.called,
        callee: rawData.functionStats?.callee,
      },
      errorStats: rawData.errorStats || null,
    };
  }

  get data() {
    return this.nodeData.data || {};
  }

  /**
   * 3. 基础卡片样式（覆盖 Rect 默认样式）
   */
  getCardBaseStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width, height] = this.getSize(attributes);
    const fillColor = isDarkTheme.value ? '#333333' : 'rgba(255,255,255,1)';
    return {
      width,
      height,
      fill: fillColor, // 卡片背景色
      radius: 8, // 卡片圆角

    };
  }

  // ------------------------------ 顶部路径容器------------------------------
  /**
   * 路径名称样式
   */
  getPathLabelStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2 + 25; // 顶部 Y 坐标（基于节点中心）
    const fillColor = isDarkTheme.value ? '#e6e6e6' : '#191919';

    return {
      x: -width / 2 + 35, // 左内边距 20px
      y: topY,
      text: this.cardData.name,
      fontSize: 14,
      fill: fillColor, // 原文本色
      fontWeight: 700,
      cursor: 'pointer',
    };
  }
  getPathUnderLineStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, lineWidth: number) {
    const [width] = this.getSize(attributes);
    const fillColor = isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.1)';
    const topY = -this.getSize(attributes)[1] / 2 + 25; // 顶部 Y 坐标（基于节点中心）
    const states = this.nodeData.states;
    let opacity = 0;
    if(states && (states.includes('path-label') || states.includes('path-icon-left'))) {
      opacity = 1;
    }
    return {
      x: -width / 2 + 35,
      y: topY,
      width:lineWidth,
      height: 1,
      fontWeight: 700,
      fill: fillColor,
      opacity,
    };
  }

  /**
   * 图标样式
   */
  getRightIconStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2;

    return {
      x: width / 2 - 30,
      y: topY + 6,
      width: 20,
      height: 20,
      src: attributes.avatarUrl || '',
      cursor: 'pointer'
    };
  }

  getLeftIconStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2;
    const iconPath=isDarkTheme.value ? iconPathLeft.value:iconPathLeftLight.value;
    return {
      x: -width / 2 + 10,
      y: topY + 6,
      width: 20,
      height: 20,
      src: iconPath,
      cursor: 'pointer'
    };
  }

  /**
   * 打开图
   */
  openGraph(){
    const length = this.nodeData.data.source.meta?.passes.length;
    openComputeGraph({
      outputPath: outPutPath.value,
      computeGraphPath: this.nodeData.data.source.meta?.passes[length - 1].graphFilePath,
      pathName: this.nodeData.data.source.meta?.passes[length - 1].pathName,
    })
  }

  /**
   * 绘制路径容器（名称 + 图标）
   */
  drawPathContainer(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    // 绘制路径名称
    const text =  this.upsert('path-label', 'text', this.getPathLabelStyle(attributes), container);
    const { width } = text.getBBox(); // 获取文本宽度

    // 绘制下划线
    this.upsert('path-line', 'rect', this.getPathUnderLineStyle(attributes, width), container);

    if (!text.__clickBound) {
      text.addEventListener('click', (e) => {
        // 阻止事件冒泡，避免触发节点的点击事件
        e.stopPropagation();
        this.openGraph();
        // 如果数据中有回调函数，则调用
        if (typeof attributes.onButtonClick === 'function') {
          attributes.onButtonClick(this.id, this.data);
        }
      });
      text.__clickBound = true; // 标记已绑定事件，避免重复绑定
    }
  }

  drawRightIconContainer(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    const leftIcon = this.upsert('path-icon-left', 'image', this.getLeftIconStyle(attributes), container);
    // 绘制图标
    const rightIcon = this.upsert('path-icon-right', 'image', this.getRightIconStyle(attributes), container);
    // 右侧按钮打开抽屉
    if (!rightIcon.__clickBound) {
      rightIcon.addEventListener('click', (e) => {
        // 阻止事件冒泡，避免触发节点的点击事件
        e.stopPropagation();
        sideBarRef.value.transFormPanelData(this.nodeData, outPutPath.value, 0)
        // 执行业务逻辑
        // 如果数据中有回调函数，则调用
        if (typeof attributes.onButtonClick === 'function') {
          attributes.onButtonClick(this.id, this.data);
        }
      });
      rightIcon.__clickBound = true; // 标记已绑定事件，避免重复绑定
    }

    // 左侧按钮打开计算图
    if (!leftIcon.__clickBound) {
      leftIcon.addEventListener('click', (e) => {
        // 阻止事件冒泡，避免触发节点的点击事件
        e.stopPropagation();
        this.openGraph();
        // 如果数据中有回调函数，则调用
        if (typeof attributes.onButtonClick === 'function') {
          attributes.onButtonClick(this.id, this.data);
        }
      });
      leftIcon.__clickBound = true; // 标记已绑定事件，避免重复绑定
    }
  }

  // ------------------------------ 分割线 ------------------------------
  /**
   * 分割线样式（水平细线）
   */
  getSeparatorStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number) {
    const [width] = this.getSize(attributes);
    const fillColor = isDarkTheme.value ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.1)';
    return {
      x: -width / 2 + 20, // 左右内边距 20px
      y,
      width: width - 40, // 分割线宽度 = 卡片宽 - 2*内边距
      height: 1, // 分割线高度 1px
      fill: fillColor,
    };
  }

  /**
   * 绘制分割线（复用方法，传入不同 Y 坐标）
   */
  drawSeparator(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number, container: Group) {
    this.upsert(`separator-${y}`, 'rect', this.getSeparatorStyle(attributes, y), container);
  }

  // ------------------------------ 函数统计项（leafFunction/called/callee）------------------------------
  /**
   * 函数统计项 Label 样式（左对齐）
   */
  getFuncLabelStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number, label: string) {
    const [width] = this.getSize(attributes);
    const fillColor = isDarkTheme.value ? '#999999' : 'rgba(174,174,174,1)';

    return {
      x: -width / 2 + 12,
      y,
      text: label,
      fontSize: 12,
      fill: fillColor, // Label 色
      textAlign: 'left',
      textBaseline: 'middle',
    };
  }

  /**
   * 函数统计项 Value 样式（右对齐）
   */
  getFuncValueStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number, value: number) {
    const [width] = this.getSize(attributes);
    const fillColor = isDarkTheme.value ? '#e6e6e6' : '#191919';

    return {
      x: width / 2 - 20, // 右内边距 20px
      y,
      text: value.toString(),
      fontSize: 14,
      fill: fillColor, // 字体颜色
      textAlign: 'right',
      textBaseline: 'middle',
    };
  }


  getFuncLabelBgStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number, container: Group, className: string) {
    const [width] = this.getSize(attributes);
    let fillColor = isDarkTheme.value ? '#333333' : 'rgba(255,255,255,1)';
    const states = this.nodeData.states;
    if(states&&states.includes(className)) {
      fillColor= isDarkTheme.value ? '#e6e6e6' : 'rgba(0,0,0,0.5)'
    }
    type:className;
    return {
      x: -width / 2 +8 , // 左右内边距 8
      y,
      width: width - 16, // 分割线宽度 = 卡片宽 - 内边距
      height: 24,
      fill: fillColor,
      radius:4,
      opacity:0.2,
      cursor: 'pointer'
    };
  }

  /**
   * 绘制函数统计项
   */
  drawFunctionStats(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    const {functionStats} = this.cardData;
    const startY = -this.getSize(attributes)[1] / 2 + 54; // 统计项起始 Y 坐标
    const stats = [
      {label: t('controlFlows.leafName'), value: functionStats.leafFunction},
      {label: t('controlFlows.calledFunctionPanelTitle'), value: functionStats.called},
      {label: t('controlFlows.callFunctionPanelTitle'), value: functionStats.callee},
    ];

    // 遍历绘制每个统计项（Label + Value）
    stats.forEach((item, index) => {
      const y = startY + index * 30; // 统计项间距 30px
      // 绘制 Label
      this.upsert(`func-label-${index}`, 'text', this.getFuncLabelStyle(attributes, y, item.label), container);
      // 绘制 Value
      this.upsert(`func-value-${index}`, 'text', this.getFuncValueStyle(attributes, y, item.value), container);
      // hover背景
      const funcBg = this.upsert(`func_bg_${index}`,'rect',this.getFuncLabelBgStyle(attributes, y-12,container,`func_bg_${index}`), container);

      if (!funcBg.__clickBound) {
        funcBg.addEventListener('click', (e) => {
          const states = this.nodeData.states;
          const index=states.includes('func_bg_2') ? 1 : 0;
          // 阻止事件冒泡，避免触发节点的点击事件
          e.stopPropagation();
          sideBarRef.value.transFormPanelData(this.nodeData, outPutPath.value, index)
          // 如果数据中有回调函数，则调用
          if (typeof attributes.onButtonClick === 'function') {
            attributes.onButtonClick(this.id, this.data);
          }
        });
        funcBg.__clickBound = true; // 标记已绑定事件，避免重复绑定
      }
    });
  }

  // ------------------------------ 错误统计项（可选）------------------------------
  /**
   * 错误统计项 Value 样式（红色）
   */
  getErrorValueStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number, value: number) {
    const [width] = this.getSize(attributes);
    const fillColor = isDarkTheme.value ? '#EE696F' : '#c7000b';

    return {
      x: width / 2 - 20,
      y,
      text: value.toString(),
      fontSize: 16,
      fill: fillColor, //错误文本色
      textAlign: 'right',
      textBaseline: 'middle',
    };
  }

  /**
   * 绘制错误统计项（有 errorStats 时才绘制）
   */
  async drawErrorStats(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    const {errorStats} = this.cardData;
    if (!errorStats || Object.keys(errorStats).length === 0) return;

    // 1. 错误统计前的分割线
    const funcEndY = -this.getSize(attributes)[1] / 2 + 56 + 2 * 30; // 函数统计项结束 Y 坐标
    this.drawSeparator(attributes, funcEndY + 20, container);
  }

  getHoleStyle(attributes) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2; // 顶部 Y 坐标（基于节点中心）
    const fillColor = isDarkTheme.value ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';

    return {
      x: -width / 2,
      y: topY,
      radius: '8 8 0 0',
      width: width,
      height: 32,
      fill: fillColor,
    };
  }

  drawHoleShape(attributes, container) {
    const holeStyle = this.getHoleStyle(attributes, container);
    this.upsert('hole', 'rect', holeStyle, container);
  }

  // ------------------------------ 核心渲染方法（整合所有元素）------------------------------
  render(
  attributes = this.parsedAttributes, container: Group | undefined
  ) {
    // 1. 合并基础样式（覆盖 Rect 默认样式）
    const mergedAttrs = {
      ...attributes,
      ...this.getCardBaseStyle(attributes),
    };
    // 2. 绘制基础矩形（继承 Rect 的核心能力）
    super.render(mergedAttrs, container);
    // 3. 绘制卡片内部元素
    this.drawHoleShape(mergedAttrs, container);
    this.drawPathContainer(mergedAttrs, container); // 顶部name容器
    this.drawRightIconContainer(mergedAttrs, container); // 顶部图片容器
    this.drawFunctionStats(mergedAttrs, container); // 函数统计项
    this.drawErrorStats(mergedAttrs, container); // 错误统计项
  }
}

// 自定义节点类（继承菱形），if节点
class IfCardNode extends Diamond {
  get nodeData() {
    return this.context.graph.getNodeData(this.id) as { data?: PathCardData };
  }

  /**
   *  处理数据默认值
   */
  get cardData(): Required<IfCardData> {
    const rawData = this.nodeData || {};
    return {
      name: 'IF', // 默认，全程改为悬浮提示。
    };
  }

  get data() {
    return this.nodeData.data || {};
  }

  /**
   *  基础卡片样式（覆盖 菱形 默认样式）
   */
  getCardBaseStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width, height] = this.getSize(attributes);

    return {
      fill: 'rgba(246,158,57,0.1)', // 卡片背景色
      stroke: 'rgba(246,158,57,1)', // 卡片边框
      lineWidth: 1,
    };
  }  // ------------------------------ 顶部路径容器（name + 图标）------------------------------
  /**
   * name名称样式
   */
  getIfLabelStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2 + 30; // 顶部 Y 坐标（基于节点中心）
    return {
      x: -7, // 左内边距 20px
      y: 14,
      text: this.cardData.name,
      fontSize: 14,
      fill: '#F9B766', // 原文本色
      fontWeight: 500,
    };
  }


  /**
   * 绘制name容器
   */
  drawIfContainer(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    // 绘制路径名称
    this.upsert('path-label', 'text', this.getIfLabelStyle(attributes), container);
  }

  // todo：后续需要替换为 菱形svg图标
  getHoleStyle(attributes) {
    const [width, height] = this.getSize(attributes);

    return {
      points: [
        [0, -18],
        [7, -11],
        [0, -4],
        [-7, -11],
      ],
      fill: '#F9B766',
      isClosed: true,
      backgroundRadius: 8,
    };
  }

  drawHoleShape(attributes, container) {
    const holeStyle = this.getHoleStyle(attributes, container);
    this.upsert('hole-if', 'polygon', holeStyle, container);
  }

  // ------------------------------ 核心渲染方法（整合所有元素）------------------------------
  render(
  attributes = this.parsedAttributes, container: Group | undefined
  ) {
    // 1. 合并基础样式（覆盖 Rect 默认样式）
    const mergedAttrs = {
      ...attributes,
      ...this.getCardBaseStyle(attributes),
    };
    // 2. 绘制
    super.render(mergedAttrs, container);
    this.drawIfContainer(mergedAttrs, container);
    this.drawHoleShape(mergedAttrs, container);

  }
}

// 自定义组合
class LogoWithRectCombo extends RectCombo {
  /**
   * 1. 获取节点原始数据）
   */
  get nodeData() {
    return this.context.graph.getNodeData(this.id) as { data?: PathCardData };
  }

  async drawButton(attributes) {
    const { collapsed } = attributes;
    const [width, height] = this.getKeySize(attributes);
    const btnR = 8;
    const y = -height / 2;
    const x = -width / 2 + 10;
    const states = this.nodeData.states;
    let isSelected = false;
    let isActived = false;
    if (states && states.length > 0) {
      isSelected = states.includes('selected');
      isActived = states.includes('active');
    }
    const buttonBlue = isDarkTheme.value ? '#317AF7' : '#0950de';
    const buttonWeak = isDarkTheme.value ? '#1F1F1F' : 'rgba(243,243,243,1)';
    const textBlue = isDarkTheme.value ? '#317AF7' : '#0a59f7';
    const textWeak = isDarkTheme.value ? '#b3b3b3' : '#777777';
    const selectTextColor = isDarkTheme.value ? '#FFFFFF' : '#000000';

    let loopLeftIcon=isDarkTheme.value ? loopLeftSvg.value : loopLeftSvgLight.value;
    let isActivedTextColor = isActived ? textBlue : textWeak;
    let isSelectedHitAreaColor = isSelected ? buttonBlue : buttonWeak;
    if (isSelected) {
      isActivedTextColor = '#FFFFFF'
      loopLeftIcon=loopLeftSvg.value;
    }


    // loop标签背景色板
    const hitArea = this.upsert('hit-area', 'rect', {
      y: y - 15,
      x,
      width: 20 + this.id.length * 10.3,
      height: 35,
      radius: 8,
      fill: isSelectedHitAreaColor
    }, this);
    // loop标签左图片
    const leftImage = this.upsert('left-svg', 'image', {
      y: y - 8,
      x: x + 10,
      width: 20,
      height: 20,
      src: loopLeftIcon,
    }, this)
    // loop标签文本
    const text = await this.upsert('loop-text', 'text', {
      y: y + 12,
      x: x + 35,
      text: this.id,
      fill: isActivedTextColor,
      fontSize: 16
    }, this)
    await nextTick();
  }


  render(attributes, container) {
    super.render(attributes, container);
    const shape = this.drawButton(attributes);
  }
}

const options = ref([])
const combosNode = ref(null);

// 接收搜索子组件传递的数据
const matchedResults = ref([]); // 匹配结果
const selectedValue = ref(null); // 选中项

// 处理子组件事件
// 过滤类型高亮
const handleMatchedResults = async (results) => {
  matchedResults.value = results;
  if (matchedResults.value.length > 0) {
    combosNode.value.forEach((node) => {
      const id = node.id
      graph.setElementState(id, [],);
    })
    matchedResults.value.forEach((item) => {
      const id = item.value
      graph.setElementState(id, 'active',);
    })

  } else {
    combosNode.value.forEach((node) => {
      const id = node.id
      graph.setElementState(id, [],);
    })
  }
};

//鼠标选中以及enter按下类型高亮
const handleSelectedValue = (value) => {
  selectedValue.value = value;
  combosNode.value.forEach((node) => {
    const id = node.id
    graph.setElementState(id, [],);
  })
  if (selectedValue.value) {
    graph.setElementState(selectedValue.value.value, 'selected');
    graph.focusElement(selectedValue.value.value)
  }
};

// 鼠标hover以及键盘上下高亮
const handHoverEvent = (value) => {
  handleMatchedResults(matchedResults.value)
  graph.setElementState(value, 'selected');
}

// 更新画布大小
async function updateGraphSize(){
  await graph.layout();
  await graph.resize();
  await graph.render()
  await graph.draw()
}

//  初始化 G6 图表（
const initG6Graph = async (nodes, edges, combos,) => {
  register(ExtensionCategory.NODE, 'path-card-node', PathCardNode);
  register(ExtensionCategory.NODE, 'if-card-node', IfCardNode);
  register(ExtensionCategory.COMBO, 'combo-with-extra-button', LogoWithRectCombo);
  const container = chartContainer.value as HTMLDivElement;
  graph = new Graph({
    container: container,
    plugins: [
      //   小地图
      {
        key: 'my-minimap',
        type: 'minimap',
        size: [260, 160],
        container: minimapRef.value,
        containerStyle: {
          borderRadius: '20px 20px 0 0',
        },
        maskStyle: {
          border: '1px solid rgba(49,122,247,0.51)',
        }
      },
      //  画布背景
      {
        type: 'background',
        key: 'my-background', // 为插件指定标识符，方便动态更新
        backgroundColor: 'var(--control-flow-bg)', // 设置背景色
        backgroundRepeat: 'space',
        backgroundPosition: '10px ',
        backgroundSize: 'fit',
        opacity: '0.1'
      },
      {
        type: 'tooltip',
        key: 'my-tooltip',
        // 只对if节点启用，边不显示tooltip
        enable: (e, itemes) => itemes[0].type === 'if-card-node',
        getContent: (e, items) => {
          return `<div>${items[0].data.source.magicName}</div>`;
        },
        style:{
          '.tooltip':
              {
                visibility: 'hidden 0',
                background:isDarkTheme.value ? '#363636' : '#FFFFFF',
                color:isDarkTheme.value ? '#FFFFFF' : '#363636',
              }
        }
      },
    ],
    data: {
      nodes,
      edges,
      combos,
    },
    node: {
      style: {
        size: (d) => {
          const data = d.data
          if (d.type === PATH_CARD_NODE_TYPE) {
            return data.errorStats ? [200, Object.keys(data.errorStats).length * 30 + 140] : [200, 140];
          } else {
            return [200, 100]
          }
        },
        avatarUrl:()=>isDarkTheme.value ? iconPathRight.value : iconPathRightLight.value,
        border: 1,
        halo: false, // 启用光晕
        haloLineWidth: 0,
        ports: [{
          placement: 'top',
        },
        {
          placement: "bottom"
        }]
      },
      // 各种状态下的样式
      state: {
        selected: {
          lineWidth: 0,
        },
        active: {
          lineWidth: 0,
        },
        inactive: {
          opacity: 1,
        },
      },
    },
    combo: {
      type: 'combo-with-extra-button',
      style: {
        fill: 'rgba(255,255,255,0)',
        padding: 30,
        borderStyle: 'dashed',
        radius: 16,
        lineWidth: 1,
        lineDash: [6, 4],
        lineCap: 'round',
        stroke: () => isDarkTheme.value ? '#666666' : '#aeaeae',
      },
      state: {
        selected: {
          lineWidth: 2,
          fill: () => isDarkTheme.value ? '#317af7' : '#0a59f7',
          stroke: () => isDarkTheme.value ? '#317af7' : '#0a59f7',
          lineDash: [2, 1],
          lineCap: 'square',
          halo: false, // 启用光晕
          haloLineWidth: 0,
        },
        highlight: {
          lineWidth: 1,
          fill: () => isDarkTheme.value ? '#317af7' : '#0a59f7',
          stroke: () => isDarkTheme.value ? '#317af7' : '#0a59f7',
          halo: false, // 启用光晕
          haloLineWidth: 0,
        },
        inactive: {
          fill: 'rgba(255,184,7,0)',
          stroke: '#BFBFBF',
          opacity: 1,
        },
        active: {
          lineWidth: 1,
          fill: () => isDarkTheme.value ? '#317af7' : '#0a59f7',
          stroke: () => isDarkTheme.value ? '#317af7' : '#0a59f7',
          halo: false, // 启用光晕
          haloLineWidth: 0,
        },
        disabled: {
          fill: '#ECECEC',
          stroke: '#BFBFBF',
          opacity: 0.5,
        }
      },
      "animation": {
        "enter": "fade", // 使用渐变动画
        "update": "translate", // 使用平移动画
        "exit": "fade" // 使用渐变动画
      }
    },
    behaviors: [
      {
        type: 'click-select',
        degree: 1,
        state: 'selected', // 选中的状态
        neighborState: '', // 相邻节点附着状态
        multiple: true,
        trigger: ['shift'],
      }, 'zoom-canvas', 'hover-activate',
      {
        type: 'drag-canvas',
        enable: (event) => {
          return event.targetType === 'node' || 'canvas' || 'combo'
        }
      }
    ],
  });
  await graph.render();


  // path内hover事件
  const lineHoverClass=['func_bg_0', 'func_bg_1', 'func_bg_2', 'path-label' , 'path-icon-left']
  graph.on(NodeEvent.POINTER_OVER,async (event)=>{
    const { target, originalTarget } = event;
    if(lineHoverClass.includes(originalTarget.className)){
      await graph.setElementState(target.id, originalTarget.className)
    }else {
      const currentStates = graph.getElementState(target.id);
      const newStates = currentStates.filter((state) => !lineHoverClass.includes(state));
      graph.setElementState(target.id, newStates);
    }
  })

  graph.on(NodeEvent.POINTER_LEAVE,async (event)=>{
    const { target } = event;
    const currentStates = graph.getElementState(target.id);
    const newStates = currentStates.filter((state) => !lineHoverClass.includes(state));
    graph.setElementState(target.id, newStates);
  })

  watch(() => isDarkTheme.value, async () => {
    graph.draw()
    await graph.render();

    combosNode.value.forEach((node) => {
      const id = node.id
      graph.setElementState(id, [],);
    })
    graph.updatePlugin({
      key: 'my-tooltip',
      style:{
        '.tooltip':
            {
              background:isDarkTheme.value ? '#363636' : '#FFFFFF',
              color:isDarkTheme.value ? '#FFFFFF' : '#363636'
            }
      }
    });
  })

  function fitActive() {
    isActive.value = false
  }

  // 监听滚轮以及拖拽事件，使得自适应按钮取消高亮
  graph.on(CommonEvent.WHEEL, fitActive)
  graph.on(CommonEvent.DRAG, fitActive)

  function clickFun(event) {
    searchSelectRef.value.clear()
    if (event.target.id) {
      graph.setElementState(event.target.id, 'selected');
    }
  }

  // 监听点击事件
  graph.on(CommonEvent.CLICK, clickFun)

  // 初始化时视角自适应
  await graph.fitView();
  const initSize = await graph.getZoom()
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

  const {nodes, edges, combos} = transformData(rootData.value);
  combosNode.value = combos;
  await initG6Graph(nodes, edges, combos);
  // 初始化搜索组件数据源
  combos.forEach(item => {
    options.value.push({
      label: item.id,
      value: item.id,
      data: item,
    });
  })
  nodes.forEach(item => {
    if (item.type !== 'if-card-node') {
      options.value.push({
        label: item.data.name,
        value: item.id,
        data: item,
      });
    }
  })
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
  height: 150px;
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 12px;
  gap: 8px;
  background: var(--devui-header-gradient-bg);

  .tool-select {
    position: relative;
    top: 16px
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
  width: 260px;
  height: 160px;
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

:deep(.tooltip){
  border-radius: 8px !important;
  transition-duration: 0s !important;
}
</style>
<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.tool-bar {
  position: fixed;
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
    content: "\E0DB";
  }
}
</style>