import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { extensionContext } from '../../extension';
import { PythonExecuteResult } from '../../types/welcome/run-pytion';

let pythonOutputChannel: vscode.OutputChannel | undefined;

/**
 * 获取单例 Output Channel
 * @returns 单例 Output Channel
 */
export function getPythonOutputChannel(): vscode.OutputChannel {
  if (!pythonOutputChannel) {
    pythonOutputChannel = vscode.window.createOutputChannel('PyPTO样例工程输出');
  }
  return pythonOutputChannel;
}

/**
 * 封装 exec 为 Promise，便于获取返回值
 * @param pythonFilePath 文件地址
 * @param cwd cwd窗口地址
 */
export async function executePythonFile(pythonFilePath: string, cwd: string): Promise<PythonExecuteResult> {
  return new Promise((resolve) => {
    // 跨平台命令适配
    const isWindows = os.platform() === 'win32';
    const pythonCmd = isWindows ? 'python' : 'python3';
    let execCommand = `"${pythonCmd}" "${pythonFilePath}"`;

    // Windows 切换 UTF-8 编码
    if (isWindows) {
      execCommand = `chcp 65001 > nul && ${execCommand}`;
    }

    // 执行配置
    const execOptions = {
      cwd,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
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
  // 使用官方API（VS Code 1.74+）判断是否打包，低于1.74版本的走路径兼容进行判断
  const extension = vscode.extensions.getExtension('hismartliteopen.pypto-toolkit');

  if (extension && 'isDevelopment' in extension) {
    return extension.isDevelopment ? 'development' : 'production';
  }

  // 路径特征兼容
  const extensionPath = extensionContext?.extensionPath || '';
  // 调试态特征：路径包含存在.vscode目录
  const isDevPath = fs.existsSync(path.join(extensionPath, '.vscode'));
  // 打包态特征：路径包含VS Code扩展安装目录
  const isProdPath =
    extensionPath.includes('.vscode/extensions/') || // macOS/Linux
    extensionPath.includes('\\.vscode\\extensions\\'); // Windows

  if (isDevPath) {
    return 'development';
  }
  if (isProdPath) {
    return 'production';
  }

  // 兜底：默认打包态
  return 'production';
}

/**
 * 执行 Python 文件并处理输出结果
 * @param outputChannel 输出面板单例
 * @param pythonFilePath 需要执行的Python文件地址
 * @param extensionRoot 插件地址
 */
export async function runPythonScript(outputChannel: vscode.OutputChannel, pythonFilePath: string, extensionRoot: string) {
  try {
    // 执行 Python 文件，获取输出结果
    outputChannel.appendLine(`[开始执行] ${new Date().toLocaleString()}`);

    const result = await executePythonFile(pythonFilePath, extensionRoot);

    // 处理输出结果
    if (result.success) {
      outputChannel.appendLine(`[状态] 执行成功`);
      outputChannel.appendLine(`[标准输出] ${result.stdout}`);
      // 根据Python输出结果判断Python文件最终是否执行成功
      if (result.stdout.includes('Hello World')) {
        vscode.window.showInformationMessage('Python脚本执行成功!');
      }
    } else {
      outputChannel.appendLine(`[状态] 执行失败`);
      outputChannel.appendLine(`[错误信息] ${result.error?.message || '未知错误'}`);
      outputChannel.appendLine(`[错误输出] ${result.stderr}`);
      vscode.window.showErrorMessage('Python脚本执行失败，详见「Python执行输出」面板');
    }
  } catch (error) {
    console.log(error);
    vscode.window.showErrorMessage(`Python脚本执行失败${error}`);
  }
}
