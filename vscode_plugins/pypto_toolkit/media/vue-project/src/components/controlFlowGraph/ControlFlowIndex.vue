<template>
  <div class="g6-flow-chart">
    <RightPanel ref="sideBarRef"></RightPanel>
    <div class="tool-navbar">
      <Navbar :control-flow-data="rootData" :current-record-directory-path="outPutPath"/>
    </div>
    <div ref="chartContainer" class="chart-container"></div>
    <div ref="minimapRef" class="minimap-type"></div>
    <div class="tool-bar">
      <i class="icon icon-minus" @click="graphZoomTo(-0.1)"></i>
      <span class="tool-line"></span>
      <span class="tool-zoom">{{ Math.round(zoom * 100) }}%</span>
      <span class="tool-line"></span>
      <i class="icon icon-add" @click="graphZoomTo(0.1)"></i>
      <span class="tool-line"></span>
      <i class="icon icon-location-new" @click=" graph.fitView()"></i>
    </div>
    <d-editable-select v-model="searchValue" :allow-clear="true" :options="options"
                       :placeholder="t('controlFlows.searchPlaceholder')"
                       :position="['bottom']" :width="320" class="tool-select" max-height="500"
                       @blur="isEditableSelected=false"
                       @change="selectChange" @focus="isEditableSelected=true"></d-editable-select>

  </div>
</template>

<script lang="ts" setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Diamond, ExtensionCategory, Graph, GraphEvent, Rect, RectCombo, type RectStyleProps, register } from '@antv/g6';
import type { BaseCustomElementStyleProps, Group } from '@antv/g-lite';
import RightPanel from '@/components/controlFlowGraph/RightPanel.vue';
import { transformData } from '@/components/controlFlowGraph/util/parse-data';
import { getQuery } from '@/core/query';
import { getControlFlow } from '@/apis/control-flow';
import Navbar from '@/components/navbar/navbar.vue';
import { IfCardData, PathCardData } from "@/components/controlFlowGraph/type/node-detail-types";

const iconPath1 = ref(`${window.staticPath}/static-assets/icon_title_2.svg`);
const svgPath = ref(`${window.staticPath}/static-assets/spot-ControlFlow-BG.svg`);
const loopRightSvg = ref(`${window.staticPath}/static-assets/op-node-sign.svg`);
const loopLeftSvg = ref(`${window.staticPath}/static-assets/icon_title_3.svg`);
const sideBarRef = ref(null);
const minimapRef = ref(null);
const chartContainer = ref<HTMLDivElement | null>(null);
const PATH_CARD_NODE_TYPE = 'path-card-node';
const zoom = ref(1)
let graph = null;
const {t} = useI18n();
const rootData = ref([])
const outPutPath = ref()
const isEditableSelected = ref(false);


async function graphZoomTo(size: number) {
  zoom.value += size;
  await graph.zoomTo(zoom.value);
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
    return {
      width,
      height,
      fill: '#333333', // 卡片背景色
      radius: 8, // 卡片圆角

    };
  }

  // ------------------------------ 顶部路径容器------------------------------
  /**
   * 路径名称样式
   */
  getPathLabelStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2 + 30; // 顶部 Y 坐标（基于节点中心）
    return {
      x: -width / 2 + 20, // 左内边距 20px
      y: topY,
      text: this.cardData.name,
      fontSize: 14,
      fill: '#E6E6E6', // 原文本色
      fontWeight: 500,
    };
  }

  /**
   * 图标样式
   */
  getMyIconStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2 + 30;

    return {
      x: width / 2 - 30,
      y: topY - 18,
      width: 20,
      height: 20,
      src: attributes.avatarUrl || '',
      fill: 'rgba(255, 255, 255, 1)',
      cursor: 'pointer'
    };
  }

  /**
   * 绘制路径容器（名称 + 图标）
   */
  drawPathContainer(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    // 绘制路径名称
    this.upsert('path-label', 'text', this.getPathLabelStyle(attributes), container);
  }

  drawIconContainer(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    // 绘制图标
    const btn = this.upsert('path-icon', 'image', this.getMyIconStyle(attributes), container);
    // 为按钮添加点击事件
    if (!btn.__clickBound) {
      btn.addEventListener('click', (e) => {
        // 阻止事件冒泡，避免触发节点的点击事件
        e.stopPropagation();
        sideBarRef.value.transFormPanelData(this.nodeData, outPutPath.value)
        // 执行业务逻辑
        // 如果数据中有回调函数，则调用
        if (typeof attributes.onButtonClick === 'function') {
          attributes.onButtonClick(this.id, this.data);
        }
      });
      btn.__clickBound = true; // 标记已绑定事件，避免重复绑定
    }
  }

  // ------------------------------ 分割线 ------------------------------
  /**
   * 分割线样式（水平细线）
   */
  getSeparatorStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number) {
    const [width] = this.getSize(attributes);
    return {
      x: -width / 2 + 20, // 左右内边距 20px
      y,
      width: width - 40, // 分割线宽度 = 卡片宽 - 2*内边距
      height: 1, // 分割线高度 1px
      fill: 'rgba(255, 255, 255, 0.1)',
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
    return {
      x: -width / 2 + 20, // 左内边距 20px
      y,
      text: label,
      fontSize: 12,
      fill: '#999999', // Label 色
      textAlign: 'left',
      textBaseline: 'middle',
    };
  }

  /**
   * 函数统计项 Value 样式（右对齐）
   */
  getFuncValueStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number, value: number) {
    const [width] = this.getSize(attributes);
    return {
      x: width / 2 - 20, // 右内边距 20px
      y,
      text: value.toString(),
      fontSize: 14,
      fill: '#E6E6E6', // 字体颜色
      textAlign: 'right',
      textBaseline: 'middle',
    };
  }

  /**
   * 绘制函数统计项
   */
  drawFunctionStats(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
    const {functionStats} = this.cardData;
    const startY = -this.getSize(attributes)[1] / 2 + 56; // 统计项起始 Y 坐标（分割线下方 12px）
    const stats = [
      { label: 'leaf Function', value: functionStats.leafFunction },
      { label: 'called', value: functionStats.called },
      { label: 'callee', value: functionStats.callee },
    ];

    // 遍历绘制每个统计项（Label + Value）
    stats.forEach((item, index) => {
      const y = startY + index * 30; // 统计项间距 30px
      // 绘制 Label
      this.upsert(`func-label-${ index }`, 'text', this.getFuncLabelStyle(attributes, y, item.label), container);
      // 绘制 Value
      this.upsert(`func-value-${ index }`, 'text', this.getFuncValueStyle(attributes, y, item.value), container);
    });
  }

  // ------------------------------ 错误统计项（可选）------------------------------
  /**
   * 错误统计项 Value 样式（红色）
   */
  getErrorValueStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, y: number, value: number) {
    const [width] = this.getSize(attributes);
    return {
      x: width / 2 - 20,
      y,
      text: value.toString(),
      fontSize: 16,
      fill: '#EE696F', //错误文本色
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
    this.drawSeparator(attributes, funcEndY + 18, container);
  }

  getHoleStyle(attributes) {
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2; // 顶部 Y 坐标（基于节点中心）
    return {
      x: -width / 2,
      y: topY,
      radius: '8 8 0 0',
      width: width,
      height: 45,
      fill: '#3D3D3D',
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
    // // 1. 合并基础样式（覆盖 Rect 默认样式）
    const mergedAttrs = {
      ...attributes,
      ...this.getCardBaseStyle(attributes),
    };
    // 2. 绘制基础矩形（继承 Rect 的核心能力）
    super.render(mergedAttrs, container);
    // // // 3. 绘制卡片内部元素
    this.drawSeparator(mergedAttrs, -mergedAttrs.height / 2 + 40, container); // 路径下方分割线
    this.drawHoleShape(mergedAttrs, container);
    this.drawPathContainer(mergedAttrs, container); // 顶部name容器
    this.drawIconContainer(mergedAttrs, container); // 顶部图片容器
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
    // // 1. 合并基础样式（覆盖 Rect 默认样式）
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
    const {collapsed} = attributes;
    const [width, height] = this.getKeySize(attributes);
    const btnR = 8;
    const y = -height / 2;
    const x = -width / 2 + 10;
    const states = this.nodeData.states;
    let isSelected = false;
    if (states && states.length > 0) {
      isSelected = states.includes('selected');
    }
    let isSelectedTextColor = isSelected ? '#317AF7' : '#B3B3B3'

    // loop标签背景色板
    const hitArea = this.upsert('hit-area', 'rect', {
      y: y - 15,
      x,
      width: 20 + this.id.length * 10.3,
      height: 35,
      radius: 8,
      fill: '#1F1F1F'
    }, this);
    // loop标签左图片
    const leftImage = this.upsert('left-svg', 'image', {
      y: y - 10,
      x: x + 10,
      width: 20,
      height: 20,
      src: isSelected ? loopRightSvg.value : loopLeftSvg.value,
      color: isSelectedTextColor,
    }, this)
    // loop标签文本
    const text = await this.upsert('loop-text', 'text', {
      y: y + 10,
      x: x + 35,
      text: this.id,
      fill: isSelectedTextColor,
      fontSize: 16
    }, this)
    await nextTick();
    // loop标签右侧图片背景板todo,loop 代码预留接口
    // const righthitArea = this.upsert('right--area', 'rect', {
    //   y: y - 15,
    //   x: -width / 2 + 68 + this.id.length * 10.3,
    //   width: 20,
    //   height: 35,
    //   radius: 8,
    //   fill: '#1F1F1F'
    //   , cursor: 'pointer'
    // }, this);
    // loop标签右侧图片
    // const rightImage = this.upsert('right-svg', 'image', {
    //   y: y - 10,
    //   x: -width / 2 + 40 + this.id.length * 9.5,
    //   width: 20,
    //   height: 20,
    //   src: loopRightSvg.value,
    //   cursor: 'pointer'
    // }, righthitArea)
    // 为按钮添加点击事件l
    // if (!righthitArea?.__clickBound) {
    //   righthitArea?.addEventListener('click', (e) => {
    //     // 阻止事件冒泡，避免触发节点的点击事件
    //     e.stopPropagation();
    //     // 如果数据中有回调函数，则调用
    //   });
    //   righthitArea.__clickBound = true; // 标记已绑定事件，避免重复绑定
    // }
  }


  render(attributes, container) {
    super.render(attributes, container);
    const shape = this.drawButton(attributes);
  }
}


const options = ref([])
const searchValue = ref('');

// 搜索时定位搜索loop
function selectChange(value) {
  if (searchValue.value) {
    graph.setElementState(value, 'selected');
    graph.focusElement(value)
  }
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
        size: [200, 160],
        container: minimapRef.value,
        containerStyle: {
          backgroundColor: '#292A2E', // 设置背景色
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
        backgroundColor: '#1F1F1F', // 设置背景色
        backgroundImage: `url(${svgPath.value} )`, // 设置背景图
        backgroundRepeat: 'space',
        backgroundPosition: '10px ',
        backgroundSize: 'fit',
        opacity: '0.1'
      },
      {
        type: 'tooltip',
        // 只对if节点启用，边不显示tooltip
        enable: (e, itemes) => itemes[0].type === 'if-card-node',
        getContent: (e, items) => {
          return `<div>${items[0].data.source.magicName}</div>`;
        },
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
        avatarUrl: iconPath1.value,
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
        inactive: {
          fill: '',
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
        stroke: '#666666',
      },
      state: {
        selected: {
          lineWidth: 1,
          fill: '#317AF7',
          stroke: '#317AF7',
          halo: false, // 启用光晕
          haloLineWidth: 0,

        },
        highlight: {
          stroke: 'rgb(0,72,255)',
          lineWidth: 1,
        },
        inactive: {
          fill: 'rgba(255,184,7,0)',
          stroke: '#BFBFBF',
          opacity: 1,
        },
        active: {
          fill: 'rgba(49,122,247,0.2)',
          stroke: '#317AF7',
          opacity: 1,
          halo: false, // 启用光晕
          haloLineWidth: 0,
        },
        disabled: {
          fill: '#ECECEC',
          stroke: '#BFBFBF',
          opacity: 0.5,
        },
      },
      layout: {
        type: 'antv-dagre',
        rankdir: 'TB',
        align: 'DL',
        sortByCombo: true,
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
        neighborState: 'selected', // 相邻节点附着状态
        multiple: true,
        trigger: ['shift'],
      }, 'drag-canvas', 'zoom-canvas', 'hover-activate',
    ],
  });

  graph.on(GraphEvent.AFTER_TRANSFORM, async () => {
    await graph.resize()
    zoom.value = graph.getZoom()
    await graph.layout();
    await graph.resize();
  })
  await graph.render();
  // 初始化时视角自适应
  graph.fitCenter()

};

onMounted(async () => {
  const res = await getQuery();
  outPutPath.value = JSON.parse(res.uri.query).url
  const data = await getControlFlow(outPutPath.value);

  rootData.value = data.data;
  const {nodes, edges, combos} = transformData(rootData.value);
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
});

onUnmounted(() => {
});
</script>

<style lang="less" scoped>
.g6-flow-chart {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background-color: #1F1F1F;
}

.tool-navbar {
  position: absolute !important;
  z-index: 99;
}

.chart-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.img-class {
  background-color: #E6E6E6;
}

.minimap-type {
  position: absolute !important;
  background-color: #292A2E !important; // 设置背景色
  border-radius: 20px 20px 0 0 !important;
  width: 200px;
  height: 160px;
  right: 16px;
  bottom: 65px;
}

.tool-bar {
  position: fixed;
  width: 200px;
  height: 32px;
  right: 16px;
  bottom: 30px;
  background-color: rgba(51, 51, 51, 1);
  border-radius: 24px;
  display: flex;
  box-sizing: border-box;
  justify-content: space-between;
  padding: 0 10px;
  align-items: center;
  z-index: 2;

  .tool-line {
    width: 1px;
    height: 12px;
    background-color: rgba(255, 255, 255, 0.1);
  }

  .tool-zoom {
    font-size: 12px;
    line-height: 18px;
  }

  .icon {
    display: flex;
    align-self: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    line-height: 24px;
    cursor: pointer;
  }
}

.tool-select {
  position: fixed;
  right: 16px;
  top: 30px;
  color: #E6E6E6;
  z-index: 99;

  :deep(.devui-editable-select__arrow-icon) {
    display: none;
  }

  :deep(.devui-editable-select__clear-icon) {
    display: flex !important;
  }

  :deep(.devui-editable-select__item--selected) {
    color: #E6E6E6;
    background-color: rgba(49, 122, 247, 0.2);
  }

  :deep(.devui-editable-select-input__inner) {
    font-size: 13px;
    color: #E6E6E6;
    caret-color: rgba(49, 122, 247, 1);

    &:focus {
      outline: none;
    }
  }
}
</style>