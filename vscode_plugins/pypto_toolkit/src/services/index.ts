import { getControlFlow } from './control-flow';
import { getOutputRecords } from './workspace';

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
  },
};
