import * as vscode from 'vscode';

import { getControlFlow, getSnippetCodeText, openControlFlowTargetFile } from './control-flow';
import {
  openComputeGraph,
  openControlFlow,
  openPtoConfig,
  openPyPTOWelcome,
  openSwimlaneGraph,
  openThreeColumnGraph,
} from './tmp-view-opener';
import { getRunDataList, getOutputDetail, getRunDataBySwimlaneGraphPath } from './run-data/api';
import { RunDataService } from './run-data';
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
import { ExtensionConfig } from './extension-config';

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
    reductionTreeColumnStep,
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

    /** 根据泳道图路径获取运行结果记录 */
    getRunDataBySwimlaneGraphPath,
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

let singletonServices: { extension: ExtensionConfig; runData: RunDataService; configData: ConfigDataService };
type Services = typeof singletonServices;
export function startAllServices(context: vscode.ExtensionContext) {
  singletonServices = { extension: new ExtensionConfig(context), runData: new RunDataService(), configData: new ConfigDataService() };
}

export function closeAllServices() {
  Object.values(singletonServices).forEach((service) => {
    service.dispose();
  });
}

export function useService<T extends keyof Services>(name: T): Services[T] {
  return singletonServices[name];
}
