import * as vscode from 'vscode';

import { getControlFlow } from './control-flow';
import { openComputeGraph, openControlFlow, openSwimlaneGraph } from './tmp-view-opener';
import { getOutputRecords, getOutputDetail } from './workspace';
import { RunDataService } from './run-data';

export const services = {
  // 控制流
  controlFlow: {
    /** 获取控制流 */
    getControlFlow,
  },
  // 工作区
  workspace: {
    /** 获取运行结果记录 */
    getOutputRecords,

    /** 获取运行结果详情 */
    getOutputDetail,
  },
  //【临时】开启webview
  tmpViewOpener: {
    openControlFlow,
    openComputeGraph,
    openSwimlaneGraph,
  },
};

let singletonServices: { runData: RunDataService };

export function startAllServices(context: vscode.ExtensionContext) {
  singletonServices = { runData: new RunDataService(context) };
}

export function useService(name: keyof typeof singletonServices) {
  return singletonServices[name];
}
