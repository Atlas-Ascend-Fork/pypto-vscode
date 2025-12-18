<template>
  <!-- 遮罩层 -->
  <div v-if="visible" class="guide-mask" @click="handleMaskClick">
    <!-- 弹窗外层容器（ -->
    <div class="guide-popup-wrapper" :style="popupWrapperStyle">
      <!-- 引导三角 -->
      <div v-if="triangleConfig.showTriangle" class="guide-triangle" :class="`triangle-${triangleConfig.triangleDirection}`"></div>

      <!-- 气泡弹窗容器 -->
      <div class="guide-popup-content">
        <!-- 顶部进度指示器 -->
        <div class="progress-container">
          <template v-for="(group, groupIdx) in guideSteps" :key="groupIdx">
            <img :src="group.imgUrl" class="progress-img" />
            <div class="progress-group">
              <div
                v-for="(step, stepIdx) in group.steps"
                :key="stepIdx"
                class="progress-dot"
                :class="getDotItemStatus(groupIdx, stepIdx)"
              ></div>
            </div>
            <span v-if="groupIdx < guideSteps.length - 1" class="separator">|</span>
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
          <button v-if="hasPrevStep" class="prev-btn" @click="handlePrevStep">上一步</button>
          <template v-if="hasNextBtn">
            <button class="next-btn" @click="handleNextStep">{{ nextBtnText }}</button>
          </template>
          <button v-else class="next-btn" @click="handleStartExperience">开始体验</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getWelcomeState, updateWelcomeState } from '@/apis/welcome';
import { computed, ref, watch, onMounted } from 'vue';
import type { CSSProperties } from 'vue';
import {
  getCurrentStepConfig,
  getCurrentStepPosition,
  getCurrentStepTriangleConfig,
  getNextBigGroupConfig,
  guideStepsConfig,
} from '../guideStepsConfig';

// 定义步骤类型
interface GuideStepItem {
  title: string;
  content: string;
  position: Partial<{ top: string; left: string; right: string; bottom: string }>; // 每步独立定位
  showTriangle: boolean; // 是否显示三角
  triangleDirection: 'top' | 'bottom' | 'left' | 'right'; // 三角方向
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

// 三角配置
const triangleConfig = computed(() => {
  return getCurrentStepTriangleConfig(currentBigGroup.value, currentSmallIndex.value);
});

// 外层容器样式（读取step的position）
const popupWrapperStyle = computed<CSSProperties>(() => {
  const currentStepPos = getCurrentStepPosition(currentBigGroup.value, currentSmallIndex.value);
  const baseStyle: CSSProperties = {
    width: props.width || '420px',
    position: 'fixed',
    borderRadius: '16px',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  };

  const finalStyle = { ...baseStyle };
  if (currentStepPos.top || currentStepPos.bottom) {
    delete finalStyle.top;
    delete finalStyle.transform;
  }
  if (currentStepPos.left || currentStepPos.right) {
    delete finalStyle.left;
    delete finalStyle.transform;
  }

  return {
    ...finalStyle,
    ...currentStepPos,
  };
});

// 组件Emits
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'complete'): void;
}>();

// 原有Props/Emits/默认配置不变，替换默认步骤为全局配置
const defaultGuideSteps = guideStepsConfig;
// 响应式进度（初始值为0）
const currentBigGroup = ref(0);
const currentSmallIndex = ref(0);

// 发送消息通知事件
const postToExtension = (type: string, data: any) => {
  window.postMessage({ type, data });  
};

// 调用当前WebView的方法
const callCurrentWebviewMethod = (methodName: string, params: any) => {
  const currentGroupConfig = guideStepsConfig[currentBigGroup.value];
  postToExtension('callWebviewMethod', {
    targetWebviewType: currentGroupConfig.webviewType,
    methodName,
    params,
  });
};

// 打开新WebView并显示弹窗
const openNextWebview = (nextBigGroup: number) => {
  const nextGroupConfig = getNextBigGroupConfig(currentBigGroup.value);
  if (!nextGroupConfig) return;
  postToExtension('openWebviewWithGuide', {
    webviewType: nextGroupConfig.webviewType,
    bigGroup: nextBigGroup,
    smallIndex: 0, // 新组从第一步开始
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

  // 1. 更新进度到globalState
  await setGuideProgress(newBig, newSmall);
  // 2. 调用当前步骤的方法（上一步也可触发方法，按需调整）
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
  const isLastInGroup = newSmall === currentGroupConfig.steps.length - 1;

  // 1. 调用当前步骤的方法

  // 2. 更新进度
  if (isLastInGroup) {
    // 当前组最后一步：打开下一个WebView
    openNextWebview(newBig);
    newBig++;
    newSmall = 0;
    await setGuideProgress(newBig, newSmall);
    // 3. 打开新WebView并同步进度
  } else {
    // 本组内下一步
    newSmall++;
    await setGuideProgress(newBig, newSmall);
    const currentStepConfig = getCurrentStepConfig(newBig, newSmall);
    if (currentStepConfig?.method) {
      callCurrentWebviewMethod(currentStepConfig.method, currentStepConfig.methodParams);
    }
  }
};

// 跳过全部：关闭所有WebView的弹窗
const handleSkipAll = () => {
  updateWelcomeState({
    key: 'guide.state',
    value: false,
  });
  postToExtension('closeAllGuideModal', null);
  emit('update:visible', false);
};

// 开始体验：关闭所有弹窗
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

// ========== VSCode globalState 通信方法 ==========

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
  // 同步更新本地响应式数据
  currentBigGroup.value = bigGroup;
  currentSmallIndex.value = smallIndex;
};

const handleMaskClick = () => {
  if (props.closeOnMaskClick) emit('update:visible', false);
};

// ========== 生命周期 ==========
onMounted(() => {
  // 组件挂载后读取进度
  if (props.visible) {
    getGuideProgress();
  }
});

// 监听弹窗显示状态：显示时读取进度
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      getGuideProgress(); // 每次打开弹窗都读取最新的globalState进度
    }
  },
  { immediate: true },
);
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
  z-index: 999999999999;
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
}

// 三角基础样式
.guide-triangle {
  position: absolute;
  width: 0;
  height: 0;
  border: 8px solid transparent;
  z-index: 99999;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  pointer-events: none;
}

// 1. 向右三角（外层容器右侧外部）
.triangle-right {
  right: -16px; // 容器右边缘外8px
  top: 50%;
  transform: translateY(-50%);
  border-left-color: #292929;
  filter: drop-shadow(0 2px 4px rgba(95, 95, 95, 0.15));
}

// 2. 向左三角（外层容器左侧外部）
.triangle-left {
  left: -16px; // 容器左边缘外8px
  top: 50%;
  transform: translateY(-50%);
  border-right-color: #292929;
  filter: drop-shadow(0 2px 4px rgba(95, 95, 95, 0.15));
}

// 3. 向上三角（外层容器顶部外部）
.triangle-top {
  top: -16px; // 容器上边缘外8px
  left: 50%;
  transform: translateX(-50%);
  border-bottom-color: #292929;
  filter: drop-shadow(0 2px 4px rgba(95, 95, 95, 0.15));
}

// 4. 向下三角（外层容器底部外部）
.triangle-bottom {
  bottom: -16px; // 容器下边缘外8px
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
.progress-img {
  width: 12px;
  height: 12px;
  margin-right: 8px;
  object-fit: contain;
}

.progress-container {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  flex-wrap: nowrap;

  .progress-group {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-right: 8px;
  }

  .progress-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    transition: all 0.2s;

    &.completed-dot {
      border: 2px solid #ffffff;
      background: transparent;
    }

    &.active-dot {
      background: #ffffff;
      border: none;
      transform: scale(1.2);
    }

    &.unfinished-dot {
      background: #c0c4cc;
      border: none;
    }
  }

  .separator {
    color: #c0c4cc;
    margin: 0 12px;
    font-size: 12px;
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
  margin-top: 16px; // 增加按钮区间距，避免内容拥挤

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
