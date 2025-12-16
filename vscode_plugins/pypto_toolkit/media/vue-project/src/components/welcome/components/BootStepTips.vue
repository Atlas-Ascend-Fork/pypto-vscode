<template>
  <!-- 遮罩层 -->
  <div v-if="visible" class="guide-mask" @click="handleMaskClick">
    <!-- 气泡样式弹窗容器 -->
    <div class="guide-popup" :style="popupStyle">
      <!-- 顶部进度指示器：每组显示对应步数的小圆点 -->
      <div class="progress-container">
        <template v-for="(group, groupIdx) in guideSteps" :key="groupIdx">
          <img :src="group.imgUrl" class="progress-img"></img>
          <div class="progress-group">
            <div v-for="(step, stepIdx) in group.steps" :key="stepIdx" class="progress-dot"
              :class="getDotItemStatus(groupIdx, stepIdx)"></div>
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
</template>

<script setup lang="ts">
import { getWelcomeState, updateWelcomeState } from '@/apis/welcome';
import { computed, ref, watch, onMounted } from 'vue';
import type { CSSProperties } from 'vue';
import { getCurrentStepConfig, getNextBigGroupConfig, guideStepsConfig } from '../guideStepsConfig';


// 定义步骤类型
interface GuideStepItem {
  title: string;
  content: string;
}
interface GuideBigGroup {
  groupName: string;
  steps: GuideStepItem[];
  imgUrl: string
}

// 组件Props
const props = defineProps<{
  visible: boolean;
  position?: Partial<{ top: string; left: string; right: string; bottom: string }>;
  guideSteps?: GuideBigGroup[];
  closeOnMaskClick?: boolean;
  width?: string;
}>();

// 弹窗样式
const popupStyle = computed<CSSProperties>(() => {
  const defaultStyle: CSSProperties = {
    width: props.width || '420px',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    borderRadius: '16px',
  };
  if (props.position) {
    const customStyle = { ...defaultStyle };
    if (props.position.top || props.position.bottom) delete customStyle.top;
    if (props.position.left || props.position.right) delete customStyle.left;
    delete customStyle.transform;
    return { ...customStyle, ...props.position };
  }
  return defaultStyle;
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
  window.postMessage({ type, data })
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
  const currentStepConfig = getCurrentStepConfig(newBig, newSmall);
  if (currentStepConfig?.method) {
    callCurrentWebviewMethod(currentStepConfig.method, currentStepConfig.methodParams);
  }

  // 2. 更新进度
  if (isLastInGroup) {
    // 当前组最后一步：打开下一个WebView
    newBig++;
    newSmall = 0;
    await setGuideProgress(newBig, newSmall);
    // 3. 打开新WebView并同步进度
    openNextWebview(newBig);
  } else {
    // 本组内下一步
    newSmall++;
    await setGuideProgress(newBig, newSmall);
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
  // 监听插件主线程的消息（接收globalState进度）
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'guideProgress') {
      // 更新本地进度为globalState中的值
      currentBigGroup.value = message.data.currentBigGroup;
      currentSmallIndex.value = message.data.currentSmallIndex;
    }
  });

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
  background-color: rgba(226, 226, 226, 0);
  z-index: 9999;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

// 气泡弹窗容器
.guide-popup {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #292929;
  padding: 28px;
  box-shadow: 0 8px 24px rgba(95, 95, 95, 0.15);
  box-sizing: border-box;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;

  // 进度指示器容器
  .progress-container {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    flex-wrap: wrap; // 兼容步骤多的情况

    .progress-img {
      display: flex;
      align-items: center; 
      justify-items: center;     
      width: 16px;
      height: 16px;
      margin-right: 6px;
    }

    // 单个大组的圆点容器
    .progress-group {
      line-height: 20px;
      display: flex;
      align-items: center;
      gap: 6px; // 组内圆点间距
    }

    // 进度圆点
    .progress-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      transition: all 0.2s;

      // 已完成（白色边框 + 透明背景）
      &.completed-dot {
        border: 2px solid #ffffff;
        background: transparent;
      }

      // 当前（高亮：主色）
      &.active-dot {
        background: #ffffff;
        border: none;
        transform: scale(1.2); // 当前圆点略放大
      }

      // 未完成（灰色）
      &.unfinished-dot {
        background: #c0c4cc;
        border: none;
      }
    }

    // 组分隔符
    .separator {
      color: #c0c4cc;
      margin: 0 12px; // 分隔符间距加大，区分组
      font-size: 12px;
    }
  }

  // 内容区
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

  // 按钮栏
  .btn-container {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;

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

    // 跳过全部按钮
    .skip-btn {
      background: #57585a;
      color: #e2e2e2;
    }

    // 上一步按钮
    .prev-btn {
      background: #f5f7fa;
      color: #303133;
    }

    // 下一步/了解下一组/开始体验按钮
    .next-btn {
      background: #409eff;
      color: #fff;
    }
  }
}
</style>
