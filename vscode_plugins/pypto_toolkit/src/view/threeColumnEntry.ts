import { window, workspace } from 'vscode';
import { dirname, join, basename } from 'path';
import { existsSync, readdirSync } from 'fs';
import { t } from 'i18next';

export class Fider {
  public codePath: undefined | string;
  public swimPath: undefined | string;
  public comPath: undefined | string;

  constructor(codePath?: string, swimPath?: string, comPath?: string) {
    this.codePath = codePath;
    this.swimPath = swimPath;
    this.comPath = comPath;
  }

  async findByCodePath(
    swimPath: string | undefined,
    comPath: string | undefined,
  ): Promise<{ swimPath: string | undefined; comPath: string | undefined }> {
    if (!this.codePath) {
      return { swimPath: undefined, comPath: undefined };
    }
    if (swimPath && comPath) {
      return { swimPath, comPath };
    }
  
    // 情况2: 两个路径都未提供 - 自动查找最新输出目录
    if (!swimPath && !comPath) {
      const autoPaths = await this.tryFindLatestOutputPaths();
      const { swimPath: foundSwim, comPath: foundCom } = autoPaths;
      if (foundSwim && foundCom) {
        return autoPaths;
      }
      // 如果没有目录或者目录里既没有泳道也没有计算，回退到手动选择
      if (!foundSwim && !foundCom) {
        return await this.handleNoPathsProvided(this.codePath);
      }
      // 任意一个没有，说明用户取消了，直接返回
      return { swimPath: undefined, comPath: undefined };
    }
  
    // 情况3: 只有泳道图路径
    if (swimPath) {
      return await this.handleOnlySwimPathProvided(this.codePath, swimPath);
    }
  
    // 情况4: 只有计算图路径
    if (comPath) {
      return await this.handleOnlyComPathProvided(this.codePath, comPath);
    }
  
    return { swimPath, comPath };
  }

  private async tryFindLatestOutputPaths(): Promise<{ swimPath: string | undefined; comPath: string | undefined }> {
    try {
      // 获取工作区根目录
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0 || !this.codePath) {
        return { swimPath: undefined, comPath: undefined };
      }
  
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const outputDir = join(workspaceRoot, 'build', 'tests', 'st', 'output');
  
      // 检查输出目录是否存在
      if (!existsSync(outputDir)) {
        return { swimPath: undefined, comPath: undefined };
      }
  
      // 读取目录，查找以 output_ 开头的目录
      const items = readdirSync(outputDir, { withFileTypes: true });
      const outputDirs = items
        .filter(item => item.isDirectory() && item.name.startsWith('output_'))
        .map(item => join(outputDir, item.name));
  
      if (outputDirs.length === 0) {
        return { swimPath: undefined, comPath: undefined };
      }
  
      // 按目录名称排序（假设目录名包含时间戳，新的在后面）
      outputDirs.sort((a, b) => {
        const nameA = basename(a);
        const nameB = basename(b);
        return nameB.localeCompare(nameA);
      });
      const latestDir = outputDirs[0];
  
      // 在该目录下查找 program.json 和 merged_swimlane.json
      const possibleComPath = join(latestDir, 'program.json');
      const possibleSwimPath = join(latestDir, 'merged_swimlane.json');
  
      const comPathExists = existsSync(possibleComPath);
      const swimPathExists = existsSync(possibleSwimPath);
  
      if (comPathExists && swimPathExists) {
        window.showInformationMessage(`${t('pypto.useLatest')}${basename(latestDir)}`);
        return {
          swimPath: possibleSwimPath,
          comPath: possibleComPath
        };
      }
      if (comPathExists) {
        this.comPath = possibleComPath;
        return this.handleOnlyComPathProvided(this.codePath, possibleComPath);
      }
      if (swimPathExists) {
        this.swimPath = possibleSwimPath;
        return await this.handleOnlySwimPathProvided(this.codePath, possibleSwimPath);
      }
  
    } catch (error) {
      console.error('自动查找输出目录时出错:', error);
    }
  
    return { swimPath: undefined, comPath: undefined };
  }

  private async handleNoPathsProvided(codePath: string) {
    // 第一步：选择泳道图路径
    const swimPath = await this.selectFile(t('pypto.selectSwimFile'));
  
    if (!swimPath) {
      window.showWarningMessage(t('pypto.noSwimFileSelect'));
      return { codePath, swimPath: undefined, comPath: undefined };
    }
  
    // 第二步：尝试自动查找同目录的计算图文件
    return this.handleOnlySwimPathProvided(codePath, swimPath);
  }

  private async handleOnlySwimPathProvided(codePath: string, swimPath: string) {
    // 尝试自动查找同目录的计算图文件
    let comPath = await this.findComPathBySwimPath(swimPath);
  
    if (!comPath) {
      // 如果没找到，让用户选择计算图路径
      comPath = await this.selectFile(t('pypto.selectComFile'));
      if (comPath) {
        // 如果用户选择的计算图同目录有配套的泳道图文件，则使用配套的
        const autoSwimPath = await this.findSwimPathByComPath(comPath);
        if (autoSwimPath) {
          return { codePath, swimPath: autoSwimPath, comPath };
        }
      }
    }
  
    return { codePath, swimPath, comPath };
  }
  

  private async handleOnlyComPathProvided(codePath: string, comPath: string) {
    // 尝试自动查找同目录的泳道图文件
    let swimPath = await this.findSwimPathByComPath(comPath);
  
    if (!swimPath) {
      // 如果没找到，让用户选择泳道图路径
      swimPath = await this.selectFile(t('pypto.selectSwimFile'));
      if (swimPath) {
        // 如果用户选择的泳道图同目录有配套的计算图文件，则使用配套的
        const autoComPath = await this.findComPathBySwimPath(swimPath);
        if (autoComPath) {
          return { codePath, swimPath, comPath: autoComPath };
        }
      }
    }
  
    return { codePath, swimPath, comPath };
  }

  private async findComPathBySwimPath(swimPath: string): Promise<string | undefined> {
    const swimDir = dirname(swimPath);
    const possibleComPath = join(swimDir, 'program.json');
  
    try {
      if (existsSync(possibleComPath)) {
        return possibleComPath;
      }
    } catch (error) {
      console.error('检查计算图文件存在时出错:', error);
    }
  
    return undefined;
  }

  private async findSwimPathByComPath(comPath: string): Promise<string | undefined> {
    const comDir = dirname(comPath);
    const possibleSwimPath = join(comDir, 'merged_swimlane.json');
  
    try {
      if (existsSync(possibleSwimPath)) {
        return possibleSwimPath;
      }
    } catch (error) {
      console.error('检查泳道图文件存在时出错:', error);
    }
  
    return undefined;
  }

  private async selectFile(
    title: string,
  ): Promise<string | undefined> {
    const fileUris = await window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      openLabel: `${title}`,
      filters: {
        [t('pypto.jsonFile')]: ['json'],
        [t('pypto.allFile')]: ['*']
      },
      title: title,
    });
  
    if (fileUris && fileUris.length > 0) {
      return fileUris[0].fsPath;
    }
  
    return undefined;
  }
}
