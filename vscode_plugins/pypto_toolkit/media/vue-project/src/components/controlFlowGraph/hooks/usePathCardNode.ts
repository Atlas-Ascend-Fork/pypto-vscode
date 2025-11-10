import { BaseBehavior, CanvasEvent, GraphEvent, Rect, type RectStyleProps } from '@antv/g6';
import type { BaseCustomElementStyleProps, Group } from '@antv/g-lite';
import { PathCardData } from '@/components/controlFlowGraph/type/node-detail-types';
import { inject, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { openComputeGraph } from '@/apis/opener';
import { getThemeColorTool } from '@/components/controlFlowGraph/util/getTheme';

/**
 * 自定义path卡片hook函数
 * @param sideBarRef 右侧抽屉
 * @param outPutPath 用于打开计算图
 */
export function usePathCardNodes(sideBarRef, outPutPath, isDarkTheme) {
  const { t } = useI18n();
  const iconPathLeft = ref(`${window.staticPath}/static-assets/control_flow_path_left.svg`);
  const iconPathLeftLight = ref(`${window.staticPath}/static-assets/control_flow_path_left-light.svg`);
  const iconPathRight = ref(`${window.staticPath}/static-assets/control_flow_path_right.svg`);
  const iconPathRightLight = ref(`${window.staticPath}/static-assets/control_flow_path_right-light.svg`);
  const DEFAULT_LEVEL = 'detailed';

  // 自定义节点类（继承 Rect）,path节点
  class PathCardNodes extends Rect {
    /**
     * 1. 获取节点原始数据
     */
    get nodeData() {
      return this.context.graph.getNodeData(this.id) as { data?: PathCardData };
    }

    get level() {
      return this.data.level || DEFAULT_LEVEL;
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

      const fillColor = getThemeColorTool('control-flow-tab-active-bg', isDarkTheme.value);
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
      if (this.level === 'overview') return false;
      const [width] = this.getSize(attributes);
      const topY = -this.getSize(attributes)[1] / 2 + 25; // 顶部 Y 坐标（基于节点中心）
      const fillColor = getThemeColorTool('control-flow-sidebar-tree-main-label', isDarkTheme.value);
      const isPointer = this.nodeData.data.source.meta.passes.length !== 0;
      return {
        x: -width / 2 + 35, // 左内边距 20px
        y: topY,
        text: this.cardData.name,
        fontSize: 14,
        fill: fillColor, // 原文本色
        fontWeight: 700,
        cursor: isPointer ? 'pointer' : '',
      };
    }
    getPathUnderLineStyle(attributes: RectStyleProps & BaseCustomElementStyleProps, lineWidth: number) {
      if (this.level === 'overview') return false;
      if (this.nodeData.data.source.meta.passes.length === 0) return false;
      const [width] = this.getSize(attributes);
      const fillColor = getThemeColorTool('devui-category-search-dropdown-item-bg', isDarkTheme.value);
      const topY = -this.getSize(attributes)[1] / 2 + 25; // 顶部 Y 坐标（基于节点中心）
      const states = this.nodeData.states;
      let opacity = 0;
      if (states && (states.includes('path-label') || states.includes('path-icon-left'))) {
        opacity = 1;
      }
      return {
        x: -width / 2 + 35,
        y: topY,
        width: lineWidth,
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
      if (this.level === 'overview') return false;
      if (this.nodeData.data.source.meta.passes.length === 0) return false;
      const [width] = this.getSize(attributes);
      const topY = -this.getSize(attributes)[1] / 2;
      const iconPath = isDarkTheme.value ? iconPathRight.value : iconPathRightLight.value;

      return {
        x: width / 2 - 30,
        y: topY + 6,
        width: 20,
        height: 20,
        src: iconPath,
        cursor: 'pointer',
        opacity: 1,
      };
    }

    getLeftIconStyle(attributes: RectStyleProps & BaseCustomElementStyleProps) {
      if (this.level === 'overview') return false;
      const [width] = this.getSize(attributes);
      const topY = -this.getSize(attributes)[1] / 2;
      const iconPath = isDarkTheme.value ? iconPathLeft.value : iconPathLeftLight.value;
      const isPointer = this.nodeData.data.source.meta.passes.length !== 0;
      return {
        x: -width / 2 + 10,
        y: topY + 6,
        width: 20,
        height: 20,
        src: iconPath,
        cursor: isPointer ? 'pointer' : '',
      };
    }

    /**
     * 打开图
     */
    openGraph() {
      if (this.nodeData.data.source.meta.passes.length === 0) return false;
      const length = this.nodeData.data.source.meta?.passes.length;
      openComputeGraph({
        outputPath: outPutPath.value as string,
        computeGraphPath: this.nodeData.data.source.meta?.passes[length - 1].graphFilePath,
        pathName: this.nodeData.data.source.meta?.passes[length - 1].pathName,
      });
    }

    /**
     * 绘制路径容器（名称 + 图标）
     */
    drawPathContainer(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
      // 绘制路径名称
      const text = this.upsert('path-label', 'text', this.getPathLabelStyle(attributes), container);
      if (this.level === 'overview') return;
      const { width } = text?.getBBox(); // 获取文本宽度

      this.upsert('path-line', 'rect', this.getPathUnderLineStyle(attributes, width), container);

      if (text && !text.__clickBound) {
        // 绘制下划线
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
      if (rightIcon && !rightIcon.__clickBound) {
        rightIcon.addEventListener('click', (e) => {
          // 阻止事件冒泡，避免触发节点的点击事件
          e.stopPropagation();
          sideBarRef.value.transFormPanelData(this.nodeData, outPutPath.value, 2);
          // 执行业务逻辑
          // 如果数据中有回调函数，则调用
          if (typeof attributes.onButtonClick === 'function') {
            attributes.onButtonClick(this.id, this.data);
          }
        });
        rightIcon.__clickBound = true; // 标记已绑定事件，避免重复绑定
      }

      // 左侧按钮打开计算图
      if (leftIcon && !leftIcon.__clickBound && this.nodeData.data.source.meta.passes.length !== 0) {
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
      if (this.level === 'overview') return false;
      const [width] = this.getSize(attributes);
      const fillColor = getThemeColorTool('control-flow-path-left-label', isDarkTheme.value);

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
      if (this.level === 'overview') return false;
      const [width] = this.getSize(attributes);
      const fillColor = getThemeColorTool('control-flow-path-right-value', isDarkTheme.value);

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
      if (this.level === 'overview') return false;
      type: className;
      const [width] = this.getSize(attributes);
      let fillColor = getThemeColorTool('devui-secondary-button-bg', isDarkTheme.value);
      const states = this.nodeData.states;
      let opacity = 0;
      if (states && states.includes(className)) {
        fillColor = getThemeColorTool('control-flow-path-hover', isDarkTheme.value);
        opacity = 0.2;
      }

      return {
        x: -width / 2 + 8, // 左右内边距 8
        y,
        width: width - 16, // 分割线宽度 = 卡片宽 - 内边距
        height: 24,
        fill: fillColor,
        radius: 4,
        cursor: 'pointer',
        opacity,
      };
    }

    /**
     * 绘制函数统计项
     */
    drawFunctionStats(attributes: RectStyleProps & BaseCustomElementStyleProps, container: Group) {
      const { functionStats } = this.cardData;
      const startY = -this.getSize(attributes)[1] / 2 + 54; // 统计项起始 Y 坐标
      const stats = [
        { label: t('controlFlows.leafName'), value: functionStats.leafFunction },
        { label: t('controlFlows.calledFunctionPanelTitle'), value: functionStats.called },
        { label: t('controlFlows.callFunctionPanelTitle'), value: functionStats.callee },
      ];

      // 遍历绘制每个统计项（Label + Value）
      stats.forEach((item, index) => {
        const y = startY + index * 30; // 统计项间距 30px
        // 绘制 Label
        this.upsert(`func-label-${index}`, 'text', this.getFuncLabelStyle(attributes, y, item.label), container);
        // 绘制 Value
        this.upsert(`func-value-${index}`, 'text', this.getFuncValueStyle(attributes, y, item.value), container);
        // hover背景
        const funcBg = this.upsert(
          `func_bg_${index}`,
          'rect',
          this.getFuncLabelBgStyle(attributes, y - 12, container, `func_bg_${index}`),
          container,
        );

        if (funcBg && !funcBg.__clickBound) {
          funcBg.addEventListener('click', (e) => {
            const states = this.nodeData.states;
            const index = states.includes('func_bg_2') ? 1 : 0;
            // 阻止事件冒泡，避免触发节点的点击事件
            e.stopPropagation();
            sideBarRef.value.transFormPanelData(this.nodeData, outPutPath.value, index);
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
      const fillColor = getThemeColorTool('devui-status-error-text', isDarkTheme.value);

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
      const { errorStats } = this.cardData;
      if (!errorStats || Object.keys(errorStats).length === 0) return;

      // 1. 错误统计前的分割线
      const funcEndY = -this.getSize(attributes)[1] / 2 + 56 + 2 * 30; // 函数统计项结束 Y 坐标
      this.drawSeparator(attributes, funcEndY + 20, container);
    }

    getHoleStyle(attributes) {
      if (this.level === 'overview') return false;
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
    render(attributes = this.parsedAttributes, container: Group | undefined) {
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

  // 计算缩放等级用于隐藏细节
  class LevelOfDetail extends BaseBehavior {
    prevLevel = DEFAULT_LEVEL;
    levels = {
      ['overview']: [0, 0.3],
      ['detailed']: [0.3, Infinity],
    };

    constructor(context, options) {
      super(context, options);
      this.bindEvents();
    }

    update(options) {
      this.unbindEvents();
      super.update(options);
      this.bindEvents();
    }

    updateZoomLevel = async (e) => {
      const { graph } = this.context;
      if (e.data && 'scale' in e.data) {
        const scale = e.data.scale;
        const level = Object.entries(this.levels).find(([key, [min, max]]) => scale > min && scale <= max)?.[0];
        if (level && this.prevLevel !== level) {
          graph.updateNodeData((prev) => prev.map((node) => ({ ...node, data: { ...node.data, level } })));
          this.prevLevel = level;
        }
        await graph.draw();
      }
    };

    bindEvents() {
      const { graph } = this.context;
      graph.on(GraphEvent.AFTER_TRANSFORM, this.updateZoomLevel);
    }

    unbindEvents() {
      const { graph } = this.context;
      graph.off(CanvasEvent.WHEEL, this.updateZoomLevel);
    }

    destroy() {
      this.unbindEvents();
      super.destroy();
    }
  }

  return {
    PathCardNodes,
    LevelOfDetail,
  };
}
