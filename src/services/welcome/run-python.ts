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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, exec, spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { extensionContext } from '../../extension';
import { PythonExecuteResult } from '../../types/welcome/run-pytion';
import { t } from 'i18next';

let pythonOutputChannel: vscode.OutputChannel | undefined;

/**
 * 获取单例 Output Channel
 * @returns 单例 Output Channel
 */
export function getPythonOutputChannel(): vscode.OutputChannel {
  pythonOutputChannel = vscode.window.createOutputChannel(`${t('PyPTOToolkit.welcome.runPython.channel')} ${new Date().toLocaleString()}`);
  return pythonOutputChannel;
}

/**
 * 检查单个依赖是否已安装（避免重复安装）
 * @param pkgName 依赖包名
 */
async function checkDependencyInstalled(pkgName: string): Promise<boolean> {
  const isWindows = os.platform() === 'win32';
  const pythonCmd = isWindows ? 'python' : 'python3';
  return new Promise((resolve) => {
    // 用 python -m pip show 检查依赖,避免pip/pip3路径问题
    exec(`${pythonCmd} -m pip show ${pkgName}`, (error) => {
      resolve(!error); // 无错误=已安装
    });
  });
}

/**
 * 流式安装Python依赖
 * @param dependencies 需安装的依赖列表
 * @param outputChannel 输出面板
 * @param address pip镜像地址
 */
async function installPythonDependencies(dependencies: string[], outputChannel: vscode.OutputChannel, address: string): Promise<boolean> {
  // 步骤1:先检查已安装的依赖,只安装缺失的
  const missingDeps: string[] = [];
  outputChannel.appendLine(`[${t('PyPTOToolkit.welcome.runPython.install.check')}] ${new Date().toLocaleString()}`);
  for (const dep of dependencies) {
    const installed = await checkDependencyInstalled(dep);
    if (installed) {
      outputChannel.appendLine(`${dep} Already installed`);
    } else {
      outputChannel.appendLine(`${dep} Not installed`);
      missingDeps.push(dep);
    }
  }

  // 无缺失依赖,直接返回成功
  if (missingDeps.length === 0) {
    outputChannel.appendLine('======================================================\n');
    return true;
  }

  // 步骤2:流式安装缺失的依赖
  return new Promise((resolve) => {
    const isWindows = os.platform() === 'win32';
    const pythonCmd = isWindows ? 'python' : 'python3';
    // 构建pip安装命令（传入镜像地址）
    const pipArgs = ['-m', 'pip', 'install', '--user', '--upgrade', ...missingDeps];

    outputChannel.appendLine(`${t('PyPTOToolkit.welcome.runPython.install.start')}:${missingDeps.join(', ')}`);
    outputChannel.appendLine(`${t('PyPTOToolkit.welcome.runPython.install.command')}:${pythonCmd} ${pipArgs.join(' ')}`);

    // 跨平台spawn配置
    const spawnOptions = {
      shell: isWindows,
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      timeout: 120000, // 总超时120秒（2分钟）
    };

    // 启动spawn子进程（流式输出）
    const pipProcess: ChildProcessWithoutNullStreams = spawn(pythonCmd, pipArgs, spawnOptions);
    let installFailed = false;

    // 超时管控:超过2分钟未完成则终止进程
    const timeoutTimer = setTimeout(() => {
      if (!installFailed) {
        outputChannel.appendLine(`\n${t('PyPTOToolkit.welcome.runPython.install.timeOut')}`);
        pipProcess.kill(); // 终止安装进程
        resolve(false);
      }
    }, 120000);

    // 实时捕获标准输出（pip的安装日志）
    pipProcess.stdout.on('data', (data: Buffer | string) => {
      const log = data.toString('utf8').trim();
      if (log) {
        // 过滤空行,优化日志显示
        outputChannel.appendLine(`[${t('PyPTOToolkit.welcome.runPython.Installation.log')}] ${log}`);
      }
    });

    // 实时捕获错误输出（警告/错误信息）
    pipProcess.stderr.on('data', (data: Buffer | string) => {
      const log = data.toString('utf8').trim();
      if (log) {
        // warning不影响安装,error才是失败
        if (log.toLowerCase().includes('error')) {
          outputChannel.appendLine(`[${t('PyPTOToolkit.welcome.runPython.Installation.error')}] ${log}`);
          installFailed = true;
        } else {
          outputChannel.appendLine(`${t('PyPTOToolkit.welcome.runPython.Installation.warning')}${log}`);
        }
      }
    });

    // 进程退出事件（判断安装结果）
    pipProcess.on('exit', (code) => {
      clearTimeout(timeoutTimer); // 清除超时定时器
      outputChannel.appendLine(`\n==================== ${t('PyPTOToolkit.welcome.runPython.Installation.results')} ====================`);
      if (installFailed || code !== 0) {
        outputChannel.appendLine(
          `install err(${code ?? 'undefined'})\n${t('PyPTOToolkit.welcome.runPython.Installation.solution')}:${pythonCmd} ${pipArgs.join(
            ' ',
          )}`,
        );
        resolve(false);
      } else {
        outputChannel.appendLine(`install ${missingDeps.join(', ')} success`);
        resolve(true);
      }
      outputChannel.appendLine('======================================================\n');
    });

    // 进程启动失败（如python未安装）
    pipProcess.on('error', (err) => {
      clearTimeout(timeoutTimer);
      outputChannel.appendLine(`${t('PyPTOToolkit.welcome.runPython.Installation.variables')}!${err.message}`);
      resolve(false);
    });
  });
}

/**
 * 封装 exec 为 Promise,便于获取返回值
 * @param pythonFilePath 文件地址
 * @param cwd cwd窗口地址
 */
export async function executePythonFile(pythonFilePath: string, cwd: string): Promise<PythonExecuteResult> {
  return new Promise((resolve) => {
    // 跨平台命令适配
    const isWindows = os.platform() === 'win32';
    const pythonCmd = isWindows ? 'python' : 'python3';
    let execCommand = `"${pythonCmd}" "${pythonFilePath}" "--run_mode=sim"`;

    // Windows 切换 UTF-8 编码
    if (isWindows) {
      execCommand = `chcp 65001 > nul && ${execCommand}`;
    }

    // 执行配置
    const execOptions = {
      cwd,
      encoding: 'utf8',
      timeout: 100000,
      maxBuffer: 1024 * 1024 * 10,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    };

    // 执行命令并返回结构化结果
    exec(execCommand, execOptions, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: (stdout as string).trim(), // 去除首尾空白符
        stderr: (stderr as string).trim(),
        error: error ?? undefined,
      });
    });
  });
}

/**
 * 判断插件当前运行状态（调试/打包）
 */
export function getExtensionMode() {
  // 使用官方API（VS Code 1.74+）判断是否打包,低于1.74版本的走路径兼容进行判断
  const extension = vscode.extensions.getExtension('cann-pub.pypto-toolkit');

  if (extension && 'isDevelopment' in extension) {
    return extension.isDevelopment ? 'development' : 'production';
  }

  // 路径特征兼容
  const extensionPath = extensionContext?.extensionPath || '';
  // 调试态特征:路径包含存在.vscode目录
  const isDevPath = fs.existsSync(path.join(extensionPath, '.vscode'));
  // 打包态特征:路径包含VS Code扩展安装目录
  const isProdPath =
    extensionPath.includes('.vscode/extensions/') || // macOS/Linux
    extensionPath.includes('\\.vscode\\extensions\\'); // Windows

  if (isDevPath) {
    return 'development';
  }
  if (isProdPath) {
    return 'production';
  }

  // 兜底:默认打包态
  return 'production';
}

async function checkDependencies(outputChannel: vscode.OutputChannel, address: string) {
  // 定义需安装的依赖
  const dependencies = ['numpy', 'torch'];
  // 安装依赖,失败则终止执行
  await installPythonDependencies(dependencies, outputChannel, address);
}

/**
 * 复制Python文件到当前工作区根目录，存在则追加(n)
 * @param sourcePyPath 插件内Python源文件路径
 * @param outputChannel 输出面板
 * @returns 复制后的目标文件路径 | null（失败）
 */
async function copyPyToWorkspace(sourcePyPath: string, outputChannel: vscode.OutputChannel): Promise<string | null> {
  // 步骤1：校验是否打开了工作区
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  // 仅单个工作区根目录执行复制，多工作区直接终止操作，不进行复制
  if (workspaceFolders.length > 1) {
    return null;
  }

  // 获取工作区根目录（单工作区直接取第一个）
  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  outputChannel.appendLine(`[info] ${t('PyPTOToolkit.welcome.runPython.workspaceRoot')}: ${workspaceRoot}`);

  // 步骤2：构建基础目标路径（工作区根/hello_world.py）
  const baseFileName = 'hello_world.py';
  let targetPyPath = path.join(workspaceRoot, baseFileName);

  // 步骤3：文件已存在则生成hello_world(1).py/hello_world(2).py
  let index = 1;
  while (fs.existsSync(targetPyPath)) {
    targetPyPath = path.join(workspaceRoot, `hello_world(${index}).py`);
    index++;
  }

  // 步骤4：异步复制文件（fs.promises.copyFile 原生异步，无需回调）
  try {
    // 复制文件（保留源文件权限）
    await fs.promises.copyFile(sourcePyPath, targetPyPath);
    return targetPyPath;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : t('PyPTOToolkit.welcome.runPython.copy.fail');
    vscode.window.showErrorMessage(`${t('PyPTOToolkit.welcome.runPython.copy.failTip')}: ${errMsg}`);
    return null;
  }
}

/**
 * 执行 Python 文件并处理输出结果
 * @param outputChannel 输出面板单例
 * @param pythonFilePath 需要执行的Python文件地址（插件内的源文件）
 * @param extensionRoot 插件地址
 * @param address 镜像源
 */
export async function runPythonScript(outputChannel: vscode.OutputChannel, pythonFilePath: string, extensionRoot: string, address: string) {
  try {
    // 步骤1：检查依赖
    outputChannel.appendLine(`[start check] ${new Date().toLocaleString()}`);
    await checkDependencies(outputChannel, address);

    // 步骤2：复制Python文件到工作区
    outputChannel.appendLine(`[start copy file] ${new Date().toLocaleString()}`);
    await copyPyToWorkspace(pythonFilePath, outputChannel);

    // 步骤3：执行【工作区的副本文件】而非插件内的源文件
    outputChannel.appendLine(`[start run python file] ${new Date().toLocaleString()}`);
    const result = await executePythonFile(pythonFilePath, extensionRoot);

    // 步骤4：处理执行结果
    if (result.success) {
      outputChannel.appendLine(`[state] Success ${new Date().toLocaleString()}`);
      outputChannel.appendLine(`[result stdout] ${result.stdout}`);
      return true;
    } else {
      outputChannel.appendLine(`[state] error ${new Date().toLocaleString()}`);
      outputChannel.appendLine(`[error message] ${result.error?.message || 'undefined'}`);
      outputChannel.appendLine(`[error stderr] ${result.stderr}`);
      return false;
    }
  } catch (error) {
    console.log(error);
  }
}
