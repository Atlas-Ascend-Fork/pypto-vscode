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
        title: '控制流-查看控制流图',
        content:
          '控制流图展示了控制流的结构，可以清晰的了解循环和分支判断等控制流逻辑及关联关系，在矩形Path卡片中点击leaf函数、被调用函数-called、调用函数-callee即可在右侧打开该path节点的详情。下一步将演示点击leaf函数的效果。',
        targetDomId: 'boot-steps-controlFlow',
        method: 'checkControlFlow',
        showTriangle: false,
        triangleDirection: 'right',
      },
      {
        title: '控制流-查看Path节点面板',
        content:
          'leaf函数显示当前PATH节点的子函数个数；被调用函数-called显示当前PATH节点被其他函数调用的次数；所有计算图显示当前节点所有的计算图列表，点击后可以打开相应计算图页面。',
        targetDomId: 'boot-steps-controlFlow-right-panel',
        method: 'bootStepOpenSideBar',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '控制流-搜索栏',
        content: '打开控制流界面后，可以在搜索框中针对本控制流图中的LOOP或PATH节点进行模糊搜索，选中搜索结果，可跳转至当前图对应的节点。',
        targetDomId: 'boot-steps-controlFlow-search',
        method: 'bootStepSearch',
        showTriangle: true,
        triangleDirection: 'top',
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
        title: '导航系统-查看历史记录',
        content: '这是导航系统的查看运行历史列表，点击可以展开历史运行列表。',
        method: 'viewNavigationHistory',
        methodParams: {},
        targetDomId: 'boot-steps-navbar-history',
        showTriangle: true,
        triangleDirection: 'top',
      },
      // {
      //   title: '导航系统-步骤2标题',
      //   content: '这是导航系统的第二个小步骤，完成后将进入计算图...',
      //   method: 'checkNavStatus',
      //   targetDomId: 'boot-steps-navbar-com-graph',
      //   showTriangle: true,
      //   triangleDirection: 'top',
      // },
      {
        title: '导航系统-打开计算图',
        content: '这是导航系统中打开计算图的图标，点击后即可打开计算图',
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
    groupName: '计算图',
    webviewType: 'computeGraph',
    openWebviewFn: 'openSwimlaneGraph',
    imgUrl: computeImg.value,
    openWebviewParams: { outputPath: '', computeGraphPath: '', pathName: 'compute' },
    steps: [
      {
        title: '查看计算图',
        content: '查看代码计算图结构，支持鼠标滚动缩放，按住拖拽，点击高亮节点链路，小地图快速定位功能。',
        method: '',
        methodParams: {},
        targetDomId: 'navbarComGraphTab',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '选中节点并查看前后关系',
        content: '点击节点后会将当前节点所在通路高亮，不在当前通路的节点变暗，可更方便查看选中节点的前后关系。',
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
        title: '搜索目标节点',
        content: '在此处输入内容搜索目标节点，支持模糊搜索匹配及精确搜索某个值。',
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
        title: '只看当前通路',
        content: '对节点点击鼠标右键，下拉中可以选择锁定通路并高亮，只看当前通路，可以避免干扰，精准查看目标前后关系。',
        method: 'focusCurrentPath',
        methodParams: {
          searchNodeId: 'tensor-5818-3',
        },
        targetDomId: 'sprotty_tensor-5818-3',
        showTriangle: true,
        triangleDirection: 'top',
      },
      {
        title: '计算图diff查看',
        content: '点击该按钮会自动关联before及after文件，开启对比查看，快速定位差异内容。',
        method: '',
        methodParams: {},
        targetDomId: 'openDiffViewerIcon',
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '打开泳道图',
        content: '点击导航栏中的打开泳道图按钮，可以快速打开泳道图。',
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
    groupName: '泳道图',
    webviewType: 'swimlaneGraph',
    openWebviewFn: 'openSwimlaneGraph',
    imgUrl: computeImg.value,
    openWebviewParams: { swimlaneGraphPath: '' },
    steps: [
      {
        title: '泳道图-测距',
        content: '同一泳道内相邻节点间自动测距，或者跨泳道、跨节点手动测距',
        method: 'distanceMeasurement',
        methodParams: {},
        targetDomId: '', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-在时间轴上添加观测线',
        content: '鼠标悬停在时间轴上，或者点击时间轴，均可添加时间观测线',
        method: 'addObservationLine',
        methodParams: {},
        targetDomId: 'timeline-container', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-操作区',
        content: '支持搜索、缩放、渲染设置，时间度量、性能报告',
        method: 'zoomControls',
        methodParams: {},
        targetDomId: 'zoom-controls', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-开启时间度量-查看核利用率统计信息',
        content: '点击泳道图右上角的度量模式按钮，或者鼠标框选节点，即可查看核利用率统计信息',
        method: 'measureDetailSearch',
        methodParams: {},
        targetDomId: 'measure-button', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-查看PMU性能报告',
        content: '点击泳道图右上角性能统计按钮，即可查看PMU性能',
        method: 'viewPMUPerformance',
        methodParams: {},
        targetDomId: 'pmu-report', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-查看节点详情',
        content: '点击泳道图中某个任务节点，可显示节点的详情面板',
        method: 'showGuideDetailsPanel',
        methodParams: {},
        targetDomId: '', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-依赖分析',
        content: '点击泳道图中某个任务节点，可显示节点的详情面板，进而可以查看节点依赖信息',
        targetDomId: 'canvas-container', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      },
      {
        title: '泳道图-跳转计算图',
        content: '支持根据rootHash和leafHash跳转至计算图',
        targetDomId: 'rootHash', // 步骤1定位
        showTriangle: true,
        triangleDirection: 'right',
      }
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
