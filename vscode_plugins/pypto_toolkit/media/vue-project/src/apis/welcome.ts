import { request } from '@/core/request';
import { UpdateWelcomeStateParams } from 'ext:/types/welcome';

const WELCOME = 'welcome';

/**
 * 运行脚本初始化工程
 */
export function getInitPythonProject(): Promise<boolean> {
  return request.post(`${WELCOME}/getInitPythonProject`, null);
}

/**
 * 获取引导弹窗进度
 */
export function getWelcomeState(params): Promise<any> {
  return request.post(`${WELCOME}/getWelcomeState`, params);
}

/**
 * 设置引导弹窗进度
 */
export function updateWelcomeState(params: UpdateWelcomeStateParams): Promise<number> {
  return request.post(`${WELCOME}/updateWelcomeState`, params);
}

/**
 * 检测当前系统是否为Linux系统
 */
export function isLinuxEnvironment(): Promise<boolean> {
  return request.post(`${WELCOME}/isLinuxEnvironment`, null);
}

/**
 * 获取当前是否在引导中
 */
export function getIsCompleteBoot(): Promise<boolean> {
  return request.post(`${WELCOME}/getIsCompleteBoot`, null);
}

/**
 * 获取output根目录
 */
export function getUserRunRoot(): Promise<string> {
  return request.post(`${WELCOME}/getUserRunRoot`, null);
}

/**
 * 获取output programe目录
 */
export function getProgramPath(): Promise<string> {
  return request.post(`${WELCOME}/getProgramPath`, null);
}

/**
 * 获取泳道图目录
 */
export function getSwimPath(): Promise<string> {
  return request.post(`${WELCOME}/getSwimPath`, null);
}

/**
 * 获取插件版本号
 */
export function getPluginVersion(): Promise<string> {
  return request.post(`${WELCOME}/getPluginVersion`, null);
}

/**
 * 获取python脚本代码
 */
export function getPythonFileCode(): Promise<string> {
  return request.post(`${WELCOME}/getPythonFileCode`, null);
}

/**
 * 获取三栏数据地址
 */
export function getSanlanSamplePath(): Promise<string>{
  return request.post(`${WELCOME}/getSanlanSamplePath`, null);
}