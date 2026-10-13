/**
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
 */
import * as vscode from 'vscode';

import { getControlFlow, getSnippetCodeText, openControlFlowTargetFile, readProgramPath, readProgramConfiguredPath } from './control-flow';
import {
  openComputeGraph,
  openControlFlow,
  openOpCheck,
  openTaskCheck,
  openPtoConfig,
  openPyPTOWelcome,
  openSwimlaneGraph,
  openThreeColumnGraph,
  warnComputeGraphNotExist,
} from './tmp-view-opener';
import { getRunDataList, fetchRunDataDetail, getRunDataBySwimlaneGraphPath, deleteRunData } from './run-data/api';
import { RunDataService } from './run-data';
import { ConfigDataService } from './schema-config/configdata';
import { RunConfigLanguageFeaturesService } from './schema-config/run-config-language-features';
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
import { BasicService } from './basic-service';

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
    /** 读取program.json的path */
    readProgramPath,
    /** 读取runData.json中配置的program_file原始路径 */
    readProgramConfiguredPath,
  },
  // 工作区
  workspace: {
    /** 获取运行结果记录 */
    getRunDataList,

    /** 获取运行结果详情 */
    fetchRunDataDetail,

    /** 根据泳道图路径获取运行结果记录 */
    getRunDataBySwimlaneGraphPath,

    /** 删除数据 */
    deleteRunData,
  },
  //【临时】开启webview
  tmpViewOpener: {
    openControlFlow,
    openComputeGraph,
    openSwimlaneGraph,
    openOpCheck,
    openTaskCheck,
    openPtoConfig,
    openPyPTOWelcome,
    openThreeColumnGraph,
    /** 提示配置的计算图文件不存在 */
    warnComputeGraphNotExist,
  },
};

let singletonServices: { extension: ExtensionConfig; runData: RunDataService; configData: ConfigDataService };
const privateServices: BasicService[] = [];
type Services = typeof singletonServices;
export function startAllServices(context: vscode.ExtensionContext) {
  singletonServices = { extension: new ExtensionConfig(context), runData: new RunDataService(), configData: new ConfigDataService() };

  /** ---- 以下是外部无需引用的service ---- */
  privateServices.push(new RunConfigLanguageFeaturesService(context));
}

export function closeAllServices() {
  Object.values(singletonServices).forEach((service) => {
    service.dispose();
  });
  privateServices.forEach((service) => {
    service.dispose();
  });
}

export function useService<T extends keyof Services>(name: T): Services[T] {
  return singletonServices[name];
}
