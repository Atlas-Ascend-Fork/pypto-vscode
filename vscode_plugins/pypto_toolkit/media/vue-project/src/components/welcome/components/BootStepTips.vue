<template>
  <!-- 遮罩层 -->
  <div v-if="visible" class="guide-mask" @click.stop="handleMaskClick" @pointerup.stop>
    <!-- 弹窗外层容器（ -->
    <div class="guide-popup-wrapper" :style="popupWrapperStyle">
      <!-- 引导三角：动态偏移样式 -->
      <div
        v-if="triangleConfig.showTriangle"
        class="guide-triangle"
        :class="`triangle-${triangleConfig.triangleDirection}`"
        :style="triangleOffsetStyle"
      ></div>

      <!-- 气泡弹窗容器 -->
      <div class="guide-popup-content" ref="popupContentRef">
        <!-- 顶部进度指示器 -->
        <div class="progress-container">
          <template v-for="(group, groupIdx) in guideSteps" :key="groupIdx">
            <div class="progress-group">
              <img :src="group.imgUrl" class="progress-img" />
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
            <h3 class="step-title">{{ currentStepInfo.title }}</h3>
            <p class="step-count">{{ currentSmallIndex + 1 }}/{{ currentBigGroupSteps.length }}</p>
          </div>
          <p class="step-content">{{ currentStepInfo.content }}</p>
        </div>

        <!-- 操作按钮栏 -->
        <div class="btn-container">
          <button class="skip-btn" @click="handleSkipAll">跳过全部</button>
          <!-- <button v-if="hasPrevStep" class="prev-btn" @click="handlePrevStep">上一步</button> -->
          <template v-if="hasNextBtn">
            <button class="next-btn" @click="handleNextStep">{{ nextBtnText }}</button>
          </template>
          <button v-else class="next-btn" @click="handleStartExperience">完成</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getWelcomeState, updateWelcomeState } from '@/apis/welcome';
import { computed, ref, watch, onMounted, nextTick, onUnmounted } from 'vue';
import type { CSSProperties } from 'vue';
import {
  getCurrentStepConfig,
  getCurrentStepTargetDomId,
  getCurrentStepTriangleConfig,
  getNextBigGroupConfig,
  guideStepsConfig,
} from '../guideStepsConfig';
import { useViewServer } from '@/core/use-view-server';

// 定义步骤类型
interface GuideStepItem {
  title: string;
  content: string;
  showTriangle: boolean;
  targetDomId: string;
  triangleDirection: 'top' | 'bottom' | 'left' | 'right';
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
}>();

// ========== 响应式触发变量（强制更新computed） ==========
const refreshTrigger = ref(0);
// 弹窗内容区Ref（用于精准获取尺寸）
const popupContentRef = ref<HTMLDivElement | null>(null);

/**
 * 防抖函数
 */
const debounce = (fn: Function, delay = 300) => {
  let timer: NodeJS.Timeout | null = null;
  return (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

// 三角配置
const triangleConfig = computed(() => {
  return getCurrentStepTriangleConfig(currentBigGroup.value, currentSmallIndex.value);
});

const defaultGuideSteps = guideStepsConfig;
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
  const { triangleOffset } = getTargetDomPosition();
  const triangleDir = triangleConfig.value.triangleDirection;

  // 根据三角方向应用偏移
  switch (triangleDir) {
    case 'top':
    case 'bottom':
      return {
        transform: `translate(${triangleOffset.x}px, -50%)`,
        left: `50%`,
      };
    case 'left':
    case 'right':
      return {
        transform: `translateY(${triangleOffset.y}px)`,
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
        zIndex: 99999,
        boxSizing: 'border-box',
        position: 'fixed' as const,
      },
      triangleOffset: { x: 0, y: 0 },
    };
  }

  const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value);
  const targetDom = document.getElementById(targetDomId);
  if (!targetDom) {
    console.warn(`目标DOM ID ${targetDomId} 不存在，使用兜底定位`);
    return {
      popupStyle: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 99999,
        boxSizing: 'border-box',
        position: 'fixed' as const,
      },
      triangleOffset: { x: 0, y: 0 },
    };
  }

  // 1. 获取基础信息（实时）
  targetDom.getBoundingClientRect(); // 强制重绘
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
        left: `${domRect.left - popupSize.width - 8}px`,
        transform: 'none',
        zIndex: 99999,
        boxSizing: 'border-box',
      };
      break;
    case 'left':
      initialPos = {
        position: 'fixed' as const,
        top: `${domRect.top + domRect.height / 2 - popupSize.height / 2}px`,
        left: `${domRect.right + 8}px`,
        transform: 'none',
        zIndex: 99999,
        boxSizing: 'border-box',
      };
      break;
    case 'bottom':
      initialPos = {
        position: 'fixed' as const,
        top: `${domRect.top - popupSize.height - 8}px`,
        left: `${domRect.left + domRect.width / 2 - popupSize.width / 2}px`,
        transform: 'none',
        zIndex: 99999,
        boxSizing: 'border-box',
      };
      break;
    case 'top':
      initialPos = {
        position: 'fixed' as const,
        top: `${domRect.bottom + 20}px`,
        left: `${domRect.left + domRect.width / 2 - popupSize.width / 2}px`,
        transform: 'none',
        zIndex: 99999,
        boxSizing: 'border-box',
      };
      break;
    default:
      initialPos = {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 99999,
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
  console.log('handleResize触发，开始重新计算位置');

  // 步骤1：强制目标DOM和弹窗重绘，获取最新尺寸
  const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value);
  const targetDom = document.getElementById(targetDomId);
  if (targetDom) targetDom.getBoundingClientRect();
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
const debouncedHandleResize = debounce(handleResize, 100);

// ========== 监听DOM尺寸/位置变化 ==========
let resizeObserver: ResizeObserver | null = null;
let domObserver: MutationObserver | null = null;

/**
 * 监听目标DOM及其父元素的变化（适配flex布局）
 */
const observeDomChange = (domId: string) => {
  // 销毁原有监听
  if (resizeObserver) resizeObserver.disconnect();
  if (domObserver) domObserver.disconnect();
  domObserver = new MutationObserver(debouncedHandleResize);
  const middleLayerFlowElement = document.querySelector('#boot-middleLayer');
  if (middleLayerFlowElement) {
    domObserver.observe(middleLayerFlowElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: false,
      subtree: true,
    });
  }
  const targetDom = document.getElementById(domId);
  if (!targetDom) return;

  // 1. ResizeObserver：监听DOM尺寸变化
  resizeObserver = new ResizeObserver(debouncedHandleResize);
  resizeObserver.observe(targetDom);

  // 2. MutationObserver：监听父元素的布局变化
  const parentDom = targetDom.parentElement;
  if (parentDom) {
    domObserver = new MutationObserver(debouncedHandleResize);
    domObserver.observe(parentDom, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: false,
      subtree: true,
    });
  }
};

// ========== 监听步骤变化 ==========
watch([currentBigGroup, currentSmallIndex], async () => {
  await nextTick();
  handleResize();
  const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value);
  observeDomChange(targetDomId);
});

// 监听弹窗显示状态
watch(
  () => props.visible,
  async (newVal) => {
    if (newVal) {
      await nextTick();
      getGuideProgress();
      handleResize();
      const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value);
      observeDomChange(targetDomId);
    } else {
      if (resizeObserver) resizeObserver.disconnect();
      if (domObserver) domObserver.disconnect();
    }
  },
  { immediate: true },
);

// 组件Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'complete'): void;
}>();
const { server } = useViewServer();

// 发送消息通知事件
const postToExtension = (type: string, data: any) => {
  (window as any).ascEventBus.emit('boot-step-tips', { type, data });
};

// ========== callCurrentWebviewMethod添加容错 ==========
const callCurrentWebviewMethod = (methodName: string, params: any) => {
  const currentGroupConfig = guideStepsConfig[currentBigGroup.value];
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
  const nextGroupConfig = getNextBigGroupConfig(nextBigGroup - 1);
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
    newSmall = guideStepsConfig[newBig].steps.length - 1;
  }

  await setGuideProgress(newBig, newSmall);
  const currentStepConfig = getCurrentStepConfig(newBig, newSmall);
  if (currentStepConfig?.method) {
    callCurrentWebviewMethod(currentStepConfig.method, currentStepConfig.methodParams);
  }
};

// 下一步逻辑
const handleNextStep = async () => {
  let newBig = currentBigGroup.value;
  let newSmall = currentSmallIndex.value;
  const currentGroupConfig = guideStepsConfig[newBig];
  if (!currentGroupConfig) return; // 容错
  const isLastInGroup = newSmall === currentGroupConfig.steps.length - 1;

  if (isLastInGroup) {
    newBig++;
    newSmall = 0;
    openNextWebview(newBig);
    await setGuideProgress(newBig, newSmall);
  } else {
    newSmall++;
    // 先调用下一步步骤方法
    const currentStepConfig = getCurrentStepConfig(newBig, newSmall);
    if (currentStepConfig?.method) {
      callCurrentWebviewMethod(currentStepConfig.method, currentStepConfig.methodParams);
    }

    await setGuideProgress(newBig, newSmall);
  }
};

// 跳过全部
const handleSkipAll = () => {
  updateWelcomeState({
    key: 'guide.state',
    value: false,
  });
  postToExtension('closeAllGuideModal', null);
  // emit('update:visible', false);
};

// 开始体验
const handleStartExperience = () => {
  postToExtension('closeAllGuideModal', null);
  emit('update:visible', false);
  emit('complete');
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
const hasPrevStep = computed(() => !(currentBigGroup.value === 0 && currentSmallIndex.value === 0));
const hasNextBtn = computed(
  () => !(currentBigGroup.value === guideSteps.value.length - 1 && currentSmallIndex.value === currentBigGroupSteps.value.length - 1),
);
const nextBtnText = computed(() => {
  const isLastInGroup = currentSmallIndex.value === currentBigGroupSteps.value.length - 1;
  if (isLastInGroup && currentBigGroup.value < guideSteps.value.length - 1) {
    return `了解${guideSteps.value[currentBigGroup.value + 1].groupName}`;
  }
  return '下一步';
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

const handleMaskClick = () => {
  if (props.closeOnMaskClick) emit('update:visible', false);
};

// 生命周期
onMounted(() => {
  // 监听窗口resize事件
  window.addEventListener('resize', debouncedHandleResize);
  // 额外监听滚动（如果DOM位置受滚动影响）
  window.addEventListener('scroll', debouncedHandleResize);
  if (props.visible) {
    const targetDomId = getCurrentStepTargetDomId(currentBigGroup.value, currentSmallIndex.value);
    observeDomChange(targetDomId);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', debouncedHandleResize);
  window.removeEventListener('scroll', debouncedHandleResize);
  if (resizeObserver) resizeObserver.disconnect();
  if (domObserver) domObserver.disconnect();
});
</script>
<style scoped lang="less">
// 遮罩层
.guide-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 254, 254, 0);
  z-index: 99999;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 弹窗外层容器
.guide-popup-wrapper {
  position: relative; // 三角基于此定位
  z-index: 99999;
  // 取消margin，避免尺寸溢出
  box-sizing: border-box;
  max-width: 480px;
}

// 三角基础样式（优化定位）
.guide-triangle {
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  z-index: 99999;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  pointer-events: none;
  transition: transform 0.2s ease;
}

// 1. 向右三角（外层容器右侧外部）
.triangle-right {
  right: -16px;
  top: 50%;
  border-left-color: #292929;
  filter: drop-shadow(0 2px 4px rgba(95, 95, 95, 0.15));
}

// 2. 向左三角（外层容器左侧外部）
.triangle-left {
  left: -16px;
  top: 50%;
  border-right-color: #292929;
  filter: drop-shadow(0 2px 4px rgba(95, 95, 95, 0.15));
}

// 3. 向上三角（外层容器顶部外部）
.triangle-top {
  top: -8px;
  left: 50%;
  border-bottom-color: #292929;
  filter: drop-shadow(0 2px 4px rgba(95, 95, 95, 0.15));
}

// 4. 向下三角（外层容器底部外部）
.triangle-bottom {
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  border-top-color: #292929;
  filter: drop-shadow(0 2px 4px rgba(95, 95, 95, 0.15));
}

// 气泡弹窗内容区（仅承载内容，无三角定位）
.guide-popup-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #292929;
  padding: 28px;
  border-radius: 16px;
  box-sizing: border-box;
  max-width: 90vw;
  // 调整max-height，避免滚动条
  max-height: calc(80vh - 32px);
  overflow-y: auto;
}

// ========== 内容区样式 ==========

.progress-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
    gap: 6px;
    margin-right: 8px;
  }

  .progress-dot {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    position: relative;
    box-sizing: border-box;

    &.completed-dot {
      border: 0.5px solid #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    &.active-dot {
      background: #ffffff; // 基础白色填充（伪元素覆盖中间）
      transform: scale(1.5); // 放大效果
      &::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: calc(100% - 2px);
        height: calc(100% - 2px);
        border-radius: 4px;
        border: 1.5px solid #000000; // 黑色圆环
        background: rgba(255, 255, 255, 0.1);
        box-sizing: border-box;
      }
    }

    &.unfinished-dot {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  }

  .separator {
    width: 1px;
    height: 12px;
    font-size: 12px;
    line-height: 12px;
    margin-right: 6px;
    background-color: rgba(255, 255, 255, 0.2);
  }
}

.content-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: space-between;

  .container__header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;

    .step-title {
      font-size: 16px;
      font-weight: 600;
      color: #dfdfdf;
    }

    .step-count {
      font-size: 16px;
      font-weight: 600;
      color: #dfdfdf;
    }
  }

  .step-content {
    font-size: 14px;
    color: #a8a9ac;
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
    background: #57585a;
    color: #e2e2e2;
  }

  .prev-btn {
    background: #f5f7fa;
    color: #303133;
  }

  .next-btn {
    background: #409eff;
    color: #fff;
  }
}
</style>
