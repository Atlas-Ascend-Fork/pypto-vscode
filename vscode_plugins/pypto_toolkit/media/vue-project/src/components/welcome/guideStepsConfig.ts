import { ref } from 'vue';

const controlFlowImg = ref(`${window.staticPath}/static-assets/boot_steps_control.svg`);
const native = ref(`${window.staticPath}/static-assets/boot_steps_native.svg`);
const computeImg = ref(`${window.staticPath}/static-assets/boot_steps_compute.svg`);
const swim = ref(`${window.staticPath}/static-assets/boot_steps_swim.svg`);

// 定义单个步骤的配置类型
export interface GuideStepConfig {
  title: string; // 步骤标题（国际化key）
  content: string; // 步骤内容（国际化key）
  method?: string; // 该步骤要调用的WebView内方法名（如openSidebar）
  methodParams?: Record<string, any>; // 调用方法的参数
  targetDomId: string; // 目标引导DOM的ID
  showTriangle: boolean; // 是否显示引导三角
  triangleDirection: 'top' | 'bottom' | 'left' | 'right'; // 三角方向（上/下/左/右）
}

// 定义大组配置类型
export interface GuideBigGroupConfig {
  groupName: string; // 大组名称（国际化key）
  webviewType: 'controlFlow' | 'navigation' | 'computeGraph' | 'swimlaneGraph'; // 对应WebView类型
  openWebviewFn?: string; // 打开该WebView的方法
  openWebviewParams?: Record<string, any> | null; // 打开WebView的参数
  steps: GuideStepConfig[]; // 该组的小步骤配置
  imgUrl: string;
}

// 全局引导步骤配置（4个大组）
export const guideStepsConfig: GuideBigGroupConfig[] = [
  // 第一组：控制流
  {
    groupName: 'bootStep.controlFlow.groupName',
    webviewType: 'controlFlow',
    openWebviewParams: { outputPath: '', controlFlowPath: '' }, // 实际参数按需传
    imgUrl: controlFlowImg.value,
    steps: [
      {
        title: 'bootStep.controlFlow.step1.title',
        content: 'bootStep.controlFlow.step1.content',
        targetDomId: 'boot-steps-controlFlow',
        method: 'checkControlFlow',
        showTriangle: false,
        triangleDirection: 'bottom',
      },
      {
        title: 'bootStep.controlFlow.step2.title',
        content: 'bootStep.controlFlow.step2.content',
        targetDomId: 'boot-steps-controlFlow-right-panel',
        method: 'bootStepOpenSideBar',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: 'bootStep.controlFlow.step3.title',
        content: 'bootStep.controlFlow.step3.content',
        targetDomId: 'boot-steps-controlFlow-search',
        method: 'bootStepSearch',
        showTriangle: true,
        triangleDirection: 'top',
      },
    ],
  },
  // 第二组：导航系统
  {
    groupName: 'bootStep.navigation.groupName',
    webviewType: 'navigation',
    openWebviewFn: 'openComputeGraph',
    imgUrl: native.value,
    openWebviewParams: null,
    steps: [
      {
        title: 'bootStep.navigation.step1.title',
        content: 'bootStep.navigation.step1.content',
        method: 'viewNavigationHistory',
        methodParams: {},
        targetDomId: 'boot-steps-navbar-history',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: 'bootStep.navigation.step2.title',
        content: 'bootStep.navigation.step2.content',
        method: 'loadNavMenu',
        methodParams: {},
        targetDomId: 'boot-steps-navbar-open-com-graph',
        showTriangle: true,
        triangleDirection: 'top',
      },
    ],
  },
  // 第三组：计算图
  {
    groupName: 'bootStep.computeGraph.groupName',
    webviewType: 'computeGraph',
    openWebviewFn: 'openSwimlaneGraph',
    imgUrl: computeImg.value,
    openWebviewParams: { outputPath: '', computeGraphPath: '', pathName: 'compute' },
    steps: [
      {
        title: 'bootStep.computeGraph.step1.title',
        content: 'bootStep.computeGraph.step1.content',
        method: '',
        methodParams: {},
        targetDomId: 'navbarComGraphTab',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: 'bootStep.computeGraph.step2.title',
        content: 'bootStep.computeGraph.step2.content',
        method: 'viewNodeDetail',
        methodParams: {
          nodeId: 'tensor-5692-2',
          nodeTitleLabelId: 'tensor-5692-2-label-main',
        },
        targetDomId: 'sprotty_tensor-5692-2-label-main',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: 'bootStep.computeGraph.step3.title',
        content: 'bootStep.computeGraph.step3.content',
        method: 'searchNode',
        methodParams: {
          searchKey: '5818',
          selectedTags: [
            {
              label: 'Tensor',
              field: 'Tensor',
              value: { Option: 'magic', value: { Option: 'magic' } },
            },
          ],
        },
        targetDomId: 'comGraphHeaderSearch',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: 'bootStep.computeGraph.step4.title',
        content: 'bootStep.computeGraph.step4.content',
        method: 'focusCurrentPath',
        methodParams: {
          searchNodeId: 'tensor-5818-3',
        },
        targetDomId: 'sprotty_tensor-5818-3',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: 'bootStep.computeGraph.step5.title',
        content: 'bootStep.computeGraph.step5.content',
        method: '',
        methodParams: {},
        targetDomId: 'openDiffViewerIcon',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: 'bootStep.computeGraph.step6.title',
        content: 'bootStep.computeGraph.step6.content',
        method: '',
        methodParams: {},
        targetDomId: 'boot-steps-navbar-open-swm-graph',
        showTriangle: true,
        triangleDirection: 'top',
      },
    ],
  },
  // 第四组：泳道图
  {
    groupName: 'bootStep.swimlaneGraph.groupName',
    webviewType: 'swimlaneGraph',
    openWebviewFn: 'openSwimlaneGraph',
    imgUrl: swim.value,
    openWebviewParams: { swimlaneGraphPath: '' },
    steps: [
      {
        title: 'bootStep.swimlaneGraph.step1.title',
        content: 'bootStep.swimlaneGraph.step1.content',
        method: 'distanceMeasurement',
        methodParams: {},
        targetDomId: 'distance-measurement', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: 'bootStep.swimlaneGraph.step2.title',
        content: 'bootStep.swimlaneGraph.step2.content',
        method: 'addObservationLine',
        methodParams: {},
        targetDomId: 'observation-line', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: 'bootStep.swimlaneGraph.step3.title',
        content: 'bootStep.swimlaneGraph.step3.content',
        method: 'zoomControls',
        methodParams: {},
        targetDomId: 'zoom-controls', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: 'bootStep.swimlaneGraph.step4.title',
        content: 'bootStep.swimlaneGraph.step4.content',
        method: 'measureDetailSearch',
        methodParams: {},
        targetDomId: 'measure-button', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: 'bootStep.swimlaneGraph.step5.title',
        content: 'bootStep.swimlaneGraph.step5.content',
        method: 'showGuideDetailsPanel',
        methodParams: {},
        targetDomId: 'details-content', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'bottom',
      },
      {
        title: 'bootStep.swimlaneGraph.step6.title',
        content: 'bootStep.swimlaneGraph.step6.content',
        targetDomId: 'canvas-container', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'bottom',
      },
      {
        title: 'bootStep.swimlaneGraph.step7.title',
        content: 'bootStep.swimlaneGraph.step7.content',
        targetDomId: 'rootHash', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'bottom',
      },
    ],
  },
];

// 工具函数：根据进度获取当前步骤配置
export const getCurrentStepConfig = (bigGroup: number, smallIndex: number) => {
  const groupConfig = guideStepsConfig[bigGroup];
  if (!groupConfig) return null;
  return groupConfig.steps[smallIndex] || null;
};

// 工具函数：获取下一个大组的配置
export const getNextBigGroupConfig = (currentBigGroup: number) => {
  return guideStepsConfig[currentBigGroup] || null;
};

// 工具函数：获取当前步骤的目标DOM ID
export const getCurrentStepTargetDomId = (bigGroup: number, smallIndex: number) => {
  const stepConfig = getCurrentStepConfig(bigGroup, smallIndex);
  swimConfig.currentStepTargetDomId = stepConfig?.targetDomId || '';
  return stepConfig?.targetDomId || '';
};

// 工具函数：获取当前步骤的三角配置
export const getCurrentStepTriangleConfig = (bigGroup: number, smallIndex: number) => {
  const stepConfig = getCurrentStepConfig(bigGroup, smallIndex);
  return {
    showTriangle: stepConfig?.showTriangle || true,
    triangleDirection: stepConfig?.triangleDirection || 'right',
  };
};

export let swimConfig = {
  threadKey: '1-1034',
  sampleEventName: '0-0-7-25-1(b1-matmul2)',
  currentStepTargetDomId: '',
};