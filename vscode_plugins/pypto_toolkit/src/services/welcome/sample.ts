import * as vscode from 'vscode';
import * as fs from 'fs';
import { join } from 'path';
import { t } from 'i18next';
import { getExtensionMode } from './run-python';
import { extensionContext } from '../../extension';

export enum SampleDataStatus {
  Init = 'Init',
  Process = 'Process',
  Succ = 'Succ',
  Fail = 'Fail',
};

export class SampleManager {
  private sourceDataPath: string;
  private targetDataPath: string;
  private statusFile: string;
  private lockDir: string;
  private codeFile: string;

  constructor() {
    if (!extensionContext) {
      vscode.window.showErrorMessage('插件未激活，无法获取上下文！');
      return;
    }

    const extensionRoot = extensionContext.extensionPath;
    const mode = getExtensionMode();
    
    // 源数据路径（只读，在安装包内）
    if (mode === 'development') {
      this.sourceDataPath = join(extensionRoot, 'src', 'boot-mock-data', 'rundata_20251224101343');
    } else {
      this.sourceDataPath = join(extensionRoot, 'webview-dist', 'boot-mock-data', 'rundata_20251224101343');
    }

    // 目标数据路径（可写，在 globalStorage 内）
    // 使用 globalStorageUri 可以确保在不同 OS 下都有写入权限，且多窗口共享
    const storagePath = extensionContext.globalStorageUri.fsPath;
    // 确保存储目录存在
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }

    this.targetDataPath = join(storagePath, 'rundata_20251224101343');
    this.statusFile = join(this.targetDataPath, 'status');
    this.lockDir = join(storagePath, 'sample_data.lock');
    
    this.codeFile = 'test_glm_ffn_dense_quant.py';
    console.log('样例数据位置：', this.targetDataPath);
  }

  // 准备数据
  async prepare() {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Window,
      title: t('PyPTOToolkit.welcome.prepare') as string,
      cancellable: false
    }, async (progress) => {
      
      const maxRetries = 120; // 如果锁没有获取到，最多等待1分钟
      let retryCount = 0;

      // 尝试获取锁或等待
      while (retryCount < maxRetries) {
        try {
          // 尝试创建锁目录，这是原子操作
          fs.mkdirSync(this.lockDir);
          // 获取锁成功
          break;
        } catch (err: any) {
          if (err.code === 'EEXIST') {
            // 锁已存在，检查当前状态
            const status = this.getStatus();
            if (status === SampleDataStatus.Succ || status === SampleDataStatus.Fail) {
              // 其他窗口已经完成处理
              return;
            }
            // 等待其他窗口处理
            await new Promise(resolve => setTimeout(resolve, 500));
            retryCount++;
          } else {
            console.error(err);
          }
        }
      }

      if (retryCount >= maxRetries) {
        vscode.window.showErrorMessage(t('PyPTOToolkit.welcome.prepareTimeout'));
        return;
      }

      // 持有锁，开始处理
      try {
        // 双重检查：再次检查状态，防止在获取锁的瞬间被改写
        const fileStatus = this.getStatus();
        if (fileStatus === SampleDataStatus.Succ || fileStatus === SampleDataStatus.Fail) {
          return;
        }

        if (fs.existsSync(this.targetDataPath)) {
          fs.rmSync(this.targetDataPath, { recursive: true, force: true });
        }

        // 1. 复制数据
        await vscode.workspace.fs.copy(
          vscode.Uri.file(this.sourceDataPath),
          vscode.Uri.file(this.targetDataPath),
          { overwrite: true }
        );

        this.updateStatus(SampleDataStatus.Process);

        const targetCodePath = join(this.targetDataPath, this.codeFile);
        let normalizedCodePath = targetCodePath;
        if (process.platform === 'win32') {
          normalizedCodePath = targetCodePath.replace(/\\/g, '\\\\');
        }

        // 2. 遍历并替换
        const processDir = join(this.targetDataPath, 'Pass_37_CodegenPreproc');
        if (fs.existsSync(processDir)) {
          const files = fs.readdirSync(processDir);

          for (const file of files) {
            if (file.endsWith('.json')) {
              const filePath = join(processDir, file);
              let content = fs.readFileSync(filePath, 'utf-8');
              content = content.replace(/%threeColumnCodePath%/g, normalizedCodePath);
              fs.writeFileSync(filePath, content, 'utf-8');
            }
          }
        }

        // 3. 处理 program.json
        const programJsonPath = join(this.targetDataPath, 'program.json');
        if (fs.existsSync(programJsonPath)) {
          let content = fs.readFileSync(programJsonPath, 'utf-8');
          content = content.replace(/%threeColumnCodePath%/g, normalizedCodePath).replace(`"entryhash": "12780147721777633745"`, `"entryhash": "196978988935989036"`);
          fs.writeFileSync(programJsonPath, content, 'utf-8');
        }

        // 4. 全部完成，写入成功状态
        this.updateStatus(SampleDataStatus.Succ);

      } catch (error) {
        console.error('Failed to prepare sample data:', error);
        this.updateStatus(SampleDataStatus.Fail);
        vscode.window.showErrorMessage(t('PyPTOToolkit.welcome.prepareFail', { error: error }) as string);
      } finally {
        // 解锁
        try {
          fs.rmdirSync(this.lockDir);
        } catch (e) {
          // 忽略解锁失败（可能已经被删了？）
          console.warn('Failed to remove lock dir:', e);
        }
      }
    });
  }

  // 获取样例数据状态
  getStatus(): SampleDataStatus {
    try {
      if (fs.existsSync(this.statusFile)) {
        const status = fs.readFileSync(this.statusFile, 'utf-8').trim();
        return status as SampleDataStatus;
      }
    } catch (e) {
      // ignore
    }
    return SampleDataStatus.Init;
  }

  // 更新样例数据状态
  updateStatus(status: SampleDataStatus) {
    try {
      // 确保存储 status 文件的目录存在
      if (!fs.existsSync(this.targetDataPath)) {
        fs.mkdirSync(this.targetDataPath, { recursive: true });
      }
      fs.writeFileSync(this.statusFile, status, 'utf-8');
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  }

  // 获取样例数据路径
  getSamplePath() {
    return this.targetDataPath;
  }
}
