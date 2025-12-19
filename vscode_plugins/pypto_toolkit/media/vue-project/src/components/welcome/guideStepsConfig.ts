import { openControlFlow, openPyPTOWelcome, openComputeGraph, openSwimlaneGraph } from '@/apis/opener';
import { ref } from 'vue';
const controlFlowImg = ref(`${window.staticPath}/static-assets/control_flow_path_left.svg`);
const iconPathLeftLight = ref(`${window.staticPath}/static-assets/control_flow_path_left-light.svg`);
const computeImg = ref(`${window.staticPath}/static-assets/control_flow_path_right.svg`);
const iconPathRightLight = ref(`${window.staticPath}/static-assets/control_flow_path_right-light.svg`);
// 定义单个步骤的配置类型
export interface GuideStepConfig {
  title: string; // 步骤标题
  content: string; // 步骤内容
  method?: string; // 该步骤要调用的WebView内方法名（如openSidebar）
  methodParams?: Record<string, any>; // 调用方法的参数
  targetDomId: string; // 目标引导DOM的ID
  showTriangle: boolean; // 是否显示引导三角
  triangleDirection: 'top' | 'bottom' | 'left' | 'right'; // 三角方向（上/下/左/右）
}

// 定义大组配置类型
export interface GuideBigGroupConfig {
  groupName: string; // 大组名称
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
    groupName: '控制流',
    webviewType: 'controlFlow',
    openWebviewParams: { outputPath: '', controlFlowPath: '' }, // 实际参数按需传
    imgUrl: controlFlowImg.value,
    steps: [
      {
        title: '控制流-步骤1标题',
        content:
          '这是控制流的第一个小步骤，打开侧边栏这是控制流的第一个小步骤，打开侧边栏这是控制流的第一个小步骤，打开侧边栏这是控制流的第一个小步骤，打开侧边栏这是控制流的第一个小步骤，打开侧边栏这是控制流的第一个小步骤，打开侧边栏...',
        targetDomId: 'boot-steps-controlFlow',
        showTriangle: false,
        triangleDirection: 'left',
      },
      {
        title: '控制流-步骤2标题',
        content: '这是控制流的第二个小步骤，打开搜索框...',
        targetDomId: 'boot-steps-controlFlow-search',
        method: 'bootStepSearch',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '控制流-步骤3标题',
        content: '这是控制流的第三个小步骤，完成后将进入导航系统...',
        targetDomId: 'boot-steps-controlFlow-right-panel',
        method: 'bootStepOpenSideBar',
        showTriangle: true,
        triangleDirection: 'right',
      },
    ],
  },
  // 第二组：导航系统
  {
    groupName: '导航系统',
    webviewType: 'navigation',
    openWebviewFn: 'openComputeGraph',
    imgUrl: controlFlowImg.value,
    openWebviewParams: null,
    steps: [
      {
        title: '导航系统-步骤1标题',
        content: '这是导航系统的第一个小步骤，加载导航菜单...',
        method: 'loadNavMenu',
        methodParams: {},
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '导航系统-步骤2标题',
        content: '这是导航系统的第二个小步骤，完成后将进入计算图...',
        method: 'checkNavStatus',
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '导航系统-步骤1标题',
        content: '这是导航系统的第一个小步骤，加载导航菜单...',
        method: 'loadNavMenu',
        methodParams: {},
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '导航系统-步骤2标题',
        content: '这是导航系统的第二个小步骤，完成后将进入计算图...',
        method: 'checkNavStatus',
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '导航系统-步骤2标题',
        content: '这是导航系统的第二个小步骤，完成后将进入计算图...',
        method: 'checkNavStatus',
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'top',
      },
    ],
  },
  // 第三组：计算图
  {
    groupName: '计算图',
    webviewType: 'computeGraph',
    openWebviewFn: 'openSwimlaneGraph',
    imgUrl: computeImg.value,
    openWebviewParams: { outputPath: '', computeGraphPath: '', pathName: 'compute' },
    steps: [
      {
        title: '计算图-步骤1标题',
        content: '这是计算图的第一个小步骤，渲染节点...',
        method: 'renderComputeNodes',
        methodParams: {},
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '计算图-步骤2标题',
        content: '计算图第二步，绑定节点事件...',
        method: 'bindNodeEvents',
        methodParams: {},
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '计算图-步骤3标题',
        content: '计算图第三步，校验节点配置...',
        method: 'checkNodeConfig',
        methodParams: {},
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '计算图-步骤4标题',
        content: '计算图第四步，完成后进入泳道图...',
        method: 'saveNodeConfig',
        methodParams: {},
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '计算图-步骤4标题',
        content: '计算图第四步，完成后进入泳道图...',
        method: 'saveNodeConfig',
        methodParams: {},
        targetDomId: 'controlFlow-search',
        showTriangle: true,
        triangleDirection: 'top',
      },
    ],
  },
  // 第四组：泳道图
  {
    groupName: '泳道图',
    webviewType: 'swimlaneGraph',
    openWebviewFn: openPyPTOWelcome,
    imgUrl: computeImg.value,
    openWebviewParams: { swimlaneGraphPath: '' },
    steps: [
      {
        title: '泳道图-步骤1标题',
        content: '泳道图第一步，加载泳道数据...',
        method: 'loadSwimlaneData',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤2标题',
        content: '泳道图第二步，完成引导，开始体验...',
        method: 'initSwimlane',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤1标题',
        content: '泳道图第一步，加载泳道数据...',
        method: 'loadSwimlaneData',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤2标题',
        content: '泳道图第二步，完成引导，开始体验...',
        method: 'initSwimlane',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤1标题',
        content: '泳道图第一步，加载泳道数据...',
        method: 'loadSwimlaneData',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤2标题',
        content: '泳道图第二步，完成引导，开始体验...',
        method: 'initSwimlane',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤1标题',
        content: '泳道图第一步，加载泳道数据...',
        method: 'loadSwimlaneData',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤1标题',
        content: '泳道图第一步，加载泳道数据...',
        method: 'loadSwimlaneData',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-步骤2标题',
        content: '泳道图第二步，完成引导，开始体验...',
        method: 'initSwimlane',
        methodParams: {},
        targetDomId: 'controlFlow-search', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
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
