<!--
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 -->
<template>
  <!-- 遮罩层容器：管理所有遮罩和弹窗层级 -->
  <div v-if="visible" class="guide-mask-container" @pointerup.stop>
    <!-- 兜底全屏遮罩（始终覆盖视口，阻止操作） -->
    <div v-if="isShowFullFalBack" class="guide-mask-full-fallback" :style="maskFullFallbackStyle"></div>
    <!-- 第一层：全屏遮罩 合并后的包围盒区域（视觉上的整体矩形） -->
    <div class="guide-mask-full" @click.stop :style="maskFullClipStyle"></div>
    <div v-if="isShow">
      <!-- 第二层：包围盒内遮罩对指定DOM挖孔 -->
      <div class="guide-mask-inner" @click.stop :style="maskInnerStyle" @pointerup.stop></div>

      <!-- 合并后的视觉边框（单个包围盒边框） -->
      <div class="guide-target-border" :style="mergeTargetBorderStyle"></div>

      <!-- 引导弹窗（可点击） -->
      <div class="guide-popup-wrapper" :style="popupWrapperStyle">
        <!-- 引导三角：动态偏移样式 -->
        <div
          v-if="triangleConfig.showTriangle"
          class="guide-triangle"
          :class="`triangle-${triangleConfig.triangleDirection}`"
          :style="triangleOffsetStyle"
        ></div>
        <!-- 气泡弹窗容器-->
        <div class="guide-popup-content" ref="popupContentRef" :style="{ boxShadow: popupContentBoxShadow }">
          <!-- 顶部进度指示器 -->
          <div class="progress-container" v-if="graphType !== 'threeColumnGraph'">
            <template v-for="(group, groupIdx) in guideSteps" :key="groupIdx">
              <div class="progress-group">
                <img v-if="groupIdx <= currentBigGroup" :src="imgActiveArr[groupIdx].value" class="progress-img" />
                <img v-else :src="imgArr[groupIdx].value" class="progress-img" />
                <div
                  v-for="(step, stepIdx) in group.steps"
                  :key="stepIdx"
                  class="progress-dot"
                  :class="getDotItemStatus(groupIdx, stepIdx)"
                ></div>
              </div>
              <span v-if="groupIdx < guideSteps.length - 1" class="separator"></span>
            </template>
          </div>

          <!-- 主体内容区 -->
          <div class="content-container">
            <div class="container__header">
              <h3 class="step-title">{{ t(currentStepInfo.title) }}</h3>
              <div class="step-count__group">
                <p class="step-count">{{ currentSmallIndex + 1 }}</p>
                <p class="step-count__right">/{{ currentBigGroupSteps.length }}</p>
              </div>
            </div>
            <p class="step-content">{{ t(currentStepInfo.content) }}</p>
          </div>

          <!-- 操作按钮栏 -->
          <div class="btn-container">
            <button class="skip-btn" @click="handleSkipAll">{{ t('bootStep.button.skipAll') }}</button>
            <button v-if="hasPrevStep" class="prev-btn" @click="handlePrevStep">{{ t('bootStep.button.preStep') }}</button>
            <template v-if="hasNextBtn">
              <button class="next-btn" @click="handleNextStep">{{ nextBtnText }}</button>
            </template>
            <button v-else class="next-btn" @click="handleSkipAll">{{ t('bootStep.button.complete') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { completeResultsStep, completeTreeColumnStep, getWelcomeState, updateWelcomeState } from '@/apis/welcome';
import { computed, ref, watch, onMounted, nextTick, onUnmounted, inject } from 'vue';
import type { CSSProperties } from 'vue';
import {
  getCurrentStepConfig,
  getCurrentStepTargetDomId,
  getCurrentStepTriangleConfig,
  getNextBigGroupConfig,
  guideStepsConfigStep2,
  guideStepsConfigStep3,
  GuideTargetDomConfig,
} from '../guideStepsConfig';
import { request } from '@/core/request';
import { getQuery } from '@/core/query';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const { isDarkTheme } = inject('root');
const controlFlowImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_control_weak${isDarkTheme.value ? '' : '-light'}.svg`,
);
const nativeImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_native_weak${isDarkTheme.value ? '' : '-light'}.svg`,
);
const computeImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_compute_weak${isDarkTheme.value ? '' : '-light'}.svg`,
);
const swimImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_swim_weak${isDarkTheme.value ? '' : '-light'}.svg`,
);

const controlFlowActiveImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_control_active${isDarkTheme.value ? '' : '-light'}.svg`,
);
const nativeActiveImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_native_active${isDarkTheme.value ? '' : '-light'}.svg`,
);
const computeActiveImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_compute_active${isDarkTheme.value ? '' : '-light'}.svg`,
);
const swimActiveImg = computed(
  () => `${window.staticPath}/static-assets/boot_steps/boot_steps_swim_active${isDarkTheme.value ? '' : '-light'}.svg`,
);
const cursorNotAllowed = computed(() => `${window.staticPath}/static-assets/boot_steps/cursor_not_allowed.svg`);

const imgArr = ref([controlFlowImg, nativeImg, computeImg, swimImg]);
const imgActiveArr = ref([controlFlowActiveImg, nativeActiveImg, computeActiveImg, swimActiveImg]);

// 定义步骤类型
interface GuideStepItem {
  title: string;
  content: string;
  method?: string;
  methodParams?: Record<string, any>;
  targetDomConfigs: GuideTargetDomConfig[];
}
interface GuideBigGroup {
  groupName: string;
  steps: GuideStepItem[];
  imgUrl: string;
}

// 组件Props
const props = defineProps<{
  visible: boolean;
  guideSteps?: GuideBigGroup[];
  closeOnMaskClick?: boolean;
  width?: string;
  graphType: string;
}>();
const isShow = ref(true);
const isShowFullFalBack = ref(true);

// ========== 响应式触发变量（强制更新computed） ==========
const refreshTrigger = ref(0);
// 弹窗内容区Ref（用于精准获取尺寸）
const popupContentRef = ref<HTMLDivElement | null>(null);

/**
 * 防抖函数
 */
const debounce = (fn: Function, delay = 150) => {
  let timer: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// ========== 兜底全屏遮罩样式（始终覆盖视口） ==========
const maskFullFallbackStyle = computed<CSSProperties>(() => {
  return {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    zIndex: 1050,
    pointerEvents: 'auto', // 阻止所有
    transition: 'background-color 0.2s ease',
  };
});

// 三角配置
const triangleConfig = computed(() => {
  return getCurrentStepTriangleConfig(currentBigGroup.value, currentSmallIndex.value, props.graphType);
});

// ========== 获取当前步骤的所有目标DOM配置 ==========
const currentStepAllTargetDomConfigs = computed<GuideTargetDomConfig[]>(() => {
  const stepConfig = getCurrentStepConfig(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  return stepConfig?.targetDomConfigs || [];
});

// ========== 判断当前步骤是否允许点击目标DOM ==========
const isStepAllowClick = computed<boolean>(() => {
  const stepConfig = getCurrentStepConfig(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  const allowClick = stepConfig.allowClick;
  return allowClick;
});

// ========== 判断当前步骤是否渲染边框 ==========
const isShowBorder = computed<boolean>(() => {
  const stepConfig = getCurrentStepConfig(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  const isShowBorder = stepConfig.showBorder;
  return isShowBorder;
});

/**
 * 获取单个DOM的位置信息
 * @param domSelector - 可以是ID字符串 或 class字符串
 * @returns DOMRect对象 | null
 */
const getSingleDomRect = (domSelector: string): DOMRect | null => {
  if (!props.visible) return null;
  const targetDom = getTargetElement(domSelector);

  // 获取最新位置（强制重绘，确保实时性）
  if (targetDom) {
    targetDom.getBoundingClientRect(); // 强制重绘
    return targetDom.getBoundingClientRect();
  }
  return null;
};

/**
 * 通用DOM查找函数（优先ID，ID不存在则按class取第一个）
 * @param selector - ID或class字符串
 * @returns 匹配的DOM元素 | null
 */
const getTargetElement = (selector: string): HTMLElement | null => {
  if (!selector) return null;

  // 第一步：优先通过ID查找
  let targetDom = document.getElementById(selector);

  // 第二步：ID查找失败，尝试通过class查找第一个匹配元素
  if (!targetDom) {
    const classElements = document.getElementsByClassName(selector);
    if (classElements.length > 0) {
      targetDom = classElements[0] as HTMLElement;
    }
  }
  // 第三步：className查找失败，尝试通过选择器查找
  if (!targetDom) {
    targetDom = document.querySelector(selector);
  }
  // 第四步：未找到时打印警告
  if (!targetDom) {
    return null;
  }
  return targetDom;
};

// ========== 核心：计算多个DOM的最小包围矩形（合并挖孔用） ==========
const getMergeDomRect = (): DOMRect | null => {
  if (!props.visible || currentStepAllTargetDomConfigs.value.length === 0) return null;

  // 收集所有有效DOM的位置信息
  const validDomRects: DOMRect[] = [];
  currentStepAllTargetDomConfigs.value.forEach((config) => {
    const rect = getSingleDomRect(config.targetDomId);
    if (rect) validDomRects.push(rect);
  });

  if (validDomRects.length === 0) return null;

  // 计算最小包围矩形：取所有DOM的最小top/left，最大right/bottom
  const minTop = Math.min(...validDomRects.map((rect) => rect.top));
  const minLeft = Math.min(...validDomRects.map((rect) => rect.left));
  const maxRight = Math.max(...validDomRects.map((rect) => rect.right));
  const maxBottom = Math.max(...validDomRects.map((rect) => rect.bottom));

  // 构造合并后的DOMRect对象（模拟原生DOMRect结构）
  return {
    top: minTop,
    left: minLeft,
    right: maxRight,
    bottom: maxBottom,
    width: maxRight - minLeft,
    height: maxBottom - minTop,
    x: minLeft,
    y: minTop,
    toJSON: () => ({}),
  };
};

// ========== 核心：生成多个DOM的clip-path路径（内层遮罩用） ==========
const getMultiDomClipPath = (): string => {
  if (!isStepAllowClick.value) return '';
  if (!props.visible || currentStepAllTargetDomConfigs.value.length === 0) return '';

  // 收集所有有效DOM的位置信息（无论模式，只要是目标DOM就挖孔）
  const validDomRects: DOMRect[] = [];
  currentStepAllTargetDomConfigs.value.forEach((config, index) => {
    const rect = getSingleDomRect(config.targetDomId);
    if (rect) {
      validDomRects.push(rect);
    }
  });

  if (validDomRects.length === 0) {
    console.warn('没有有效的DOM位置信息，无法生成挖孔路径');
    return '';
  }

  const mergeRect = getMergeDomRect();
  if (!mergeRect) {
    console.warn('合并后的包围盒为空，无法生成挖孔路径');
    return '';
  }

  // 生成多个DOM的挖孔路径（所有目标DOM都挖孔，保证交互能触达）
  let clipPathParts = ['0 0', '0 100%', '100% 100%', '100% 0', '0 0']; // 基础全屏路径
  validDomRects.forEach((rect, index) => {
    // 计算相对mergeRect的偏移（关键：确保class DOM的相对位置正确）
    const relLeft = rect.left - mergeRect.left;
    const relTop = rect.top - mergeRect.top;
    const relRight = rect.right - mergeRect.left;
    const relBottom = rect.bottom - mergeRect.top;

    // 追加当前DOM的挖孔路径（顺时针绘制）
    clipPathParts.push(`${relLeft}px ${relTop}px`);
    clipPathParts.push(`${relRight}px ${relTop}px`);
    clipPathParts.push(`${relRight}px ${relBottom}px`);
    clipPathParts.push(`${relLeft}px ${relBottom}px`);
    clipPathParts.push(`${relLeft}px ${relTop}px`);
  });

  // 生成最终clip-path（压缩空格，避免解析问题）
  const finalClipPath = `polygon(${clipPathParts.join(', ').replace(/\s+/g, ' ')})`;
  return finalClipPath;
};

// ========== 核心：获取目标DOM信息（供弹窗定位，保持原有逻辑） ==========
const getTargetDomRect = (): DOMRect | null => {
  if (!props.visible) return null;
  const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  return getSingleDomRect(targetDomId);
};

// ========== 第一层：全屏遮罩样式（仅挖掉合并后的包围盒区域） ==========
const maskFullClipStyle = computed<CSSProperties>(() => {
  refreshTrigger.value;
  const mergeRect = getMergeDomRect();
  if (!mergeRect) return {};

  // 计算视口尺寸
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  // clip-path：仅挖掉合并后的包围盒区域（视觉上的整体矩形）
  const clipPath = `
    polygon(
      0 0, 
      0 ${viewportHeight}px, 
      ${viewportWidth}px ${viewportHeight}px, 
      ${viewportWidth}px 0, 
      0 0, 
      ${mergeRect.left}px ${mergeRect.top}px, 
      ${mergeRect.right}px ${mergeRect.top}px, 
      ${mergeRect.right}px ${mergeRect.bottom}px, 
      ${mergeRect.left}px ${mergeRect.bottom}px, 
      ${mergeRect.left}px ${mergeRect.top}px
    )
  `
    .replace(/\s+/g, ' ')
    .trim(); // 压缩空格，避免样式解析问题

  return {
    clipPath,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.05)', // 全屏遮罩底色
    zIndex: 1050,
    pointerEvents: 'auto',
  };
});

// ========== 第二层：包围盒内遮罩样式（仅对指定DOM挖孔） ==========
const maskInnerStyle = computed<CSSProperties>(() => {
  refreshTrigger.value;
  const mergeRect = getMergeDomRect();
  if (!mergeRect) return { display: 'none' };

  // 生成多个指定DOM的clip-path路径（仅这些DOM可点击）
  const clipPath = getMultiDomClipPath();
  const backColor = isStepAllowClick.value ? '#317AF7' : 'rgb(255,255,255)';
  return {
    clipPath,
    position: 'fixed',
    top: `${mergeRect.top}px`,
    left: `${mergeRect.left}px`,
    width: `${mergeRect.width}px`,
    height: `${mergeRect.height}px`,
    backgroundColor: backColor, // 内部遮罩
    opacity: `0.1`,
    zIndex: 1050.5, // 介于全屏遮罩和边框之间
    pointerEvents: 'auto',
    transition: 'all 0.2s ease-in-out',
    cursor: `url(${cursorNotAllowed.value}),auto`,
  };
});

// ========== 合并后的目标DOM视觉边框样式（单个包围盒边框） ==========
const mergeTargetBorderStyle = computed<CSSProperties>(() => {
  refreshTrigger.value;
  const mergeRect = getMergeDomRect();
  if (!mergeRect) return { display: 'none' };

  // 新增：根据是否允许点击切换边框颜色
  const borderColor = isShowBorder.value ? 'var(--devui-category-search-hover-border)' : 'rgba(0,0,0,0)';

  return {
    position: 'fixed',
    top: `${mergeRect.top}px`,
    left: `${mergeRect.left}px`,
    width: `${mergeRect.width}px`,
    height: `${mergeRect.height}px`,
    border: `1px solid ${borderColor}`, // 动态边框颜色
    borderRadius: '8px',
    boxSizing: 'border-box',
    zIndex: 1051, // 高于两层遮罩，低于弹窗
    pointerEvents: 'none', // 点击穿透
    transition: 'all 0.2s ease-in-out',
  };
});

// ========== 动态计算弹窗box-shadow（阴影与箭头同方向） ==========
const popupContentBoxShadow = computed(() => {
  const triangleDir = triangleConfig.value.triangleDirection;
  const darkMode = isDarkTheme.value;
  // 基础阴影参数
  const darkBase = {
    offsetX: 0,
    offsetY: 0,
    blur: 50,
    spread: 10,
    color: 'rgba(0,0,0,0.3)',
  };
  const lightBase = {
    offsetX: 0,
    offsetY: 0,
    blur: 50,
    spread: 0,
    color: 'rgba(0,0,0,0.08)',
  };
  const base = darkMode ? darkBase : lightBase;

  // 阴影偏向箭头同方向
  switch (triangleDir) {
    case 'top':
      // 箭头向上 → 阴影也向上（同方向）
      return `${base.offsetX}px ${base.offsetY - 20}px ${base.blur}px ${base.spread}px ${base.color}`;
    case 'bottom':
      // 箭头向下 → 阴影也向下（同方向）
      return `${base.offsetX}px ${base.offsetY + 20}px ${base.blur}px ${base.spread}px ${base.color}`;
    case 'left':
      // 箭头向左 → 阴影也向左（同方向）
      return `${base.offsetX - 20}px ${base.offsetY}px ${base.blur}px ${base.spread}px ${base.color}`;
    case 'right':
      // 箭头向右 → 阴影也向右（同方向）
      return `${base.offsetX + 20}px ${base.offsetY}px ${base.blur}px ${base.spread}px ${base.color}`;
    default:
      // 兜底使用基础阴影
      return `${base.offsetX}px ${base.offsetY}px ${base.blur}px ${base.spread}px ${base.color}`;
  }
});

const defaultGuideSteps = props.graphType === 'threeColumnGraph' ? guideStepsConfigStep3 : guideStepsConfigStep2;
const currentBigGroup = ref(0);
const currentSmallIndex = ref(0);

// ========== 拆分位置计算逻辑，先算高度再算位置 ==========
/**
 * 获取弹窗实际高度（确保实时）
 */
const getPopupRealHeight = (): number => {
  if (!props.visible) return 200;
  const popupContent = document.querySelector('.guide-popup-content');
  if (!popupContent) return 200;
  // 强制重绘，确保获取最新高度
  popupContent.getBoundingClientRect();
  return popupContent.offsetHeight || 200;
};

// ========== 弹窗样式 + 三角偏移样式 ==========
const popupWrapperStyle = computed<CSSProperties>(() => {
  refreshTrigger.value; // 触发重新计算
  return getTargetDomPosition().popupStyle;
});

const triangleOffsetStyle = computed<CSSProperties>(() => {
  refreshTrigger.value; // 触发重新计算
  let { triangleOffset } = getTargetDomPosition();
  const triangleDir = triangleConfig.value.triangleDirection;

  // 根据三角方向应用偏移
  switch (triangleDir) {
    case 'top':
    case 'bottom':
      return {
        transform: `translate(${triangleOffset.x - 8}px, -50%)`,
        left: `50%`,
      };
    case 'left':
    case 'right':
      return {
        transform: `translateY(${triangleOffset.y - 6}px)`,
        top: `50%`,
      };
    default:
      return {};
  }
});

// ========== 视口尺寸/边界检测工具函数 ==========
/**
 * 获取视口尺寸（实时）
 */
const getViewportSize = () => {
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
    // 安全边距：避免弹窗贴边，留8px
    safeMargin: 8,
  };
};

/**
 * 获取弹窗实际尺寸（宽+高，精准）
 */
const getPopupRealSize = (): { width: number; height: number } => {
  if (!props.visible || !popupContentRef.value) {
    return { width: props.width ? parseInt(props.width) : 420, height: 200 };
  }
  // 强制重绘，获取最新尺寸
  popupContentRef.value.getBoundingClientRect();
  return {
    width: popupContentRef.value.offsetWidth,
    height: popupContentRef.value.offsetHeight,
  };
};

/**
 * 修正弹窗位置，避免溢出视口
 * @param initialPos 初始计算的弹窗位置
 * @param domRect 目标DOM的位置信息
 * @param popupSize 弹窗尺寸
 * @param triangleDir 三角方向
 * @returns 修正后的位置 + 三角偏移量
 */
const fixPositionOverflow = (
  initialPos: CSSProperties,
  domRect: DOMRect,
  popupSize: { width: number; height: number },
  triangleDir: 'top' | 'bottom' | 'left' | 'right',
) => {
  const viewport = getViewportSize();
  // 解构初始位置（转为数字）
  let top = initialPos.top ? parseFloat(initialPos.top.toString().replace('px', '')) : 0;
  let left = initialPos.left ? parseFloat(initialPos.left.toString().replace('px', '')) : 0;
  // 三角偏移量（默认居中）
  let triangleOffset = { x: 0, y: 0 };

  // ========== 1. 处理水平方向（left/right）溢出 ==========
  // 弹窗左边界溢出
  if (left < viewport.safeMargin) {
    const offsetX = viewport.safeMargin - left;
    left = viewport.safeMargin;
    // 根据三角方向调整偏移
    if (triangleDir === 'top' || triangleDir === 'bottom') {
      triangleOffset.x = -offsetX; // 三角左移
    } else if (triangleDir === 'left') {
      triangleOffset.x = offsetX; // 三角右移
    } else if (triangleDir === 'right') {
      triangleOffset.x = -offsetX; // 三角左移
    }
  }
  // 弹窗右边界溢出
  if (left + popupSize.width > viewport.width - viewport.safeMargin) {
    const offsetX = left + popupSize.width - (viewport.width - viewport.safeMargin);
    left -= offsetX;
    // 根据三角方向调整偏移
    if (triangleDir === 'top' || triangleDir === 'bottom') {
      triangleOffset.x = offsetX; // 三角右移
    } else if (triangleDir === 'left') {
      triangleOffset.x = -offsetX; // 三角左移
    } else if (triangleDir === 'right') {
      triangleOffset.x = offsetX; // 三角右移
    }
  }

  // ========== 2. 处理垂直方向（top/bottom）溢出 ==========
  // 弹窗上边界溢出
  if (top < viewport.safeMargin) {
    const offsetY = viewport.safeMargin - top;
    top = viewport.safeMargin;
    // 根据三角方向调整偏移
    if (triangleDir === 'left' || triangleDir === 'right') {
      triangleOffset.y = -offsetY; // 三角上移
    } else if (triangleDir === 'top') {
      triangleOffset.y = offsetY; // 三角下移
    } else if (triangleDir === 'bottom') {
      triangleOffset.y = -offsetY; // 三角上移
    }
  }
  // 弹窗下边界溢出
  if (top + popupSize.height > viewport.height - viewport.safeMargin) {
    const offsetY = top + popupSize.height - (viewport.height - viewport.safeMargin);
    top -= offsetY;
    // 根据三角方向调整偏移
    if (triangleDir === 'left' || triangleDir === 'right') {
      triangleOffset.y = offsetY; // 三角下移
    } else if (triangleDir === 'top') {
      triangleOffset.y = -offsetY; // 三角上移
    } else if (triangleDir === 'bottom') {
      triangleOffset.y = offsetY; // 三角下移
    }
  }

  // ========== 3. 特殊场景：DOM贴近边角时的强制修正 ==========
  // 比如top方向弹窗，DOM在视口最右侧，弹窗右溢 → 强制左移到DOM正下方
  if (triangleDir === 'top' && left + popupSize.width > viewport.width - viewport.safeMargin) {
    // 弹窗左边界对齐DOM左边界
    left = domRect.left - (popupSize.width / 2 - domRect.width / 2);
    // 再次检测右溢，若仍溢出则左移到视口右边界内
    if (left + popupSize.width > viewport.width - viewport.safeMargin) {
      left = viewport.width - viewport.safeMargin - popupSize.width;
    }
    // 计算三角偏移（指向DOM中心）
    triangleOffset.x = domRect.left + domRect.width / 2 - (left + popupSize.width / 2);
  }
  return {
    fixedPos: {
      ...initialPos,
      top: `${top}px`,
      left: `${left}px`,
    },
    triangleOffset,
  };
};

/**
 * 获取目标DOM的位置信息 + 边界修正 + 三角偏移
 */
const getTargetDomPosition = () => {
  if (!props.visible) {
    return {
      popupStyle: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1052,
        boxSizing: 'border-box',
        position: 'fixed' as const,
      },
      triangleOffset: { x: 0, y: 0 },
    };
  }

  const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  const targetDom = getTargetElement(targetDomId);
  if (!targetDom) {
    console.warn(`目标DOM ID ${targetDomId} 不存在，使用兜底定位`);
    return {
      popupStyle: {
        top: '150%',
        left: '150%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1052,
        boxSizing: 'border-box',
        position: 'fixed' as const,
      },
      triangleOffset: { x: 0, y: 0 },
    };
  }

  // 1. 获取基础信息（实时）
  // targetDom.getBoundingClientRect(); // 强制重绘
  const domRect = targetDom.getBoundingClientRect();
  const popupSize = getPopupRealSize();
  const triangleDir = triangleConfig.value.triangleDirection;
  let initialPos: CSSProperties = {};

  // 2. 计算初始位置
  switch (triangleDir) {
    case 'right':
      initialPos = {
        position: 'fixed' as const,
        top: `${domRect.top + domRect.height / 2 - popupSize.height / 2}px`,
        left: `${domRect.left - popupSize.width - 16}px`,
        transform: 'none',
        zIndex: 1052,
        boxSizing: 'border-box',
      };
      break;
    case 'left':
      initialPos = {
        position: 'fixed' as const,
        top: `${domRect.top + domRect.height / 2 - popupSize.height / 2}px`,
        left: `${domRect.right + 16}px`,
        transform: 'none',
        zIndex: 1052,
        boxSizing: 'border-box',
      };
      break;
    case 'bottom':
      initialPos = {
        position: 'fixed' as const,
        top: `${domRect.top - popupSize.height - 16}px`,
        left: `${domRect.left + domRect.width / 2 - popupSize.width / 2}px`,
        transform: 'none',
        zIndex: 1052,
        boxSizing: 'border-box',
      };
      break;
    case 'top':
      initialPos = {
        position: 'fixed' as const,
        top: `${domRect.bottom + 16}px`,
        left: `${domRect.left + domRect.width / 2 - popupSize.width / 2}px`,
        transform: 'none',
        zIndex: 1052,
        boxSizing: 'border-box',
      };
      break;
    default:
      initialPos = {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1052,
        boxSizing: 'border-box',
      };
  }

  //  修正溢出 + 计算三角偏移
  const { fixedPos, triangleOffset } = fixPositionOverflow(initialPos, domRect, popupSize, triangleDir);

  return {
    popupStyle: fixedPos,
    triangleOffset,
  };
};

// ========== handleResize，强制触发响应式更新 ==========
const handleResize = async () => {
  if (!props.visible) return;
  await nextTick();
  // console.log('handleResize触发，开始重新计算位置和裁剪区域');

  // 步骤1：强制目标DOM和弹窗重绘，获取最新尺寸
  const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  const targetDom = getTargetElement(targetDomId);
  if (targetDom) {
    targetDom.getBoundingClientRect();
  }

  const popupContent = document.querySelector('.guide-popup-content');
  if (popupContent) popupContent.getBoundingClientRect();

  // 步骤2：更新refreshTrigger，强制computed重新计算
  refreshTrigger.value += 1;

  // 步骤3：手动更新样式（兜底）
  const wrapper = document.querySelector('.guide-popup-wrapper');
  if (wrapper && popupWrapperStyle.value) {
    Object.assign(wrapper.style, popupWrapperStyle.value);
  }
};

// 防抖后的resize处理函数
const debouncedHandleResize = debounce(handleResize, 150);

// ========== 监听DOM尺寸/位置变化 ==========
let resizeObserver: ResizeObserver | null = null;
let domObserver: MutationObserver | null = null;
// 保存父元素监听实例，避免内存泄漏
let parentObserver: MutationObserver | null = null;

/**
 * 监听目标DOM及其父元素的变化（适配flex布局）
 */
const observeDomChange = (domSelector: string) => {
  // 销毁原有监听
  if (resizeObserver) resizeObserver.disconnect();
  if (domObserver) domObserver.disconnect();
  if (parentObserver) parentObserver.disconnect();

  domObserver = new MutationObserver(debouncedHandleResize);
  const middleLayerElement = document.querySelector('#boot-middleLayer');
  if (middleLayerElement) {
    domObserver.observe(middleLayerElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true,
    });
  }

  const middleLayerElement2 = document.querySelector('#boot-controlFlow-index');
  if (middleLayerElement2) {
    domObserver.observe(middleLayerElement2, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  // 关键修复：复用getTargetElement，统一ID/class查找逻辑
  const targetDom = getTargetElement(domSelector);
  if (!targetDom) {
    return;
  }

  // 1. ResizeObserver：监听DOM尺寸变化（兼容class DOM）
  resizeObserver = new ResizeObserver(debouncedHandleResize);
  resizeObserver.observe(targetDom);

  // 2. MutationObserver：监听父元素的布局变化
  const parentDom = targetDom.parentElement;
  if (parentDom) {
    parentObserver = new MutationObserver(debouncedHandleResize);
    parentObserver.observe(parentDom, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: true,
    });
  }
};

// ========== 监听步骤变化 ==========
watch([currentBigGroup, currentSmallIndex], async () => {
  await nextTick();
  handleResize();
  const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  observeDomChange(targetDomId);
});

// 监听弹窗显示状态
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick();
      handleResize();
      const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value, props.graphType);
      observeDomChange(targetDomId);
    } else {
      if (resizeObserver) resizeObserver.disconnect();
      if (domObserver) domObserver.disconnect();
      if (parentObserver) parentObserver.disconnect();
    }
  },
  { immediate: true },
);

// 组件Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'complete'): void;
}>();

// 发送消息通知事件
const postToExtension = (type: string, data: any) => {
  (window as any).ascEventBus.emit('boot-step-tips', { type, data });
};

// ========== callCurrentWebviewMethod添加容错 ==========
const callCurrentWebviewMethod = (methodName: string, params: any) => {
  const currentGroupConfig = defaultGuideSteps[currentBigGroup.value];
  if (!currentGroupConfig) {
    console.warn('当前大组配置不存在，无法调用WebView方法');
    return;
  }
  postToExtension('callWebviewMethod', {
    targetWebviewType: currentGroupConfig.webviewType,
    methodName,
    params,
  });
};

const openNextWebview = (nextBigGroup: number) => {
  const nextGroupConfig = getNextBigGroupConfig(nextBigGroup - 1, props.graphType);
  if (!nextGroupConfig?.openWebviewFn) return;
  postToExtension('openWebviewWithGuide', {
    openWebviewFn: nextGroupConfig?.openWebviewFn,
  });
};

// 上一步逻辑
const handlePrevStep = async () => {
  let newBig = currentBigGroup.value;
  let newSmall = currentSmallIndex.value;

  if (newSmall > 0) {
    newSmall--;
  } else {
    newBig--;
    newSmall = defaultGuideSteps[newBig].steps.length - 1;
  }

  const currentStepConfig = getCurrentStepConfig(newBig, newSmall, props.graphType);
  if (currentStepConfig?.method) {
    callCurrentWebviewMethod(currentStepConfig.method, currentStepConfig.methodParams);
  }
  isShow.value = false;
  await nextTick();
  setTimeout(async () => {
    await setGuideProgress(newBig, newSmall);
    isShow.value = true;
  }, 100);
};

// 下一步逻辑
const handleNextStep = async () => {
  let newBig = currentBigGroup.value;
  let newSmall = currentSmallIndex.value;
  const currentGroupConfig = defaultGuideSteps[newBig];
  if (!currentGroupConfig) return; // 容错
  const isLastInGroup = newSmall === currentGroupConfig.steps.length - 1;

  if (isLastInGroup) {
    newBig++;
    newSmall = 0;
    await setGuideProgress(newBig, newSmall);
    openNextWebview(newBig);
        // 调用下一步步骤方法
    const currentStepConfig = getCurrentStepConfig(newBig, newSmall, props.graphType);
    if (currentStepConfig?.method) {
      callCurrentWebviewMethod(currentStepConfig.method, currentStepConfig.methodParams);
    }
  } else {
    newSmall++;
    // 先调用下一步步骤方法
    const currentStepConfig = getCurrentStepConfig(newBig, newSmall, props.graphType);
    if (currentStepConfig?.method) {
      callCurrentWebviewMethod(currentStepConfig.method, currentStepConfig.methodParams);
    }
    isShow.value = false;
    await nextTick();
    setTimeout(async () => {
      await setGuideProgress(newBig, newSmall);
      isShow.value = true;
    }, 100);
  }
};

// 跳过全部
const handleSkipAll = () => {
  updateWelcomeState({
    key: 'guide.state',
    value: false,
  });
  if (props.graphType === 'threeColumnGraph') {
    completeTreeColumnStep();
  } else {
    completeResultsStep();
  }
  postToExtension('welcomeSkipAll', null);
};

// 合并步骤数据
const guideSteps = computed(() => props.guideSteps || defaultGuideSteps);

// 当前大组步骤
const currentBigGroupSteps = computed(() => {
  const group = guideSteps.value[currentBigGroup.value];
  return group ? group.steps : [];
});

// 当前步骤信息
const currentStepInfo = computed(() => {
  if (currentBigGroupSteps.value.length === 0) return { title: '', content: '' };
  const idx = Math.min(currentSmallIndex.value, currentBigGroupSteps.value.length - 1);
  return currentBigGroupSteps.value[idx];
});

// 圆点状态
const getDotItemStatus = (groupIdx: number, stepIdx: number) => {
  if (groupIdx < currentBigGroup.value) return 'completed-dot';
  if (groupIdx === currentBigGroup.value) {
    if (stepIdx < currentSmallIndex.value) return 'completed-dot';
    if (stepIdx === currentSmallIndex.value) return 'active-dot';
    return 'unfinished-dot';
  }
  return 'unfinished-dot';
};

// 按钮逻辑
const hasPrevStep = computed(() => {
  return !(currentSmallIndex.value === 0 && currentBigGroup.value !== 1);
});
const hasNextBtn = computed(
  () => !(currentBigGroup.value === guideSteps.value.length - 1 && currentSmallIndex.value === currentBigGroupSteps.value.length - 1),
);
const nextBtnText = computed(() => {
  const isLastInGroup = currentSmallIndex.value === currentBigGroupSteps.value.length - 1;
  if (isLastInGroup && currentBigGroup.value < guideSteps.value.length - 1) {
    return t('bootStep.button.learnGroup', {
      groupName: t(guideSteps.value[currentBigGroup.value + 1].groupName),
    });
  }
  return t('bootStep.button.nextStep');
});

// 读取globalState中的进度
const getGuideProgress = async () => {
  const currentBig = await getWelcomeState({
    key: 'guide.currentBigGroup',
  });
  const currentSmall = await getWelcomeState({
    key: 'guide.currentSmallIndex',
  });
  currentBigGroup.value = currentBig as number;
  currentSmallIndex.value = currentSmall as number;
};

// 写入进度到globalState
const setGuideProgress = async (bigGroup: number, smallIndex: number) => {
  await updateWelcomeState({
    key: 'guide.currentBigGroup',
    value: bigGroup,
  });
  await updateWelcomeState({
    key: 'guide.currentSmallIndex',
    value: smallIndex,
  });
  currentBigGroup.value = bigGroup;
  currentSmallIndex.value = smallIndex;
};

let checkDomInterval = null;
// 生命周期
onMounted(async () => {
  updateWelcomeState({
    key: 'guide.currentSmallIndex',
    value: 0,
  });
  await getGuideProgress();
  // 监听窗口resize事件
  window.addEventListener('resize', debouncedHandleResize);
  // 额外监听滚动（如果DOM位置受滚动影响）
  window.addEventListener('scroll', debouncedHandleResize);

  let targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value, props.graphType);
  if (props.visible) {
    observeDomChange(targetDomId);
  }
  // 检测一次DOM是否加载完成，直到找到DOM或引导关闭
  checkDomInterval = setInterval(() => {
    targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value, props.graphType);
    // 引导已关闭则停止检测
    if (!props.visible) {
      clearInterval(checkDomInterval);
      return;
    }
    // DOM加载完成后，更新遮罩和弹窗位置
    const targetDom = getTargetElement(targetDomId);
    if (targetDom) {
      clearInterval(checkDomInterval);
      handleResize(); // 重新计算位置，恢复正常引导
      isShowFullFalBack.value = false;
      // console.log(`目标DOM ${targetDomId} 加载完成，恢复正常引导`);
    }
  }, 200);
  const res = await getQuery();
  const uri = res._uri;
  const query = JSON.parse(uri.query);
  if (!query.isBootStep) {
    emit('update:visible', false);
    window.removeEventListener('resize', debouncedHandleResize);
    window.removeEventListener('scroll', debouncedHandleResize);
    if (resizeObserver) resizeObserver.disconnect();
    if (domObserver) domObserver.disconnect();
    clearInterval(checkDomInterval);
    isShowFullFalBack.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', debouncedHandleResize);
  window.removeEventListener('scroll', debouncedHandleResize);
  if (resizeObserver) resizeObserver.disconnect();
  if (domObserver) domObserver.disconnect();
  if (parentObserver) parentObserver.disconnect();
  clearInterval(checkDomInterval);
});
</script>
<style scoped lang="less">
// 遮罩容器：统一管理遮罩和弹窗层级
.guide-mask-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1050;
  pointer-events: none; // 容器不阻止点击
}

// 第一层：全屏遮罩 - 仅挖掉合并后的包围盒区域
.guide-mask-full {
  transition: clip-path 0.1s ease-in-out; // 裁剪区域变化时平滑过渡
  pointer-events: auto; // 阻止非包围盒区域的点击
}

// 第二层：包围盒内遮罩 - 灰色半透明，仅对指定DOM挖孔
.guide-mask-inner {
  transition: clip-path 0.1s ease-in-out;
  pointer-events: auto; // 阻止包围盒内非指定DOM的点击
  border-radius: 4px; // 和边框圆角一致，视觉更统一
}

// 目标DOM的视觉边框（仅提示，无遮罩）
.guide-target-border {
  pointer-events: none !important; // 强制点击穿透
}

// 弹窗外层容器
.guide-popup-wrapper {
  position: fixed;
  z-index: 1052; // 高于所有遮罩和边框
  box-sizing: border-box;
  max-width: 480px;
  min-width: 480px;
  pointer-events: auto; // 弹窗可点击
}

// 三角基础样式（优化定位）
.guide-triangle {
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  z-index: 1052;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  pointer-events: none;
  transition: transform 0.2s ease;
}

// 1. 向右三角（外层容器右侧外部）
.triangle-right {
  right: -16px;
  top: 50%;
  border-left-color: var(--devui-select-bg);
  filter: var(--devui-select-shadow);
}

// 2. 向左三角（外层容器左侧外部）
.triangle-left {
  left: -16px;
  top: 50%;
  border-right-color: var(--devui-select-bg);
  filter: var(--devui-select-shadow);
}

// 3. 向上三角（外层容器顶部外部）
.triangle-top {
  top: -8px;
  left: 50%;
  border-bottom-color: var(--devui-select-bg);
  filter: var(--devui-select-shadow);
}

// 4. 向下三角（外层容器底部外部）
.triangle-bottom {
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: var(--devui-select-bg);
  filter: var(--devui-select-shadow);
}

// 气泡弹窗内容区（仅承载内容，无三角定位）
.guide-popup-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--devui-select-bg);
  padding: 28px;
  border-radius: 16px;
  box-sizing: border-box;
  max-width: 90vw;
  max-height: calc(80vh - 32px);
  overflow-y: auto;
  pointer-events: auto; // 确保弹窗内容可点击
}

// ========== 内容区样式 ==========
.progress-container {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: nowrap;

  .progress-img {
    width: 12px;
    height: 12px;
    object-fit: contain;
  }

  .progress-group {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-right: 8px;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    position: relative;
    box-sizing: border-box;

    &.completed-dot {
      border: 0.5px solid var(--devui-title-text);
      background: var(--devui-nest-bg);
    }

    &.active-dot {
      background: var(--devui-title-text);
      transform: scale(1.5);

      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: calc(100% - 2px);
        height: calc(100% - 2px);
        border-radius: 4px;
        border: 1.5px solid var(--devui-global-bg);
        background: var(--devui-nest-bg);
        box-sizing: border-box;
      }
    }

    &.unfinished-dot {
      background: var(--devui-nest-bg);
      border: 1px solid var(--devui-split-line);
    }
  }

  .separator {
    width: 1px;
    height: 12px;
    font-size: 12px;
    line-height: 12px;
    margin-right: 6px;
    background-color: var(--devui-split-line);
  }
}

.content-container {
  display: flex;
  flex-direction: column;
  gap: 25px;
  justify-content: space-between;

  .container__header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;

    .step-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--devui-primary-text);
    }

    .step-count__group {
      display: flex;
      flex-direction: row;
      align-items: baseline;
      line-height: normal;

      .step-count {
        font-size: 18px;
        font-weight: 600;
        color: var(--devui-primary-text);
        vertical-align: bottom;
      }

      .step-count__right {
        font-size: 13px;
        font-weight: 400;
        color: var(--devui-placeholder-text);
        vertical-align: bottom;
        margin-left: 2px;
      }
    }
  }

  .step-content {
    font-size: 14px;
    color: var(--devui-secondary-text);
    line-height: 1.6;
  }
}

.btn-container {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;

  button {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;

    &:hover {
      opacity: 0.9;
    }
  }

  .skip-btn {
    font-size: 13px;
    display: flex;
    align-items: center;
    height: 28px;
    border-radius: 8px;
    background: var(--devui-input-hover-bg);
    color: var(--devui-primary-text);
  }

  .prev-btn {
    font-size: 13px;
    display: flex;
    align-items: center;
    border-radius: 8px;
    height: 28px;
    background: var(--devui-input-hover-bg);
    color: var(--devui-primary-text);
  }

  .next-btn {
    font-size: 13px;
    display: flex;
    align-items: center;
    border-radius: 8px;
    height: 28px;
    background-color: var(--devui-active-icon);
    color: var(--devui-primary-tooltip-text);
  }
}
</style>
