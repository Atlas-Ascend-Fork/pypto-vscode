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
}

// 定义大组配置类型
export interface GuideBigGroupConfig {
  groupName: string; // 大组名称
  webviewType: 'controlFlow' | 'navigation' | 'computeGraph' | 'swimlaneGraph'; // 对应WebView类型
  openWebviewFn: (params?: any) => Promise<any>; // 打开该WebView的方法
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
    openWebviewFn: openControlFlow,
    openWebviewParams: { outputPath: '', controlFlowPath: '' }, // 实际参数按需传
    imgUrl: controlFlowImg.value,
    steps: [
      {
        title: '控制流-步骤1标题',
        content: '这是控制流的第一个小步骤，打开侧边栏...',
        method: 'bootStepOpenSideBar',
        methodParams: { sidebarKey: 'controlFlow' },
      },
      {
        title: '控制流-步骤2标题',
        content: '这是控制流的第二个小步骤，打开搜索框...',
        method: 'bootStepOpenSideBar',
        methodParams: { searchType: 'controlFlow' },
      },
      {
        title: '控制流-步骤3标题',
        content: '这是控制流的第三个小步骤，完成后将进入导航系统...',
        method: 'bootStepOpenSideBar',
      },
    ],
  },
  // 第二组：导航系统
  {
    groupName: '导航系统',
    webviewType: 'navigation',
    openWebviewFn: openControlFlow,
    imgUrl: controlFlowImg.value,
    openWebviewParams: null,
    steps: [
      {
        title: '导航系统-步骤1标题',
        content: '这是导航系统的第一个小步骤，加载导航菜单...',
        method: 'loadNavMenu',
        methodParams: {},
      },
      {
        title: '导航系统-步骤2标题',
        content: '这是导航系统的第二个小步骤，完成后将进入计算图...',
        method: 'checkNavStatus',
      },
    ],
  },
  // 第三组：计算图
  {
    groupName: '计算图',
    webviewType: 'computeGraph',
    openWebviewFn: openComputeGraph,
    imgUrl: computeImg.value,
    openWebviewParams: { outputPath: '', computeGraphPath: '', pathName: 'compute' },
    steps: [
      {
        title: '计算图-步骤1标题',
        content: '这是计算图的第一个小步骤，渲染节点...',
        method: 'renderComputeNodes',
        methodParams: {},
      },
      {
        title: '计算图-步骤2标题',
        content: '计算图第二步，绑定节点事件...',
        method: 'bindNodeEvents',
        methodParams: {},
      },
      {
        title: '计算图-步骤3标题',
        content: '计算图第三步，校验节点配置...',
        method: 'checkNodeConfig',
        methodParams: {},
      },
      {
        title: '计算图-步骤4标题',
        content: '计算图第四步，完成后进入泳道图...',
        method: 'saveNodeConfig',
        methodParams: {},
      },
    ],
  },
  // 第四组：泳道图
  {
    groupName: '泳道图',
    webviewType: 'swimlaneGraph',
    openWebviewFn: openSwimlaneGraph,
    imgUrl: computeImg.value,
    openWebviewParams: { swimlaneGraphPath: '' },
    steps: [
      {
        title: '泳道图-步骤1标题',
        content: '泳道图第一步，加载泳道数据...',
        method: 'loadSwimlaneData',
        methodParams: {},
      },
      {
        title: '泳道图-步骤2标题',
        content: '泳道图第二步，完成引导，开始体验...',
        method: 'initSwimlane',
        methodParams: {},
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
  return guideStepsConfig[currentBigGroup + 1] || null;
};
