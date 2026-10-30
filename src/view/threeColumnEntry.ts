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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

 */
import { window, workspace } from 'vscode';
import { dirname, join, basename } from 'path';
import { existsSync, readdirSync } from 'fs';
import { Util } from '../util';
import { t } from 'i18next';

export class Fider {
  public codePath: undefined | string;
  public swimPath: undefined | string;
  public comPath: undefined | string;
  public cachePath: undefined | string;

  constructor(codePath?: string, swimPath?: string, comPath?: string) {
    this.codePath = codePath;
    this.swimPath = swimPath;
    this.comPath = comPath;
  }

  async findByCodePath(
    swimPath: string | undefined,
    comPath: string | undefined,
  ): Promise<{ swimPath: string | undefined; comPath: string | undefined; runDataTitle: string | undefined}> {
    if (!this.codePath) {
      return { swimPath: undefined, comPath: undefined, runDataTitle: undefined };
    }
    if (swimPath && comPath) {
      return { swimPath, comPath, runDataTitle: undefined};
    }
  
    // 情况2: 两个路径都未提供 - 自动查找最新输出目录
    if (!swimPath && !comPath) {
      this.cachePath = Util.getCachePath('threeViewFiles.json');
      const cachedPaths = await this.getCachedPaths();
      if (cachedPaths) {
        return cachedPaths;
      }
      const autoPaths = await this.tryFindLatestOutputPaths();
      const { swimPath: autoSwimPath, comPath: autoComPath } = autoPaths;
      return {swimPath: autoSwimPath, comPath: autoComPath, runDataTitle: undefined};
    }
    // 任意一个没有，说明用户取消了，直接返回
    return { swimPath: swimPath || undefined, comPath: comPath || undefined, runDataTitle: undefined };
  }

  private async getCachedPaths(): Promise<{ swimPath: string | undefined; comPath: string | undefined; runDataTitle: string | undefined } | undefined> {
    this.cachePath = Util.getCachePath('threeViewFiles.json');
    if (!this.cachePath || !this.codePath) {
      return undefined;
    }
    const cache = Util.readSwim2ComGraphMap(this.cachePath);
    const cacheData = cache?.[this.codePath];
    if (!cacheData) {
      return undefined;
    }
    const { swimPath, comPath, runDataTitle } = cacheData;
    return {
      swimPath: swimPath || undefined,
      comPath: comPath || undefined,
      runDataTitle: runDataTitle || undefined
    };
  }

  private async tryFindLatestOutputPaths(): Promise<{ swimPath: string | undefined; comPath: string | undefined }> {
    try {
      // 获取工作区根目录
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0 || !this.codePath) {
        return { swimPath: undefined, comPath: undefined };
      }
  
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const outputDir = join(workspaceRoot, 'output');
  
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
      return {
        swimPath: swimPathExists ? possibleSwimPath : undefined,
        comPath: comPathExists ? possibleComPath : undefined
      };
    } catch (error) {
      console.error('自动查找输出目录时出错:', error);
    }
  
    return { swimPath: undefined, comPath: undefined };
  }
  async selectPath(graphType: string): Promise<{ path: string | undefined}>  {
    if (graphType === "editor") {
      const codePath = await this.selectFile(t('pypto.selectCodeFile'), 'py');
      if (!codePath) {
        window.showWarningMessage(t('pypto.noCodeFileSelect'));
        return {path: undefined };
      }
      return {path: codePath };
    } else if (graphType === "swimGraph") {
      const swimPath = await this.selectFile(t('pypto.selectSwimFile'));
      if (!swimPath) {
        window.showWarningMessage(t('pypto.noSwimFileSelect'));
        return {path: undefined };
      }
      return {path: swimPath };
    } else if (graphType === "comGraph") {
      const comPath = await this.selectFile(t('pypto.selectComFile'));
      if (!comPath) {
        window.showWarningMessage(t('pypto.noComFileSelect'));
        return { path: undefined };
      }
      return {path: comPath };
    } else if (graphType === "cce") {
      const ccePath = await this.selectFile(t('pypto.selectCodeFile'), 'cce', true);
      if (!ccePath) {
        window.showWarningMessage(t('pypto.noCodeFileSelect'));
        return { path: undefined };
      }
      return { path: ccePath };
    }
    return {path: undefined};
  }

  async handleUserSelect(graphType: string): Promise<{ swimPath: string | undefined; comPath: string | undefined }>  {
    if (graphType === "swimGraph") {
      const swimPath = await this.selectFile(t('pypto.selectSwimFile'));
      if (!swimPath) {
        window.showWarningMessage(t('pypto.noSwimFileSelect'));
        return {swimPath: undefined, comPath: undefined };
      }
      const res = await this.handleOnlySwimPathProvided(swimPath);
      return res;
    } else if (graphType === "computeGraph" || graphType === "comGraph") {
      const comPath = await this.selectFile(t('pypto.selectComFile'));
      if (!comPath) {
        window.showWarningMessage(t('pypto.noComFileSelect'));
        return {swimPath: undefined, comPath: undefined };
      }
      const res = await this.handleOnlyComPathProvided(comPath);
      return res;
    }
    return {swimPath: undefined, comPath: undefined };
  }


  private async handleOnlySwimPathProvided(swimPath: string) {
    // 尝试自动查找同目录的计算图文件
    let comPath = await this.findComPathBySwimPath(swimPath);
    return {swimPath, comPath };
  }
  

  private async handleOnlyComPathProvided(comPath: string) {
    // 尝试自动查找同目录的泳道图文件
    let swimPath = await this.findSwimPathByComPath(comPath);
    return { swimPath, comPath };
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
    filters: 'json' | 'cpp' | 'py' | 'all' | 'cce' = 'json',
    canSelectFolders = false
  ): Promise<string | undefined> {
    const filterCfg = {
      json: {
        [t('pypto.jsonFile')]: ['json'],
        [t('pypto.allFile')]: ['*']
      },
      cpp: {
        [t('pypto.cppFile')]: ['cpp', 'h', 'hpp', 'py'],
        [t('pypto.allFile')]: ['*']
      },
      cce: {
        [t('pypto.cppFile')]: ['cpp'],
        [t('pypto.allFile')]: ['*']
      },
      py: {
        [t('pypto.pyFile')]: ['py'],
        [t('pypto.allFile')]: ['*']
      },
      all: {
        [t('pypto.allFile')]: ['*']
      },                  
    };
    const fileUris = await window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders,
      canSelectMany: false,
      openLabel: `${title}`,
      filters: filterCfg[filters],
      title: title,
    });
  
    if (fileUris && fileUris.length > 0) {
      return fileUris[0].fsPath;
    }
  
    return undefined;
  }
}
