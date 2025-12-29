import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getExtensionMode, getPythonOutputChannel, runPythonScript } from './run-python';
import { extensionContext } from '../../extension';
import { readWholeFileByTextDocument } from './getPythonCode';

/**
 * 根据插件初始Python文件创建初始工程
 */
export async function getInitPythonProject(address = 'https://pypi.tuna.tsinghua.edu.cn/simple') {
  // 校验前置条件
  if (!extensionContext) {
    vscode.window.showErrorMessage('插件未激活，无法获取上下文！');
    return;
  }
  const outputChannel = getPythonOutputChannel();
  outputChannel.clear();
  outputChannel.show();

  const extensionRoot = extensionContext.extensionPath;
  const mode = getExtensionMode();

  let pythonFilePath = '';
  // 适配打包和调试的路径
  if (mode === 'development') {
    // 调试
    pythonFilePath = path.join(extensionRoot, 'src', 'python-file', 'test_hello_world.py');
  } else {
    // 打包
    pythonFilePath = path.join(extensionRoot, 'webview-dist', 'python-file', 'test_hello_world.py');
  }

  if (!fs.existsSync(pythonFilePath)) {
    const errorMsg = `Python文件不存在：${pythonFilePath}`;
    outputChannel.appendLine(`[错误] ${errorMsg}`);
    vscode.window.showErrorMessage(errorMsg);
    return;
  }
  return await runPythonScript(outputChannel, pythonFilePath, extensionRoot, address);
}

/**
 * 判断是否为Linux系统环境
 */
export async function isLinuxEnvironment() {
  console.log(os.platform());
  return os.platform() === 'linux';
}

/** 当前用户根目录 */
const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;

/** PYPTO运行记录根目录 */
export const RUN_DATA_HOME = process.env.PYPTO_HOME
  ? `${process.env.PYPTO_HOME}${path.sep}`
  : `${USER_HOME_PATH}${path.sep}.pypto${path.sep}rundata_20251021203500`;

/**
 * 转换路径中的磁盘盘符为小写（仅针对Windows系统）
 * @param {string} filePath 原始路径
 * @returns {string} 盘符小写后的路径
 */
function toLowerCaseDriveLetter(filePath) {
  // 仅处理Windows系统，且路径以 "大写字母:\\" 开头的情况
  if (process.platform === 'win32' && /^[A-Z]:\\/.test(filePath)) {
    // 捕获盘符并转为小写，保留后续路径
    return filePath.replace(/^([A-Z]):\\/, (_, drive) => `${drive.toLowerCase()}:\\`);
  }
  // 非Windows系统/无盘符路径，直接返回原路径
  return filePath;
}

/**
 * 获取插件安装目录
 */
export function getMockDataPath() {
  // 校验前置条件
  if (!extensionContext) {
    vscode.window.showErrorMessage('插件未激活，无法获取上下文！');
    return '';
  }
  const extensionRoot = extensionContext.extensionPath;
  const mode = getExtensionMode();

  let mockDataFilePath = '';
  // 适配打包和调试的路径
  if (mode === 'development') {
    // 调试
    mockDataFilePath = path.join(extensionRoot, 'src', 'boot-mock-data', 'rundata_20251224101342');
  } else {
    // 打包
    mockDataFilePath = path.join(extensionRoot, 'webview-dist', 'boot-mock-data', 'rundata_20251224101342');
  }

  return mockDataFilePath;
}

/**
 * 获取指定测试数据根地址（盘符转为小写）
 */
export async function getUserRunRoot() {
  const outPutPath = getMockDataPath();
  // 调用盘符小写处理函数
  const lowerDrivePath = toLowerCaseDriveLetter(outPutPath);
  return lowerDrivePath;
}

/**
 * 获取output目录
 */
export async function getProgramPath() {
  const mockRootPath = getMockDataPath();
  return `${mockRootPath}${path.sep}program.json`;
}

/**
 * 获取泳道图目录
 */
export async function getSwimPath() {
  const mockRootPath = getMockDataPath();
  return `${mockRootPath}${path.sep}merged_swimlane.json`;
}

/**
 * 获取插件版本
 */
export async function getPluginVersion() {
  // 校验前置条件
  if (!extensionContext) {
    vscode.window.showErrorMessage('插件未激活，无法获取上下文！');
    return;
  }
  const version = extensionContext.extension.packageJSON.version;
  return version;
}

/**
 * 获取python脚本代码
 */
export async function getPythonFileCode() {
  // 校验前置条件
  if (!extensionContext) {
    vscode.window.showErrorMessage('插件未激活，无法获取上下文！');
    return '';
  }
  const extensionRoot = extensionContext.extensionPath;
  const mode = getExtensionMode();

  let mockDataFilePath = '';
  // 适配打包和调试的路径
  if (mode === 'development') {
    // 调试
    mockDataFilePath = path.join(extensionRoot, 'src', 'python-file', 'test_hello_world.py');
  } else {
    // 打包
    mockDataFilePath = path.join(extensionRoot, 'webview-dist', 'python-file', 'test_hello_world.py');
  }
  const uri = vscode.Uri.file(mockDataFilePath);
  const code = await readWholeFileByTextDocument(uri);
  return code;
}
