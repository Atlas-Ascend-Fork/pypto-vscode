/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { Ref, ref } from 'vue';
import { RectCombo, RectComboStyleProps, subStyleProps } from '@antv/g6';
import { CombsType, PreviewState } from '@/components/controlFlowGraph/type/node-detail-types';
import { getThemeColorTool } from '@/components/controlFlowGraph/util/getTheme';

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
  const DEFAULT_LEVEL = 'detailed';
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
  // 自定义组合
  class LogoWithRectCombo extends RectCombo {
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

    async drawButton(attributes) {
      const [width, height] = this.getKeySize(attributes);
      const y = -height / 2;
      const x = -width / 2 + 10;
      const states = this.nodeData.states;
      let isSelected = false;
      let isActived = false;
      let isHidden = false;
      let isCodeViewHover = false;
      if (states && states.length > 0) {
        isSelected = states.includes('selected'); //是否被选中
        isHidden = states.includes('comboHidden'); //是否隐藏
        isCodeViewHover = states.includes('code-view-svg'); //鼠标悬浮右侧图标
        isActived = states.includes('active') && !isCodeViewHover; //鼠标悬浮右侧图标的时候文字不变色
      }

      const buttonBlue = getThemeColorTool('control-flow-loop-title-bg-active', isDarkTheme.value);
      const buttonWeak = getThemeColorTool('control-flow-loop-title-bg-weak', isDarkTheme.value);
      const textBlue = getThemeColorTool('control-flow-loop-title-text-hover', isDarkTheme.value);
      const textWeak = getThemeColorTool('control-flow-loop-title-text', isDarkTheme.value);

      let loopLeftIcon = isDarkTheme.value ? loopLeftSvg.value : loopLeftSvgLight.value;
      let codeViewIcon = isDarkTheme.value ? codeViewIconSvg.value : codeViewIconSvgLight.value;
      let isActivedTextColor = isActived ? textBlue : textWeak;
      let isSelectedHitAreaColor = isSelected ? buttonBlue : buttonWeak;
      let isHasTargetFile = this.nodeData.data.sourceCode.filePath !== '';

      if (isSelected) {
        isActivedTextColor = '#FFFFFF'; //深色、浅色，loop选中时title颜色一致
        loopLeftIcon = loopLeftSvg.value;
        codeViewIcon = codeViewIconSvg.value;
      }
      if (isCodeViewHover) {
        codeViewIcon = codeViewIconSvgHover.value;
      }
      const isSmall = this.scales < 0.5;
      let isShowAll = this.nodeData?.combo === undefined;
      let rightIcon;
      if (isSmall) {
        if (isSelected) {
          isShowAll = true;
        }
        if (isHidden) isShowAll = false;
        // 缩放计算系数
        const scalingFactor = 0.5 / this.scales;
        // loop标签背景色板
        this.upsert(
          'hit-area',
          'rect',
          this.getSmallLoopTitleBG(x, y, isSelectedHitAreaColor, isShowAll, scalingFactor, isHasTargetFile),
          this,
        );
        // loop标签左图片
        this.upsert('left-svg', 'image', this.getSmallLoopLeftIcon(x, y, loopLeftIcon, scalingFactor), this);
        // loop标签文本
        this.upsert('loop-text', 'text', this.getSmallLoopText(x, y, isActivedTextColor, isShowAll, scalingFactor), this);
        if (isHasTargetFile) {
          // loop标签右图片打开代码预览
          rightIcon = this.upsert('code-view-svg', 'image', this.getSmallLoopRightIcon(x, y, codeViewIcon, scalingFactor, isShowAll), this);
        }
      } else {
        // loop标签左图片
        this.upsert(
          'left-svg',
          'image',
          {
            y: y - 8,
            x: x + 10,
            width: 20,
            height: 20,
            src: loopLeftIcon,
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
            fill: isActivedTextColor,
            fontSize: 16,
          },
          this,
        );
        const { width: textWidth } = text?.getBBox(); // 获取文本宽度
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
              src: codeViewIcon,
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
            fill: isSelectedHitAreaColor,
          },
          this,
        );
      }

      if (rightIcon && !rightIcon.__clickBound) {
        // 绘制下划线
        rightIcon.addEventListener('click', (e) => {
          // 阻止事件冒泡，避免触发节点的点击事件
          e.stopPropagation();
          handleShowPreview(e, this.nodeData);
          // 如果数据中有回调函数，则调用
          if (typeof attributes.onButtonClick === 'function') {
            attributes.onButtonClick(this.id, this.data);
          }
        });
        rightIcon.__clickBound = true; // 标记已绑定事件，避免重复绑定
      }
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
