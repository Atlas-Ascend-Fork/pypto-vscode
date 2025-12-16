import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { getExtensionMode, getPythonOutputChannel, runPythonScript } from './run-python';
import { extensionContext } from '../../extension';

/**
 * 根据插件初始Python文件创建初始工程
 */
export async function getInitPythonProject(address = 'https://cmc-cd-mirror.rnd.huawei.com/pypi/simple') {
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
  runPythonScript(outputChannel, pythonFilePath, extensionRoot, address);
}

/**
 * 判断是否为Linux系统环境
 */
export async function isLinuxEnvironment() {
  console.log(os.platform());
  return os.platform() === 'linux';
}
