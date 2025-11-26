import * as vscode from 'vscode';

import { getControlFlow, getSnippetCodeText, openControlFlowTargetFile } from './control-flow';
import { openComputeGraph, openControlFlow, openPtoConfig, openSwimlaneGraph } from './tmp-view-opener';
import { getOutputRecords, getOutputDetail } from './workspace';
import { RunDataService } from './run-data';
import {
  getSchemaData,
  getTileFwkConfigData,
  updateFwkConfigData,
  getCustomFileList,
  delCustomFile,
  addNewFwkConfigFile,
} from './schema-config';

export const services = {
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
    getOutputRecords,

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
  },
  //【临时】开启webview
  tmpViewOpener: {
    openControlFlow,
    openComputeGraph,
    openSwimlaneGraph,
    openPtoConfig,
    getTileFwkConfigData,
  },
};

let singletonServices: { runData: RunDataService };

export function startAllServices(context: vscode.ExtensionContext) {
  singletonServices = { runData: new RunDataService(context) };
}

export function useService(name: keyof typeof singletonServices) {
  return singletonServices[name];
}
