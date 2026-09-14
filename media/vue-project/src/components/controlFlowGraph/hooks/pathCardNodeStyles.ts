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
import { getThemeColorTool } from '@/components/controlFlowGraph/util/getTheme';

export interface StyleContext {
  size: [number, number];
  isDark: boolean;
  level: string;
  states: string[];
  nodeStates: string[];
  hasPasses: boolean;
  iconPathLeft: string;
  iconPathLeftLight: string;
  iconPathRight: string;
  iconPathRightLight: string;
}

/** PathCardNodes 的运行时上下文，由 usePathCardNodes 注入到静态属性 */
export interface PathCardContext {
  t: (key: string) => string;
  sideBarRef: any;
  outPutPath: any;
  isDarkTheme: { value: boolean };
  tagPass: { value: number };
  computeGraphDirPath?: { value: string };
  flowVerifyPath?: { value: string };
  iconPathLeft: string;
  iconPathLeftLight: string;
  iconPathRight: string;
  iconPathRightLight: string;
}

/** 基础卡片样式 */
export function getCardBaseStyle(ctx: StyleContext) {
  const [width, height] = ctx.size;
  const fillColor = getThemeColorTool('control-flow-tab-active-bg', ctx.isDark);
  const statusColors: Record<string, string> = {
    'highlight-PASS': '#87c859',
    'highlight-FAIL': '#f69e39',
    'highlight-EXCEPTION': '#D94838',
  };
  let strokeColor = 'transparent';
  let lineWidth = 0;
  for (const state of ctx.states) {
    if (statusColors[state]) {
      strokeColor = statusColors[state];
      lineWidth = 3;
      break;
    }
  }
  return { width, height, fill: fillColor, radius: 8, stroke: strokeColor, lineWidth };
}

/** 路径名称样式 */
export function getPathLabelStyle(ctx: StyleContext, name: string) {
  if (ctx.level === 'overview') return false;
  const [width, height] = ctx.size;
  const topY = -height / 2 + 25;
  const fillColor = getThemeColorTool('control-flow-sidebar-tree-main-label', ctx.isDark);
  return {
    x: -width / 2 + 35,
    y: topY,
    text: name,
    fontSize: 14,
    fill: fillColor,
    fontWeight: 700,
    cursor: ctx.hasPasses ? 'pointer' : '',
  };
}

/** 路径名称下划线样式 */
export function getPathUnderLineStyle(ctx: StyleContext, textWidth: number) {
  if (ctx.level === 'overview') return false;
  if (!ctx.hasPasses) return false;
  const [width, height] = ctx.size;
  const fillColor = getThemeColorTool('control-flow-sidebar-tree-main-label', ctx.isDark);
  const topY = -height / 2 + 21;
  let opacity = 0;
  if (ctx.nodeStates.includes('path-label') || ctx.nodeStates.includes('path-icon-left')) {
    opacity = 1;
  }
  return { x: -width / 2 + 35, y: topY, width: textWidth, height: 1, fontWeight: 700, fill: fillColor, opacity };
}

/** 右侧图标样式 */
export function getRightIconStyle(ctx: StyleContext) {
  if (ctx.level === 'overview') return false;
  if (!ctx.hasPasses) return false;
  const [width, height] = ctx.size;
  const iconPath = ctx.isDark ? ctx.iconPathRight : ctx.iconPathRightLight;
  return { x: width / 2 - 30, y: -height / 2 + 6, width: 20, height: 20, src: iconPath, cursor: 'pointer', opacity: 1 };
}

/** 左侧图标样式 */
export function getLeftIconStyle(ctx: StyleContext) {
  if (ctx.level === 'overview') return false;
  const [width, height] = ctx.size;
  const iconPath = ctx.isDark ? ctx.iconPathLeft : ctx.iconPathLeftLight;
  return {
    x: -width / 2 + 10,
    y: -height / 2 + 6,
    width: 20,
    height: 20,
    src: iconPath,
    cursor: ctx.hasPasses ? 'pointer' : '',
  };
}

/** 分割线样式 */
export function getSeparatorStyle(ctx: StyleContext, y: number) {
  const [width] = ctx.size;
  const fillColor = ctx.isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0,0,0,0.1)';
  return { x: -width / 2 + 20, y, width: width - 40, height: 1, fill: fillColor };
}

/** 函数统计项 Label 样式 */
export function getFuncLabelStyle(ctx: StyleContext, y: number, label: string) {
  if (ctx.level === 'overview') return false;
  const [width] = ctx.size;
  const fillColor = getThemeColorTool('control-flow-path-left-label', ctx.isDark);
  return { x: -width / 2 + 12, y, text: label, fontSize: 12, fill: fillColor, textAlign: 'left', textBaseline: 'middle' };
}

/** 函数统计项 Value 样式 */
export function getFuncValueStyle(ctx: StyleContext, y: number, value: number) {
  if (ctx.level === 'overview') return false;
  const [width] = ctx.size;
  const fillColor = getThemeColorTool('control-flow-path-right-value', ctx.isDark);
  return { x: width / 2 - 20, y, text: value.toString(), fontSize: 14, fill: fillColor, textAlign: 'right', textBaseline: 'middle' };
}

/** 函数统计项背景样式 */
export function getFuncLabelBgStyle(ctx: StyleContext, y: number, className: string) {
  if (ctx.level === 'overview') return false;
  const [width] = ctx.size;
  let fillColor = getThemeColorTool('devui-secondary-button-bg', ctx.isDark);
  let opacity = 0;
  if (ctx.nodeStates.includes(className)) {
    fillColor = getThemeColorTool('control-flow-path-hover', ctx.isDark);
    opacity = 0.2;
  }
  return { x: -width / 2 + 8, y, width: width - 16, height: 24, fill: fillColor, radius: 4, cursor: 'pointer', opacity };
}

/** 错误统计项 Value 样式 */
export function getErrorValueStyle(ctx: StyleContext, y: number, value: number) {
  const [width] = ctx.size;
  const fillColor = getThemeColorTool('devui-status-error-text', ctx.isDark);
  return { x: width / 2 - 20, y, text: value.toString(), fontSize: 16, fill: fillColor, textAlign: 'right', textBaseline: 'middle' };
}

/** 孔洞形状样式 */
export function getHoleStyle(ctx: StyleContext) {
  if (ctx.level === 'overview') return false;
  const [width, height] = ctx.size;
  const fillColor = ctx.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)';
  return { x: -width / 2, y: -height / 2, radius: '8 8 0 0', width, height: 32, fill: fillColor };
}

/** 状态标签的通用配置 */
export interface TagConfig {
  stateKey: string;
  bgId: string;
  textId: string;
  color: string;
  labelKey: string;
  yOffsetFn: (hasExceptionTag: boolean, tagHeight: number) => number;
}
