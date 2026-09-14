/**
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
 */
import { Ref, ref } from 'vue';
import { RectCombo, RectComboStyleProps, subStyleProps } from '@antv/g6';
import { CombsType, PreviewState } from '@/components/controlFlowGraph/type/node-detail-types';
import { getThemeColorTool } from '@/components/controlFlowGraph/util/getTheme';

interface ComboDependencies {
  isDarkTheme: Ref<boolean>;
  loopLeftSvg: Ref<string>;
  loopLeftSvgLight: Ref<string>;
  codeViewIconSvg: Ref<string>;
  codeViewIconSvgLight: Ref<string>;
  codeViewIconSvgHover: Ref<string>;
  handleShowPreview: (e: any, nodeData: CombsType) => void;
}

interface ComboNodeStates {
  isSelected: boolean;
  isActived: boolean;
  isHidden: boolean;
  isCodeViewHover: boolean;
}

interface ComboStyleConfig {
  loopLeftIcon: string;
  codeViewIcon: string;
  isActivedTextColor: string;
  isSelectedHitAreaColor: string;
}

const DEFAULT_LEVEL = 'detailed';

function resolveComboStates(states: string[] | undefined): ComboNodeStates {
  if (!states || states.length === 0) {
    return { isSelected: false, isActived: false, isHidden: false, isCodeViewHover: false };
  }
  const isCodeViewHover = states.includes('code-view-svg');
  return {
    isSelected: states.includes('selected'),
    isActived: states.includes('active') && !isCodeViewHover,
    isHidden: states.includes('comboHidden'),
    isCodeViewHover,
  };
}

function resolveComboStyle(nodeStates: ComboNodeStates, isDarkTheme: boolean, deps: ComboDependencies): ComboStyleConfig {
  const buttonBlue = getThemeColorTool('control-flow-loop-title-bg-active', isDarkTheme);
  const buttonWeak = getThemeColorTool('control-flow-loop-title-bg-weak', isDarkTheme);
  const textBlue = getThemeColorTool('control-flow-loop-title-text-hover', isDarkTheme);
  const textWeak = getThemeColorTool('control-flow-loop-title-text', isDarkTheme);

  let loopLeftIcon = isDarkTheme ? deps.loopLeftSvg.value : deps.loopLeftSvgLight.value;
  let codeViewIcon = isDarkTheme ? deps.codeViewIconSvg.value : deps.codeViewIconSvgLight.value;
  let isActivedTextColor = nodeStates.isActived ? textBlue : textWeak;
  let isSelectedHitAreaColor = nodeStates.isSelected ? buttonBlue : buttonWeak;

  if (nodeStates.isSelected) {
    isActivedTextColor = '#FFFFFF'; //深色、浅色，loop选中时title颜色一致
    loopLeftIcon = deps.loopLeftSvg.value;
    codeViewIcon = deps.codeViewIconSvg.value;
  }
  if (nodeStates.isCodeViewHover) {
    codeViewIcon = deps.codeViewIconSvgHover.value;
  }

  return { loopLeftIcon, codeViewIcon, isActivedTextColor, isSelectedHitAreaColor };
}

// 自定义组合
class LogoWithRectCombo extends RectCombo {
  static deps: ComboDependencies;

  /**
   *  获取节点原始数据
   */
  get nodeData() {
    return this.context.graph.getNodeData(this.id) as CombsType;
  }

  get level() {
    return this.data.level || DEFAULT_LEVEL;
  }
  get scales() {
    return Math.round(this.data.scale * 100) / 100 || 0.3;
  }
  get data() {
    return this.nodeData.data;
  }

  getSmallLoopTitleBG(x, y, isSelectedHitAreaColor, isShowAll, scalingFactor, isHasTargetFile) {
    const baseWidth = isHasTargetFile ? 50 + this.id.length * 10.3 : 20 + this.id.length * 10.3;
    return {
      y: y - 15,
      x,
      width: isShowAll ? baseWidth * scalingFactor : 40 * scalingFactor,
      height: 32 * scalingFactor,
      radius: 8,
      fill: isSelectedHitAreaColor,
    };
  }
  getSmallLoopLeftIcon(x, y, loopLeftIcon, scalingFactor) {
    return {
      y: y - 20 * this.scales + (this.scales < 0.04 ? 100 : 20 * (0.5 - this.scales)),
      x: x + 10 * scalingFactor,
      width: 20 * scalingFactor,
      height: 20 * scalingFactor,
      src: loopLeftIcon,
    };
  }
  getSmallLoopRightIcon(x, y, loopRightIcon, scalingFactor, isNotShow) {
    if (!isNotShow) return false;
    return {
      y: y - 20 * this.scales + (this.scales < 0.04 ? 100 : 20 * (0.5 - this.scales)),
      x: x + (50 + this.id.length * 10.3) * scalingFactor - 30 * scalingFactor,
      width: 20 * scalingFactor,
      height: 20 * scalingFactor,
      src: loopRightIcon,
    };
  }
  getSmallLoopText(x, y, isActivedTextColor, isNotShow, scalingFactor) {
    if (!isNotShow) return false;
    return {
      y: y + 12 * ((1 - this.scales) / this.scales),
      x: x + 35 * scalingFactor,
      text: this.id,
      fill: isActivedTextColor,
      fontSize: 16 * scalingFactor,
    };
  }

  drawSmallScaleCombo(x, y, nodeStates: ComboNodeStates, styleConfig: ComboStyleConfig, isHasTargetFile: boolean) {
    let isShowAll = this.nodeData?.combo === undefined;
    if (nodeStates.isSelected) {
      isShowAll = true;
    }
    if (nodeStates.isHidden) isShowAll = false;
    // 缩放计算系数
    const scalingFactor = 0.5 / this.scales;
    // loop标签背景色板
    this.upsert(
      'hit-area',
      'rect',
      this.getSmallLoopTitleBG(x, y, styleConfig.isSelectedHitAreaColor, isShowAll, scalingFactor, isHasTargetFile),
      this,
    );
    // loop标签左图片
    this.upsert('left-svg', 'image', this.getSmallLoopLeftIcon(x, y, styleConfig.loopLeftIcon, scalingFactor), this);
    // loop标签文本
    this.upsert('loop-text', 'text', this.getSmallLoopText(x, y, styleConfig.isActivedTextColor, isShowAll, scalingFactor), this);
    if (isHasTargetFile) {
      // loop标签右图片打开代码预览
      return this.upsert(
        'code-view-svg',
        'image',
        this.getSmallLoopRightIcon(x, y, styleConfig.codeViewIcon, scalingFactor, isShowAll),
        this,
      );
    }
    return undefined;
  }

  drawNormalScaleCombo(x, y, styleConfig: ComboStyleConfig, isHasTargetFile: boolean) {
    // loop标签左图片
    this.upsert(
      'left-svg',
      'image',
      {
        y: y - 8,
        x: x + 10,
        width: 20,
        height: 20,
        src: styleConfig.loopLeftIcon,
      },
      this,
    );
    // loop标签文本
    const text = this.upsert(
      'loop-text',
      'text',
      {
        y: y + 12,
        x: x + 35,
        text: this.id,
        fill: styleConfig.isActivedTextColor,
        fontSize: 16,
      },
      this,
    );
    const { width: textWidth } = text?.getBBox(); // 获取文本宽度
    let rightIcon;
    if (isHasTargetFile) {
      // loop标签右图片打开代码预览
      rightIcon = this.upsert(
        'code-view-svg',
        'image',
        {
          y: y - 8,
          x: x + 50 + textWidth,
          width: 20,
          height: 20,
          src: styleConfig.codeViewIcon,
        },
        this,
      );
    }
    // loop标签背景色板
    this.upsert(
      'hit-area',
      'rect',
      {
        y: y - 15,
        x,
        width: textWidth + (isHasTargetFile ? 80 : 50),
        height: 35,
        radius: 8,
        fill: styleConfig.isSelectedHitAreaColor,
      },
      this,
    );
    return rightIcon;
  }

  bindRightIconClick(rightIcon, attributes) {
    if (!rightIcon || rightIcon.__clickBound) return;
    // 绘制下划线
    rightIcon.addEventListener('click', (e) => {
      // 阻止事件冒泡，避免触发节点的点击事件
      e.stopPropagation();
      LogoWithRectCombo.deps.handleShowPreview(e, this.nodeData);
      // 如果数据中有回调函数，则调用
      if (typeof attributes.onButtonClick === 'function') {
        attributes.onButtonClick(this.id, this.data);
      }
    });
    rightIcon.__clickBound = true; // 标记已绑定事件，避免重复绑定
  }

  async drawButton(attributes) {
    const [width, height] = this.getKeySize(attributes);
    const y = -height / 2;
    const x = -width / 2 + 10;
    const nodeStates = resolveComboStates(this.nodeData.states);
    const styleConfig = resolveComboStyle(nodeStates, LogoWithRectCombo.deps.isDarkTheme.value, LogoWithRectCombo.deps);
    const isHasTargetFile = this.nodeData.data.sourceCode.filePath !== '';

    let rightIcon;
    if (this.scales < 0.5) {
      rightIcon = this.drawSmallScaleCombo(x, y, nodeStates, styleConfig, isHasTargetFile);
    } else {
      rightIcon = this.drawNormalScaleCombo(x, y, styleConfig, isHasTargetFile);
    }
    this.bindRightIconClick(rightIcon, attributes);
  }

  // 覆盖默认样式
  protected getKeyStyle(attributes: Required<RectComboStyleProps>) {
    const keyStyle = super.getKeyStyle(attributes);
    let [width, height] = this.getKeySize(attributes);

    if (keyStyle.childrenData[0].type !== 'path-card-node') width = width + 30;
    keyStyle.width = this.nodeData.comboWidth;
    return {
      ...keyStyle,
      ...(attributes.collapsed && subStyleProps(keyStyle, 'collapsed')),
      height,
      x: -width / 2,
      y: -height / 2,
      padding: 10,
    };
  }
  getBaseStyle() {
    return {
      pointerEvents: 'none',
    };
  }

  render(attributes, container) {
    const mergedAttrs = {
      ...attributes,
      ...this.getBaseStyle(),
    };
    super.render(mergedAttrs, container);
    this.drawButton(mergedAttrs);
  }
}

/**
 * 自定义组合节点hook函数
 * @param isDarkTheme 主题
 * @param codePreviewState  代码片段预览状态控制
 * @returns
 */
export function useComboCardNodes(isDarkTheme: Ref<boolean>, codePreviewState: PreviewState) {
  const loopLeftSvg = ref(`${window.staticPath}/static-assets/loop.svg`);
  const loopLeftSvgLight = ref(`${window.staticPath}/static-assets/loop-light.svg`);
  const codeViewIconSvg = ref(`${window.staticPath}/static-assets/control_flow_code.svg`);
  const codeViewIconSvgLight = ref(`${window.staticPath}/static-assets/control_flow_code-light.svg`);
  const codeViewIconSvgHover = ref(`${window.staticPath}/static-assets/control_flow_code-hover.svg`);
  // 显示预览窗口
  const handleShowPreview = (e, nodeData: CombsType) => {
    const data = nodeData.data;
    codePreviewState.x = e.viewport.x;
    codePreviewState.y = e.viewport.y;
    codePreviewState.isVisible = true;
    codePreviewState.fileDir = data.sourceCode.filePath ? data.sourceCode.filePath : '';
    codePreviewState.codeStartLine = data.sourceCode.startLine;
    codePreviewState.codeEndLine = data.sourceCode.endLine;
    codePreviewState.language = data.sourceCode.language;
    codePreviewState.line = data.sourceCode.line;
  };

  LogoWithRectCombo.deps = {
    isDarkTheme,
    loopLeftSvg,
    loopLeftSvgLight,
    codeViewIconSvg,
    codeViewIconSvgLight,
    codeViewIconSvgHover,
    handleShowPreview,
  };

  // 初始化配置对象
  const comboInitConfig = {
    type: 'combo-with-extra-button',
    style: {
      fill: 'rgba(255,255,255,0)',
      padding: 30,
      borderStyle: 'dashed',
      radius: 16,
      lineWidth: 1,
      lineDash: [6, 4],
      lineCap: 'round',
      stroke: () => getThemeColorTool('control-flow-loop-stroke', isDarkTheme.value),
    },
    state: {
      selected: {
        lineWidth: 2,
        fill: () => getThemeColorTool('devui-operation-text-hover', isDarkTheme.value),
        stroke: () => getThemeColorTool('devui-operation-text-hover', isDarkTheme.value),
        lineDash: [2, 1],
        lineCap: 'square',
        halo: false, // 启用光晕
        haloLineWidth: 0,
      },
      highlight: {
        lineWidth: 1,
        fill: () => getThemeColorTool('devui-operation-text-hover', isDarkTheme.value),
        stroke: () => getThemeColorTool('devui-operation-text-hover', isDarkTheme.value),
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
        halo: false, // 启用光晕
        haloLineWidth: 0,
      },
      disabled: {
        fill: '#ECECEC',
        stroke: '#BFBFBF',
        opacity: 0.5,
      },
    },
  };
  return {
    LogoWithRectCombo,
    comboInitConfig,
  };
}
