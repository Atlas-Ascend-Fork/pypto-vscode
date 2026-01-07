import { getControlFlow, getSnippetCodeText, openControlFlowTargetFile } from './control-flow';
import { openComputeGraph, openControlFlow, openPtoConfig, openPyPTOWelcome, openSwimlaneGraph, openThreeColumnGraph } from './tmp-view-opener';
import { getRunDataList, getOutputDetail } from './run-data/api';
import { RunDataService } from './run-data';
import {
  getTileFwkConfigData,
  updateFwkConfigData,
  getCustomFileList,
  delCustomFile,
  addNewFwkConfigFile,
  getSchemaData,
  getConfigsTemplate,
  getConfigsForRevise,
  updateConfigsFile,
} from './schema-config';
import { ConfigDataService } from './schema-config/configdata';
import {
  getInitPythonProject,
  getPluginVersion,
  getProgramPath,
  getPythonFileCode,
  getThreeColumnSamplePath,
  getSwimPath,
  getUserRunRoot,
  isLinuxEnvironment,
  completeResultsStep,
  reductionResultsStep,
  completeTreeColumnStep,
  reductionTreeColumnStep,
} from './welcome';
import { updateWelcomeState, getWelcomeState, getIsCompleteBoot } from './welcome/steps-config';

export const serviceApis = {
  welcome: {
    getInitPythonProject,
    updateWelcomeState,
    getWelcomeState,
    isLinuxEnvironment,
    getIsCompleteBoot,
    getUserRunRoot,
    getProgramPath,
    getSwimPath,
    getPluginVersion,
    getPythonFileCode,
    getThreeColumnSamplePath,
    completeResultsStep,
    reductionResultsStep,
    completeTreeColumnStep,
    reductionTreeColumnStep
  },
  // 控制流
  controlFlow: {
    /** 获取控制流 */
    getControlFlow,
    /** 获取控制流代码片段 */
    getSnippetCodeText,
    /** 打开代码片段源代码文件 */
    openControlFlowTargetFile,
  },
  // 工作区
  workspace: {
    /** 获取运行结果记录 */
    getRunDataList,

    /** 获取运行结果详情 */
    getOutputDetail,
  },
  // 配置项管理
  config: {
    /** 获取配置约束 */
    getSchemaData,

    /** 获取配置文件 */
    getTileFwkConfigData,

    /** 更新配置文件 */
    updateFwkConfigData,

    /** 获取自定义配置列表 */
    getCustomFileList,

    /** 删除自定义配置 */
    delCustomFile,

    /** 添加自定义配置 */
    addNewFwkConfigFile,

    /** 获取Simulator的数组模板 */
    getConfigsTemplate,

    /** 获取用户config文件中仿真与Pass数据 */
    getConfigsForRevise,

    /** 更新用户config文件中仿真与Pass数据 */
    updateConfigs: updateConfigsFile,
  },
  //【临时】开启webview
  tmpViewOpener: {
    openControlFlow,
    openComputeGraph,
    openSwimlaneGraph,
    openPtoConfig,
    openPyPTOWelcome,
    openThreeColumnGraph,
  },
};

let singletonServices: { runData: RunDataService; configData: ConfigDataService };
type Services = typeof singletonServices;
export function startAllServices() {
  singletonServices = { runData: new RunDataService(), configData: new ConfigDataService() };
}

export function closeAllServices() {
  Object.values(singletonServices).forEach((service) => {
    service.dispose();
  });
}

export function useService<T extends keyof Services>(name: T): Services[T] {
  return singletonServices[name];
}
