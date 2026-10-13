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
  <div class="guide-container">
    <!-- 主体内容 -->
    <div class="guide-main">
      <div class="guide-panel">
        <!-- 左侧步骤列表 -->
        <div class="guide-step">
          <div class="guide-step__header">
            <img class="header__image" :src="logo" />
            <div class="header__describe">
              <div class="describe__title">{{ t('welcome.startUsingPyPTOToolkit') }}</div>
              <div class="describe__group">
                <div class="describe__detail">{{ t('welcome.pyptoEfficiencyPlugin') }}</div>
                <div class="describe__version">{{ t('welcome.version') }}:{{ pluginVersion }}</div>
              </div>
            </div>
          </div>
          <div class="guide-step__list" v-if="steps.length">
            <d-alert v-if="!isLinux" type="warning" class="system-warning"
              :class="{ warning__step1: 'step1' === activeStepId }" :closeable="false">{{
                t('welcome.linuxEnvironmentWarning') }}</d-alert>
            <!-- 步骤1 -->
            <div class="step-item" :class="{ active: 'step1' === activeStepId, completed: steps[0].completed }">
              <div class="step-header" @click="handleStepClick('step1')">
                <div class="step-header-left">
                  <img :src="hasCompletedImg" v-if="steps[0].completed" @click.stop="toggleCheckbox(0)"></img>
                  <img :src="hasNotCompletedImg" v-else @click.stop="toggleCheckbox(0)"></img>
                  <span class="step-title">{{ steps[0].title }}</span>
                </div>
                <div class="step-header-right"></div>
              </div>

              <div class="step-content" :class="{ expanded: expandedStepId === 'step1' }">
                <div class="step-content__run-python">
                  <img :src="pythonIcon" class="icon-json">
                  <div class="step-description">python3 hello_world.py</div>
                </div>
                <button class="step-content__run-button" :class="{ button__disable: !isLinux }" @click="runPythonFile"
                  :disabled="!isLinux">
                  {{ t('welcome.goToRun') }}
                </button>
              </div>
            </div>

            <!-- 步骤2 -->
            <div class="step-item" :class="{ active: 'step2' === activeStepId, completed: steps[1].completed }">
              <div class="step-header" @click="handleStepClick('step2')">
                <div class="step-header-left">
                  <img :src="hasCompletedImg" v-if="steps[1].completed" @click.stop="toggleCheckbox(1)"></img>
                  <img :src="hasNotCompletedImg" v-else="!skipAllStep2" @click.stop="toggleCheckbox(1)"></img>
                  <span class="step-title">{{ steps[1].title }}</span>
                </div>
                <div class="step-header-right"></div>
              </div>
              <div class="step-content" :class="{ expanded: expandedStepId === 'step2' }">
                <div class="step-content__item">
                  <img :src="controlFlowImg" alt="" />
                  <p class="step-description">{{ t('welcome.controlFlowChart') }}</p>
                </div>
                <div class="step-content__item">
                  <img :src="nativeImg" alt="" />
                  <p class="step-description">{{ t('welcome.navigationSystem') }}</p>
                </div>
                <div class="step-content__item">
                  <img :src="computeImg" alt="" />
                  <p class="step-description">{{ t('welcome.computationGraph') }}</p>
                </div>
                <div class="step-content__item">
                  <img :src="swimImg" alt="" />
                  <p class="step-description">{{ t('welcome.swimlaneChart') }}</p>
                </div>
                <button class="step-content__run-button" @click="goToCheckResult">
                  {{ t('welcome.goToView') }}
                </button>
              </div>
            </div>

            <!-- 步骤3 -->
            <div class="step-item" :class="{ active: 'step3' === activeStepId, completed: steps[2].completed }">
              <div class="step-header" @click="handleStepClick('step3')">
                <div class="step-header-left">
                  <img :src="hasCompletedImg" v-if="steps[2].completed" @click.stop="toggleCheckbox(2)"></img>
                  <img :src="hasNotCompletedImg" v-else="!skipAllStep2" @click.stop="toggleCheckbox(2)"></img>
                  <span class="step-title">{{ steps[2].title }}</span>
                </div>
                <div class="step-header-right"></div>
              </div>
              <div class="step-content" :class="{ expanded: expandedStepId === 'step3' }">
                <div class="step-content__item">
                  <p class="step-description step-description__weak">{{ t('welcome.step3Content') }}</p>
                </div>
                <button class="step-content__run-button" @click="goTocheckThreeColumn">
                  {{ t('welcome.goToView') }}
                </button>
              </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="action-bar">
              <button v-if="isAllChecked" class="action-btn next-btn" @click="nextStep" :disabled="isLastStep">
                {{ t('welcome.nextStep') }}
              </button>
              <button v-if="!isAllChecked" class="action-btn next-btn" @click="closeWelcomPage">
                {{ t('welcome.startExperience') }}
              </button>
              <d-checkbox :label="t('welcome.showGuideOnStartup')" class="open-page-checkbox" :isShowTitle="false"
                v-model="isOpenWithPyPto" />
            </div>
          </div>
        </div>

        <!-- 右侧图片预览区 -->
        <div class="preview-area" @mouseenter="pauseCarousel" @mouseleave="startCarousel">
          <!-- 投影区 -->
          <div class="preview-area__image-bg"></div>

          <!-- 图片预览区 -->
          <div class="preview-image-wrapper">
            <div class="preview-image-border">
              <!-- 轮播图片容器 -->
              <div class="carousel-image-container">
                <!-- 步骤1显示原有图片，步骤2显示轮播图片 -->
                <python-code-snippet-preview v-if="activeStep?.id === 'step1'"></python-code-snippet-preview>
                <img v-else-if="activeStep?.id === 'step3'" :src="step3Img" />
                <div v-else class="carousel-wrapper">
                  <!-- 轮播图片列表 -->
                  <img class="carousel-image" v-for="(img, idx) in images" :key="idx" :src="img"
                    :class="{ 'carousel-active': currentCarouselIndex === idx }" alt="轮播图${idx+1}" />
                </div>
              </div>
            </div>
          </div>

          <!-- 轮播指示器（小圆点+椭圆进度条） -->
          <div v-if="activeStep?.id === 'step2'" class="carousel-indicators">
            <div class="indicator-item" v-for="(img, idx) in images" :key="idx"
              :class="{ 'indicator-active': currentCarouselIndex === idx }" @click="switchCarousel(idx)"></div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { openControlFlow, openThreeColumnGraph } from '@/apis/opener';
import { getInitPythonProject, getPluginVersion, getProgramPath, getThreeColumnSamplePath, getUserRunRoot, getWelcomeState, isLinuxEnvironment, reductionResultsStep, reductionTreeColumnStep, updateWelcomeState } from '@/apis/welcome';
import { useViewServer } from '@/core/use-view-server';
import { WelcomeViewServer } from 'ext:/view/servers/welcom-server';
import { ref, computed, watch, onMounted, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import PythonCodeSnippetPreview from './components/PythonCodeSnippetPreview.vue';
const { t } = useI18n();
const { isDarkTheme } = inject('root');

// 模拟静态资源路径
const staticPath = ref(window.staticPath || '');
const logo = ref(`${staticPath.value}/static-assets/logo.png`);
const isLinux = ref(true);
const controlFlowImg = computed(() => `${window.staticPath}/static-assets/boot_steps/boot_steps_control${isDarkTheme.value ? '' : '-light'}.svg`)
const nativeImg = computed(() => `${window.staticPath}/static-assets/boot_steps/boot_steps_native${isDarkTheme.value ? '' : '-light'}.svg`);
const computeImg = computed(() => `${window.staticPath}/static-assets/boot_steps/boot_steps_compute${isDarkTheme.value ? '' : '-light'}.svg`);
const swimImg = computed(() => `${window.staticPath}/static-assets/boot_steps/boot_steps_swim${isDarkTheme.value ? '' : '-light'}.svg`);
const step3Img = computed(() => `${window.staticPath}/static-assets/boot_steps/index_page_step3_sanLian${isDarkTheme.value ? '' : '-light'}.png`);

const images = computed(() => {
  const themeSuffix = isDarkTheme.value ? '' : '-light';
  return [
    // 步骤2轮播图片（共4张）
    `${window.staticPath}/static-assets/boot_steps/index_page_step2_control${themeSuffix}.png`,
    `${window.staticPath}/static-assets/boot_steps/index_page_step2_native${themeSuffix}.png`,
    `${window.staticPath}/static-assets/boot_steps/index_page_step2_compute${themeSuffix}.png`,
    `${window.staticPath}/static-assets/boot_steps/index_page_step2_swim${themeSuffix}.png`
  ];
});
const pythonIcon = computed(() => `${window.staticPath}/static-assets/python.svg`)

// 轮播相关响应式数据
const currentCarouselIndex = ref(0); // 当前轮播索引
const carouselTimer = ref<NodeJS.Timeout | null>(null); // 轮播定时器
const carouselInterval = 2500; // 轮播间隔（2.5秒，可调整）

// 1. 自动轮播函数
const startCarousel = () => {
  // 只有步骤2激活时才启动轮播
  if (activeStepId.value !== 'step2' || carouselTimer.value) return;

  carouselTimer.value = setInterval(() => {
    currentCarouselIndex.value = (currentCarouselIndex.value + 1) % images.value.length;
  }, carouselInterval);
};

// 2. 暂停轮播
const pauseCarousel = () => {
  if (carouselTimer.value) {
    clearInterval(carouselTimer.value);
    carouselTimer.value = null;
  }
};

// 3. 手动切换轮播
const switchCarousel = (index: number) => {
  currentCarouselIndex.value = index;
  // 切换后重启定时器，避免快速点击
  pauseCarousel();
  startCarousel();
};


/** 步骤执行逻辑 */
const hasCompletedImg = ref(`${window.staticPath}/static-assets/boot_steps/boot_steps_welcome_completed.svg`);
const hasNotCompletedImg = ref(`${window.staticPath}/static-assets/boot_steps/boot_steps_welcome_not_completed.svg`);

// 1. 定义步骤数据类型
interface GuideStep {
  id: string;
  index: number; // 步骤序号（1/2/3）
  title: string;
  completed: boolean;
}

// 2. 初始步骤数据
const defaultSteps = ref<GuideStep[]>([
  {
    id: 'step1',
    index: 1,
    title: t('welcome.step1Title'),
    completed: false,
  },
  {
    id: 'step2',
    index: 2,
    title: t('welcome.step2Title'),
    completed: false,
  },
  {
    id: 'step3',
    index: 3,
    title: t('welcome.step3Title'),
    completed: false,
  },
]);


// 3. 响应式数据
const steps = ref<GuideStep[]>([]);
const activeStepId = ref<string>('');
const expandedStepId = ref<string>('');
const isOpenWithPyPto = ref(true)
const pluginVersion = ref('2.0.0')

// 4. 计算属性
const activeStep = computed(() => {
  return steps.value.find((step) => step.id === activeStepId.value) || steps.value[0];
});

const currentStepIndex = computed(() => {
  return steps.value.findIndex((step) => step.id === activeStepId.value);
});

const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);
const isAllChecked = computed(() => steps.value.some((step) => !step.completed));

async function runPythonFile() {
  getInitPythonProject()
  steps.value[0].completed = true
  nextStep()
}

// 点击步骤头部（激活+折叠）
const handleStepClick = (stepId: string) => {
  activeStepId.value = stepId;
  expandedStepId.value = expandedStepId.value === stepId ? '' : stepId;
};

// 点击Checkbox切换完成状态
const toggleCheckbox = (index: number) => {
  steps.value[index].completed = !steps.value[index].completed;
};

// 下一步
const nextStep = () => {
  if (!isLastStep.value) {
    const nextIndex = currentStepIndex.value + 1;
    activeStepId.value = steps.value[nextIndex].id;
    expandedStepId.value = steps.value[nextIndex].id;
  }
};
//开始体验
function closeWelcomPage() {
  server.closeWebview();
}

/**
 * 打开运行结果进行引导
 */
async function goToCheckResult() {
  updateWelcomeState({
    key: 'guide.state',
    value: true,
  });
  await updateWelcomeState({
    key: 'guide.currentBigGroup',
    value: 0,
  });
  await updateWelcomeState({
    key: 'guide.currentSmallIndex',
    value: 0,
  });
  openControlFlow({
    controlFlowPath: `${await getProgramPath()}`,
    outputPath: `${await getUserRunRoot()}`,
    isBootStep: true
  });
}

async function goTocheckThreeColumn() {
  updateWelcomeState({
    key: 'guide.state',
    value: true,
  });
  await updateWelcomeState({
    key: 'guide.currentBigGroup',
    value: 0,
  });
  await updateWelcomeState({
    key: 'guide.currentSmallIndex',
    value: 0,
  });
  openThreeColumnGraph({
    isBootStep: true,
    sameplePath: await getThreeColumnSamplePath()
  })
}


// 第二部查看运行结果是否完成
const { server } = useViewServer<WelcomeViewServer>();
const { skipAllStep2, skipAllStep3 } = server;


// 初始化步骤数据
const initSteps = async () => {

  const stepRunPython = (await getWelcomeState({
    key: 'guideSteps-runPython',
  })) as boolean;
  if (stepRunPython) {
    defaultSteps.value[0].completed = stepRunPython;
  }
  const stepSanlian = (await getWelcomeState({
    key: 'welcomeView.Sanlian',
  })) as boolean;
  if (stepSanlian) {
    defaultSteps.value[2].completed = stepSanlian;
  }
  defaultSteps.value[1].completed = skipAllStep2.value;
  steps.value = [...defaultSteps.value];
  const isOpenWith = (await getWelcomeState({
    key: 'guideSteps-isOpenWithPyPto',
  })) as boolean;
  if (isOpenWith === false) {
    isOpenWithPyPto.value = false
  }
  pluginVersion.value = await getPluginVersion()

  isLinux.value = await isLinuxEnvironment();
  if (!isLinux.value) {
    await updateWelcomeState({
      key: 'guideSteps-runPython',
      value: true,
    });
    steps.value[0].completed = true
  }
  // 初始化展开步骤id
  steps.value.some((item) => {
    activeStepId.value = item.id;
    expandedStepId.value = item.id;
    return !item.completed
  })

  watch(skipAllStep2, (newValue) => {
    if (newValue) {
      steps.value[1].completed = newValue;
      nextStep()
    }
  });
  watch(skipAllStep3, (newValue) => {
    if (newValue) {
      steps.value[2].completed = newValue;
    }
  });
};
onMounted(async () => {
  initSteps();
  // 初始化后检查是否需要启动轮播
  if (activeStepId.value === 'step2') {
    startCarousel();
  }

});

watch(
  steps,
  async (newVal) => {
    await updateWelcomeState({
      key: 'guideSteps-runPython',
      value: newVal[0].completed,
    });
    await updateWelcomeState({
      key: 'welcomeView.skipAllStep2',
      value: newVal[1].completed,
    });
    await updateWelcomeState({
      key: 'welcomeView.skipAllStep3',
      value: newVal[2].completed,
    });
    await updateWelcomeState({
      key: 'welcomeView.Sanlian',
      value: newVal[2].completed,
    });
    if (!newVal[1].completed) {
      reductionResultsStep()
    }
    if (!newVal[2].completed) {
      reductionTreeColumnStep()
    }
  },
  { deep: true },
);

watch(
  isOpenWithPyPto,
  async (newVal) => {
    await updateWelcomeState({
      key: 'guideSteps-isOpenWithPyPto',
      value: newVal
    });
  },
  { deep: true },
);

// 监听步骤切换，控制轮播启停
watch(activeStepId, (newStepId) => {
  if (newStepId === 'step2') {
    startCarousel(); // 步骤2激活时启动轮播
  } else {
    pauseCarousel(); // 离开步骤2时暂停轮播
  }
});
</script>

<style scoped lang="less">
/* 容器样式 */
.guide-container {
  width: 100vw;
  height: 100vh;

  /* 主体内容 */
  .guide-main {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
    min-width: 1400px;

    .guide-panel {
      width: 1300px;
      display: flex;
      justify-content: space-between;
      align-items: start;
    }

    /* 左侧步骤区 */
    .guide-step {
      display: flex;
      flex-direction: column;
      align-items: start;
      width: 500px;
      min-height: 450px;
      width: 40%;
      height: 100%;

      .system-warning {
        height: 26px;
        font-size: 13px;
        font-weight: 400;
        padding: 0 0 0 4px;
        display: flex;
        justify-content: start;
        align-items: center;
      }

      .warning__step1 {
        margin-bottom: 24px;
      }

      /* 左侧列表标题部分 */
      .guide-step__header {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 24px;
        width: 100%;

        .header__image {
          width: 108px;
          height: 108px;
        }

        .header__describe {
          display: flex;
          height: 100%;
          flex-direction: column;
          justify-content: start;
          flex-wrap: nowrap;
          font-weight: 400;
          gap: 10px;

          .describe__title {
            color: var(--devui-title-text); // 标题文字（明暗适配）
            font-size: 24px;
            line-height: 32px;
            font-weight: 700;

          }

          .describe__group {
            display: flex;
            flex-direction: row;
            gap: 8px;
            align-items: center;
            font-weight: 400;

            .describe__detail {
              color: var(--devui-primary-text); // 主要文字
              font-size: 13px;
              line-height: 32px;
            }

            .describe__version {
              padding: 4px 8px;
              box-sizing: border-box;
              color: var(--devui-primary-text); // 主要文字
              font-size: 12px;
              line-height: 16px;
              border-radius: 17px;
              background: var(--welcome-header-title-version); // 版本渐变背景（主题变量）
            }
          }
        }
      }

      /* 左侧步骤列表 */
      .guide-step__list {
        padding-top: 20px;
        display: flex;
        flex-direction: column;

        .step-item {
          border-radius: 8px;
          cursor: pointer;
          width: 380px;
          padding: 0 18px;
        }

        .active {
          background-color: var(--devui-nest-bg); // 节点背景（激活态）
        }

        .active .step-header {
          .step-title {
            color: var(--devui-title-text); // 标题文字
          }
        }

        .active .step-content {
          padding-left: 28px;

          .step-description {
            color: var(--devui-title-text); // 标题文字
          }

          .step-description__weak {
            color: var(--devui-secondary-text); // 标题文字
            font-size: 13px;
            font-weight: 400;
          }

          .step-content__item {
            display: flex;
            gap: 6px;
          }
        }

        /* 步骤头部 */
        .step-header {
          padding-top: 18px;
          padding-bottom: 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .step-header-left {
          display: flex;
          align-items: center;
          width: 100%;
          gap: 10px;

          .step-title {
            color: var(--devui-secondary-text); // 次要文字
            font-size: 16px;
            font-weight: 700;
            line-height: 24px;
          }
        }

        /* 步骤内容（折叠面板） */
        .step-content {
          max-height: 0;
          overflow: hidden;
          padding: 0 16px;

          .step-content__run-button {
            width: 74px;
            height: 28px;
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: center;
            margin-bottom: 6px;
            gap: 10px;
            padding: 8px;
            background-color: var(--devui-primary-button-bg);
            color: var(--devui-primary-tooltip-text);
            border-radius: 8px;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s ease;
          }

          .step-content__run-button:hover {
            background-color: var(--devui-primary-button-hover-bg);
          }

          .button__disable,
          .button__disable:hover {
            background-color: var(--devui-primary-button-disabled-bg);
            color: var(--devui-primary-text);
            user-select: none;
            cursor: not-allowed;
          }
        }

        .step-content.expanded {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: none;
          padding-bottom: 16px;

          .step-content__run-python {
            display: flex;
            align-items: center;
            gap: 8px;

            .icon-json {
              width: 16px;
              height: 16px;
              line-height: 20px;
              font-size: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: var(--devui-yellow-60); // 黄色主题色
            }
          }
        }

        .step-description {
          line-height: 20px;
          font-size: 13px;
          color: var(--devui-primary-text); // 主要文字
          opacity: 0.9;
        }
      }
    }

    /* 右侧预览区 */
    .preview-area {
      flex: 1;
      display: flex;
      justify-content: start;
      align-items: center;
      padding: 20px;
      min-width: 800px;
      min-height: 450px;
      position: relative;

      .preview-area__image-bg {
        position: absolute;
        width: 800px;
        height: 450px;
        opacity: 0.2;
        background: var(--welcome-header-right-imge-bg); // 预览区背景渐变（主题变量）
        border-radius: 12px;
        filter: blur(120px);
        z-index: 1;
      }

      /* 外层容器 */
      .preview-image-wrapper {
        width: 800px;
        height: 450px;
        padding: 1px;
        /* 渐变边框厚度（1px） */
        border-radius: 12px;
        /* 统一圆角 */
        background: linear-gradient(135deg,
            rgba(15, 217, 119, 0.4) 0%,
            rgba(15, 217, 119, 0.1) 40%,
            rgba(199, 91, 239, 0.1) 60%,
            rgba(234, 91, 239, 0.4) 100%);
        overflow: hidden;
        box-sizing: border-box;
        z-index: 2;
        position: relative;

        .preview-image-border {
          /* 避免轮播图片时渐变背景闪烁 */
          background-color: var(--devui-global-bg);

          /* 轮播图片容器 */
          .carousel-image-container {
            width: 100%;
            height: 100%;
          }

        }
      }

      /* 中间边框层（固定，不随轮播变化） */
      .preview-image-border {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        border: 8px solid var(--devui-card-bg);
        border-radius: 11px;
        overflow: hidden;
        position: relative;
      }


      /* 通用预览图片样式 */
      .preview-image {
        width: 100%;
        height: 100%;
        object-fit: fill;
        display: block;
        box-shadow: var(--devui-select-shadow); // 下拉阴影（主题变量）
        border-radius: 1px;
      }

      /* 轮播容器 */
      .carousel-wrapper {
        width: 100%;
        height: 100%;
        position: relative;
      }

      /* 轮播图片样式 */
      .carousel-image {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        object-fit: fill;
        opacity: 0;
        transition: opacity 0.5s ease;
        border-radius: 1px;
        box-shadow: var(--devui-select-shadow);
      }

      /* 激活的轮播图片 */
      .carousel-image.carousel-active {
        opacity: 1;
      }

      /* 轮播指示器样式 */
      .carousel-indicators {
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10;
      }

      /* 指示器小圆点 */
      .indicator-item {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--welcome-banner-point);
        cursor: pointer;
        transition: all 0.3s ease;
      }

      /* 激活的指示器（椭圆长条） */
      .indicator-item.indicator-active {
        width: 20px;
        height: 8px;
        border-radius: 4px; // 椭圆效果
        background-color: var(--welcome-banner-long);
      }
    }
  }
}

.step-item.completed .step-title {
  color: var(--devui-status-success-text); // 成功文字色
}

.step-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--devui-primary-text); // 主要文字
}

/* 底部操作栏 */
.action-bar {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  margin-top: 24px;
}

.action-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: rgba(255, 255, 255, 0);
}

.prev-btn,
.next-btn {
  color: var(--devui-select-active-border-color); // 选中边框色（文字）
  transition: background-color 0.2s ease;
  background-color: rgba(255, 255, 255, 0);

}

:deep(.devui-checkbox__label-text) {
  color: var(--devui-secondary-text) !important;
}

.prev-btn:disabled,
.next-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.complete-btn {
  background-color: var(--devui-status-success-bg); // 成功背景
  color: var(--devui-primary-tooltip-text); // 提示文字（白/灰）
}

.complete-btn:hover {
  background-color: var(--devui-status-success-bg-weak); // 成功背景弱化
}

.complete-btn.completed {
  background-color: var(--devui-split-line-deep); // 深分割线
  color: var(--devui-primary-text); // 主要文字
  cursor: default;
}

.boot-step-tips {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 999;
  color: var(--devui-title-text); // 标题文字
}

:deep(.active) {
  .devui-checkbox__material {
    background: var(--devui-primary-button-bg) !important;
  }
}
</style>