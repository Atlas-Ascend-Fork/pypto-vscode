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
import { Rect, type RectStyleProps } from '@antv/g6';
import type { BaseCustomElementStyleProps, Group } from '@antv/g-lite';
import { PathCardData } from '@/components/controlFlowGraph/type/node-detail-types';
import { useI18n } from 'vue-i18n';
import { openComputeGraph } from '@/apis/opener';
import {
  getCardBaseStyle,
  getPathLabelStyle,
  getPathUnderLineStyle,
  getRightIconStyle,
  getLeftIconStyle,
  getSeparatorStyle,
  getFuncLabelStyle,
  getFuncValueStyle,
  getFuncLabelBgStyle,
  getHoleStyle,
  type TagConfig,
  type PathCardContext,
} from './pathCardNodeStyles';

type Attrs = RectStyleProps & BaseCustomElementStyleProps;
const DEFAULT_LEVEL = 'detailed';

// 自定义节点类（继承 Rect）,path节点 — 定义在模块作用域以降低 usePathCardNodes 圈复杂度
class PathCardNodes extends Rect {
  static ctx: PathCardContext;

  get nodeData() {
    return this.context.graph.getNodeData(this.id) as { data?: PathCardData };
  }

  get level() {
    return this.data?.level || DEFAULT_LEVEL;
  }

  get cardData(): Required<PathCardData> {
    const rawData = this.nodeData.data;
    return {
      name: rawData.name || 'PATH',
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

  /** 构建 StyleContext 供样式函数使用 */
  getStyleCtx(attributes: Attrs) {
    const c = PathCardNodes.ctx;
    return {
      size: this.getSize(attributes),
      isDark: c.isDarkTheme.value,
      level: this.level,
      states: this.context.graph.getElementState(this.id),
      nodeStates: this.nodeData.states || [],
      hasPasses: this.nodeData.data.source.meta.passes.length !== 0,
      iconPathLeft: c.iconPathLeft,
      iconPathLeftLight: c.iconPathLeftLight,
      iconPathRight: c.iconPathRight,
      iconPathRightLight: c.iconPathRightLight,
    };
  }

  /** 打开图 */
  async openGraph(passIndex?) {
    if (this.nodeData.data.source.meta.passes.length === 0) return false;
    const c = PathCardNodes.ctx;
    const length = this.nodeData.data.source.meta?.passes.length;
    const index = Number(passIndex ? passIndex : length - 1);
    openComputeGraph({
      outputPath: c.outPutPath.value as string,
      computeGraphPath: this.nodeData.data.source.meta?.passes[index].graphFilePath,
      pathName: this.nodeData.data.source.meta?.passes[length - 1].pathName,
      fileType: 'brief',
      computeGraphDirPath: c.computeGraphDirPath?.value,
      flowVerifyPath: c.flowVerifyPath?.value,
    });
  }

  /** 绘制路径容器（名称 + 图标） */
  drawPathContainer(attributes: Attrs, container: Group) {
    const ctx = this.getStyleCtx(attributes);
    const text = this.upsert('path-label', 'text', getPathLabelStyle(ctx, this.cardData.name), container);
    if (this.level === 'overview') return;
    const { width } = text?.getBBox();
    this.upsert('path-line', 'rect', getPathUnderLineStyle(ctx, width), container);
    if (text && !text.__clickBound) {
      text.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openGraph();
        this.invokeCallback(attributes);
      });
      text.__clickBound = true;
    }
  }

  drawRightIconContainer(attributes: Attrs, container: Group) {
    const c = PathCardNodes.ctx;
    const ctx = this.getStyleCtx(attributes);
    const leftIcon = this.upsert('path-icon-left', 'image', getLeftIconStyle(ctx), container);
    const rightIcon = this.upsert('path-icon-right', 'image', getRightIconStyle(ctx), container);
    if (rightIcon && !rightIcon.__clickBound) {
      rightIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        c.sideBarRef.value.transFormPanelData(
          this.nodeData, c.outPutPath.value, 2, c.computeGraphDirPath?.value, c.flowVerifyPath?.value,
        );
        this.invokeCallback(attributes);
      });
      rightIcon.__clickBound = true;
    }
    if (leftIcon && !leftIcon.__clickBound && this.nodeData.data.source.meta.passes.length !== 0) {
      leftIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openGraph();
        this.invokeCallback(attributes);
      });
      leftIcon.__clickBound = true;
    }
  }

  /** 绘制分割线 */
  drawSeparator(attributes: Attrs, y: number, container: Group) {
    const ctx = this.getStyleCtx(attributes);
    this.upsert(`separator-${y}`, 'rect', getSeparatorStyle(ctx, y), container);
  }

  /** 绘制函数统计项 */
  drawFunctionStats(attributes: Attrs, container: Group) {
    const c = PathCardNodes.ctx;
    const { functionStats } = this.cardData;
    const ctx = this.getStyleCtx(attributes);
    const startY = -ctx.size[1] / 2 + 54;
    const stats = [
      { label: c.t('controlFlows.leafName'), value: functionStats.leafFunction },
      { label: c.t('controlFlows.calledFunctionPanelTitle'), value: functionStats.called },
      { label: c.t('controlFlows.callFunctionPanelTitle'), value: functionStats.callee },
    ];
    stats.forEach((item, index) => {
      const y = startY + index * 30;
      this.upsert(`func-label-${index}`, 'text', getFuncLabelStyle(ctx, y, item.label), container);
      this.upsert(`func-value-${index}`, 'text', getFuncValueStyle(ctx, y, item.value), container);
      const funcBg = this.upsert(
        `func_bg_${index}`, 'rect', getFuncLabelBgStyle(ctx, y - 12, `func_bg_${index}`), container,
      );
      if (funcBg && !funcBg.__clickBound) {
        funcBg.addEventListener('click', (e) => {
          const states = this.nodeData.states;
          const idx = states.includes('func_bg_2') ? 1 : 0;
          e.stopPropagation();
          c.sideBarRef.value.transFormPanelData(
            this.nodeData, c.outPutPath.value, idx, c.computeGraphDirPath?.value, c.flowVerifyPath?.value,
          );
          this.invokeCallback(attributes);
        });
        funcBg.__clickBound = true;
      }
    });
  }

  /** 绘制错误统计项（有 errorStats 时才绘制） */
  async drawErrorStats(attributes: Attrs, container: Group) {
    const { errorStats } = this.cardData;
    if (!errorStats || Object.keys(errorStats).length === 0) return;
    const funcEndY = -this.getSize(attributes)[1] / 2 + 56 + 2 * 30;
    this.drawSeparator(attributes, funcEndY + 20, container);
  }

  drawHoleShape(attributes, container) {
    const ctx = this.getStyleCtx(attributes);
    this.upsert('hole', 'rect', getHoleStyle(ctx), container);
  }

  /** 通用状态标签绘制 */
  drawStatusTag(attributes: Attrs, container: Group, config: TagConfig) {
    const c = PathCardNodes.ctx;
    const states = this.context.graph.getElementState(this.id);
    if (!states || !states.includes(config.stateKey)) {
      this.upsert(config.bgId, 'rect', false, container);
      this.upsert(config.textId, 'rect', false, container);
      return;
    }
    const currentLanguage = (window as any).ascLang;
    const [width] = this.getSize(attributes);
    const topY = -this.getSize(attributes)[1] / 2 - 20;
    const tagWidth = { zh: 69, en: 95 };
    const tagHeight = 24;
    const hasExceptionTag = states.includes('first-exception');
    const yOffset = config.yOffsetFn(hasExceptionTag, tagHeight);
    const tw = tagWidth[currentLanguage] || 95;
    const tagBg = this.upsert(config.bgId, 'rect', {
      x: width / 2 + 4, y: topY + yOffset, width: tw, height: tagHeight,
      fill: config.color, radius: 4, cursor: 'pointer', pointerEvents: 'all',
    }, container);
    const tagText = this.upsert(config.textId, 'text', {
      x: width / 2 + tw / 2 + 4, y: topY + yOffset + tagHeight / 2,
      text: c.t(config.labelKey), fontSize: 12, fill: '#fff',
      textBaseline: 'middle', textAlign: 'center', cursor: 'pointer', pointerEvents: 'all',
    }, container);
    const handleTagClick = (e) => {
      e.stopPropagation();
      this.openGraph(c.tagPass.value);
      this.invokeCallback(attributes);
    };
    if (tagBg && !tagBg.__clickBound) {
      tagBg.addEventListener('click', handleTagClick);
      tagBg.__clickBound = true;
    }
    if (tagText && !tagText.__clickBound) {
      tagText.addEventListener('click', handleTagClick);
      tagText.__clickBound = true;
    }
  }

  drawFirstFailTag(attributes: Attrs, container: Group) {
    this.drawStatusTag(attributes, container, {
      stateKey: 'first-fail', bgId: 'first-fail-tag-bg', textId: 'first-fail-tag-text',
      color: '#F69E39', labelKey: 'controlFlows.firstErrorPath',
      yOffsetFn: (hasExceptionTag, tagHeight) => hasExceptionTag ? tagHeight * 2 + 4 : tagHeight,
    });
  }

  drawFirstExceptionTag(attributes: Attrs, container: Group) {
    this.drawStatusTag(attributes, container, {
      stateKey: 'first-exception', bgId: 'first-exception-tag-bg', textId: 'first-exception-tag-text',
      color: '#D94838', labelKey: 'controlFlows.firstExcPath',
      yOffsetFn: (_hasExceptionTag, tagHeight) => tagHeight,
    });
  }

  /** 触发 onButtonClick 回调 */
  invokeCallback(attributes: Attrs) {
    if (typeof attributes.onButtonClick === 'function') {
      attributes.onButtonClick(this.id, this.data);
    }
  }

  /** 核心渲染方法 */
  render(attributes = this.parsedAttributes, container: Group | undefined) {
    const ctx = this.getStyleCtx(attributes);
    const mergedAttrs = { ...attributes, ...getCardBaseStyle(ctx) };
    super.render(mergedAttrs, container);
    this.drawHoleShape(mergedAttrs, container);
    this.drawPathContainer(mergedAttrs, container);
    this.drawRightIconContainer(mergedAttrs, container);
    this.drawFunctionStats(mergedAttrs, container);
    this.drawErrorStats(mergedAttrs, container);
    this.drawFirstFailTag(mergedAttrs, container);
    this.drawFirstExceptionTag(mergedAttrs, container);
  }
}

/**
 * 自定义path卡片hook函数
 * @param sideBarRef 右侧抽屉
 * @param outPutPath 用于打开计算图
 * @param computeGraphDirPath 计算图目录路径
 * @param flowVerifyPath 精度工具文件路径
 */
export function usePathCardNodes(sideBarRef, outPutPath, isDarkTheme, tagPass, computeGraphDirPath?, flowVerifyPath?) {
  const { t } = useI18n();
  PathCardNodes.ctx = {
    t,
    sideBarRef,
    outPutPath,
    isDarkTheme,
    tagPass,
    computeGraphDirPath,
    flowVerifyPath,
    iconPathLeft: `${window.staticPath}/static-assets/control_flow_path_left.svg`,
    iconPathLeftLight: `${window.staticPath}/static-assets/control_flow_path_left-light.svg`,
    iconPathRight: `${window.staticPath}/static-assets/control_flow_path_right.svg`,
    iconPathRightLight: `${window.staticPath}/static-assets/control_flow_path_right-light.svg`,
  };
  return { PathCardNodes };
}
