<template>
  <div class="guide-container">
    <!-- 主体内容 -->
    <div class="guide-main">
      <!-- 左侧步骤列表 -->
      <div class="guide-step">
        <div class="guide-step__header">
          <img class="header__image" :src="logo" />
          <div class="header__describe">
            <div class="describe__title">开始使用PyPTO Toolkit</div>
            <div class="describe__group">
              <div class="describe__detail">PyPTO 效率提升插件</div>
              <div class="describe__version">Version:1.0.0-alpha.17</div>
            </div>
          </div>
        </div>
        <d-alert v-if="!isLinux" type="warning" class="system-warning" :closeable="false"
          >无法在当前环境下运行Python文件，请配置Linux远程连接</d-alert
        >
        <div class="guide-step__list" v-if="steps.length">
          <!-- 步骤1 -->
          <div class="step-item" :class="{ active: 'step1' === activeStepId, completed: steps[0].completed }">
            <div class="step-header" @click="handleStepClick('step1')">
              <div class="step-header-left">
                <input type="checkbox" class="custom-checkbox" :checked="steps[0].completed" @click.stop="toggleCheckbox(0)" />
                <span class="step-title">{{ steps[0].title }}</span>
              </div>
              <div class="step-header-right"></div>
            </div>

            <div class="step-content" :class="{ expanded: expandedStepId === 'step1' }">
              <div class="step-content__run-python">
                <i class="icon-json"></i>
                <div class="step-description">python3 test hello_world.py</div>
              </div>
              <button
                class="step-content__run-button"
                :class="{ button__disable: !isLinux }"
                @click="getInitPythonProject()"
                :disabled="!isLinux"
              >
                去打开
              </button>
            </div>
          </div>

          <!-- 步骤2 -->
          <div class="step-item" :class="{ active: 'step2' === activeStepId, completed: steps[1].completed }">
            <div class="step-header" @click="handleStepClick('step2')">
              <div class="step-header-left">
                <input type="checkbox" class="custom-checkbox" :checked="steps[1].completed" @click.stop="toggleCheckbox(1)" />

                <span class="step-title">{{ steps[1].title }}</span>
              </div>
              <div class="step-header-right"></div>
            </div>
            <div class="step-content" :class="{ expanded: expandedStepId === 'step2' }">
              <p class="step-description">控制流图</p>
              <p class="step-description">导航系统</p>
              <p class="step-description">计算图</p>
              <p class="step-description">泳道图</p>
              <button class="step-content__run-button" :class="{ button__disable: !isLinux||!steps[0].completed}" @click="goToCheckResult" :disabled="!isLinux || !steps[0].completed">去查看</button>
            </div>
          </div>

          <!-- 步骤3 -->
          <div class="step-item" :class="{ active: 'step3' === activeStepId, completed: steps[2].completed }">
            <div class="step-header" @click="handleStepClick('step3')">
              <div class="step-header-left">
                <input type="checkbox" class="custom-checkbox" :checked="steps[2].completed" @click.stop="toggleCheckbox(2)" />
                <span class="step-title">{{ steps[2].title }}</span>
              </div>
              <div class="step-header-right"></div>
            </div>
            <div class="step-content" :class="{ expanded: expandedStepId === 'step3' }">
              <p class="step-description">查看三联动视图查看三联动视图查看三联动视图</p>
              <button class="step-content__run-button" :class="{ button__disable: !isLinux||!steps[1].completed}" @click="visible = true" :disabled="!isLinux || !steps[1].completed">去查看</button>

            </div>
          </div>
          <!-- 底部操作栏 -->
          <div class="action-bar">
            <!-- <button class="action-btn prev-btn" @click="prevStep" :disabled="isFirstStep"><i class="fa fa-chevron-left"></i> 上一步</button> -->
            <button class="action-btn next-btn" @click="nextStep" :disabled="isLastStep">下一步 <i class="fa fa-chevron-right"></i></button>
            <!-- <button class="action-btn complete-btn" @click="markAsCompleted">标记为完成</button> -->
          </div>
        </div>
      </div>

      <!-- 右侧图片预览区 -->
      <div class="preview-area">
        <div class="preview-area__image-bg"></div>
        <img class="preview-image" v-if="activeStep" :src="activeStep.image" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { openControlFlow } from '@/apis/opener';
import { getInitPythonProject, getWelcomeState, isLinuxEnvironment, updateWelcomeState } from '@/apis/welcome';
import { ref, computed, watch, onMounted } from 'vue';

// 模拟静态资源路径
const staticPath = ref(window.staticPath || '');
const sortUp = ref(`${staticPath.value}/static-assets/nofile.png`);
const logo = ref(`${staticPath.value}/static-assets/logo.png`);
const logo2 = ref(`${staticPath.value}/static-assets/logo.png`);
const visible = ref(false);
const isLinux = ref(true);

// 1. 定义步骤数据类型
interface GuideStep {
  id: string;
  index: number; // 步骤序号（1/2/3）
  title: string;
  image: string;
  completed: boolean;
}

// 2. 初始步骤数据
const defaultSteps = ref<GuideStep[]>([
  {
    id: 'step1',
    index: 1,
    title: '打开并运行样例工程',
    image: sortUp.value,
    completed: false,
  },
  {
    id: 'step2',
    index: 2,
    title: '查看运行结果',
    image: logo.value,
    completed: false,
  },
  {
    id: 'step3',
    index: 3,
    title: '查看三联动视图',
    image: logo2.value,
    completed: false,
  },
]);

// 3. 响应式数据
const isDarkTheme = ref<boolean>(localStorage.getItem('guideTheme') === 'dark');
const steps = ref<GuideStep[]>([]);
const activeStepId = ref<string>('');
const expandedStepId = ref<string>('');

// 4. 计算属性
const activeStep = computed(() => {
  return steps.value.find((step) => step.id === activeStepId.value) || steps.value[0];
});

const currentStepIndex = computed(() => {
  return steps.value.findIndex((step) => step.id === activeStepId.value);
});

const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);

// 5. 核心方法
// 初始化步骤数据
const initSteps = async () => {
  const savedSteps = (await getWelcomeState({
    key: 'guideSteps',
  })) as string;
  if (savedSteps) {
    steps.value = JSON.parse(savedSteps);
  } else {
    steps.value = [...defaultSteps.value];
  }
  activeStepId.value = steps.value[0].id;
  expandedStepId.value = steps.value[0].id;
};

// 切换主题
const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;
  localStorage.setItem('guideTheme', isDarkTheme.value ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', isDarkTheme.value ? 'dark' : 'light');
};

// 点击步骤头部（激活+折叠）
const handleStepClick = (stepId: string) => {
  activeStepId.value = stepId;
  expandedStepId.value = expandedStepId.value === stepId ? '' : stepId;
};

// 点击Checkbox切换完成状态（简化参数，直接取反）
const toggleCheckbox = (index: number) => {
  steps.value[index].completed = !steps.value[index].completed;
  // 可选：手动触发持久化（也可依赖watch）
  // localStorage.setItem('guideSteps', JSON.stringify(steps.value));
};

// 上一步
const prevStep = () => {
  if (!isFirstStep.value) {
    const prevIndex = currentStepIndex.value - 1;
    activeStepId.value = steps.value[prevIndex].id;
    expandedStepId.value = steps.value[prevIndex].id;
  }
};

// 下一步
const nextStep = () => {
  if (!isLastStep.value) {
    const nextIndex = currentStepIndex.value + 1;
    activeStepId.value = steps.value[nextIndex].id;
    expandedStepId.value = steps.value[nextIndex].id;
  }
};

// 标记当前步骤为完成/取消
const markAsCompleted = async () => {
  const targetStep = steps.value.find((step) => step.id === activeStepId.value);
  if (targetStep) {
    // 移除错误的越界代码
    // steps.value[targetStep.index].completed = true;
    targetStep.completed = !targetStep.completed;
    await updateWelcomeState({
      key: 'guideSteps',
      value: JSON.stringify(steps.value),
    });
  }
};

function goToCheckResult() {
    updateWelcomeState({
        key: 'guide.state',
        value:true
    })
    //     openControlFlow({
    //   controlFlowPath: 'M:\Users\s30075542\AppData\demo\pypto-tools\vscode_plugins\pypto_toolkit\src\testdata',
    //   outputPath: node.outputPath,
    // });
    // console.log({
    //   computeGraphPath: node.absolutePath,
    //   outputPath: node.pathName ? node.outputPath : undefined,
    //   pathName: node.pathName,
    // });
}
// 6. 监听&初始化
onMounted(async () => {
//   isLinux.value = await isLinuxEnvironment();
  initSteps();
  toggleTheme();
});

// 修正：监听ref对象steps，而非steps.value
watch(
  steps, // 关键修正：监听响应式对象本身
  async (newVal) => {
    await updateWelcomeState({
      key: 'guideSteps',
      value: JSON.stringify(newVal),
    });
  },
  { deep: true }, // 深度监听对象内部属性变化
);
</script>

<style scoped lang="less">
/* 容器样式 */
.guide-container {
  width: 100vw;
  height: 100vh;
  background-color: var(--color-bg);
  overflow: hidden;
  padding: 290px;

  /* 主体内容 */
  .guide-main {
    display: flex;
    justify-content: space-around;
    height: 100%;
    width: 100%;

    .guide-step {
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 500px;
      width: 50%;
      height: 100%;
      .system-warning {
        margin-top: 20px;
        width: 410px;
        height: 26px;
        font-size: 13px;
        font-weight: 400;
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
          justify-content: space-around;
          flex-wrap: nowrap;
          font-weight: 400;

          .describe__title {
            color: var(--devui-title-text);
            font-size: 24px;
            line-height: 32px;
          }

          .describe__group {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
            gap: 8px;
            align-items: center;
            font-weight: 400;

            .describe__detail {
              color: var(--devui-primary-text);
              font-size: 13px;
              line-height: 32px;
            }

            .describe__version {
              padding: 4px 8px;
              box-sizing: border-box;
              color: var(--devui-primary-text);
              font-size: 12px;
              line-height: 16px;
              border-radius: 17px;
              background: var(--welcome-header-title-version);
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
          border: 1px solid var(--color-border);
          border-radius: 8px;
          cursor: pointer;
          width: 380px;
          padding: 0 18px;
        }

        .active {
          background-color: var(--devui-node-bg);
        }

        .active .step-header {
          .step-title {
            color: var(--devui-title-text);
          }
        }

        .active .step-content {
          .step-description {
            color: var(--devui-title-text);
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

        .step-header:hover {
          background-color: var(--color-hover);
        }

        .step-header-left {
          display: flex;
          align-items: center;
          width: 100%;
          gap: 10px;

          .step-title {
            color: var(--devui-secondary-text);
            font-size: 16px;
            font-weight: 700;
            line-height: 24px;
          }

          .custom-checkbox {
            /* 隐藏原生checkbox */
            appearance: none;
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 1px solid white;
            cursor: pointer;
            position: relative;
            transition: all 0.2s ease;
          }

          /* checkbox选中状态 */
          .custom-checkbox:checked {
            background-color: #317af7;
            border-color: #317af7;
          }

          /* 选中后添加√图标（伪元素实现） */
          .custom-checkbox:checked::after {
            content: '✓';
            position: absolute;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: var(--color-checkbox-check);
            font-size: 12px;
            font-weight: bold;
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
            gap: 10px;
            padding: 8px;
            background-color: var(--devui-primary-button-bg);
            color: var(--devui-primary-text);
            border-radius: 8px;
            border: none;
            cursor: pointer;
          }
          .button__disable {
            background-color: #003d83;
            color: #666666;
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
              line-height: 20px;
              font-size: 13px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: rgba(241, 225, 5, 0.808);
            }
          }
        }

        .step-description {
          line-height: 20px;
          font-size: 13px;
          color: var(--color-text);
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
      position: relative;

      .preview-area__image-bg {
        position: absolute;
        width: 800px;
        height: 450px;
        opacity: 0.4;
        background: var(--welcome-header-right-imge-bg);
        border-radius: 12px;
        filter: blur(120px);
        z-index: 1; // 低于图片层级
      }

      .preview-image {
        width: 800px;
        height: 450px;
        object-fit: fill;
        z-index: 2; // 高于背景层
        border: 1.5px solid;
        border-radius: 12px;
        border-image: linear-gradient(#0fd979, #4475f5, #ff6c96, #c75bef) 30 30;
      }
    }
  }
}

.step-item.completed .step-title {
  color: var(--color-completed);
}

.step-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
}

/* 底部操作栏 */
.action-bar {
  width: 100%;
  display: flex;
  gap: 12px;
  align-items: start;
}

.action-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.prev-btn,
.next-btn {
  background-color: var(--color-btn-bg);
  color: var(--devui-select-active-border-color);
}

.prev-btn:hover,
.next-btn:hover {
  background-color: var(--color-btn-hover);
}

.prev-btn:disabled,
.next-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.complete-btn {
  background-color: var(--color-btn-complete);
  color: white;
}

.complete-btn:hover {
  background-color: var(--color-btn-complete-hover);
}

.complete-btn.completed {
  background-color: var(--color-border);
  color: var(--color-text);
  cursor: default;
}

.boot-step-tips {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 999;
}
</style>
