import { workspace, window, commands } from 'vscode';
import { dirname, join, basename } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { hismartliteEx } from './hismarliteEx';
import { t } from 'i18next';

export interface DiffInfo {
  afterJson?: Record<string, any>;
  afterFileName?: string;
  beforeJson?: Record<string, any>;
  beforeFileName?: string;
  beforeFilePath?: string;
}

export class Util {
  replaceHtmlFromData(replaceParams: any[], html: string) {
    for (let i = 0, len = replaceParams.length; i < len; i++) {
      const curParam = replaceParams[i];
      if (html.includes(curParam.name)) {
        let reg = new RegExp(curParam.name, 'g');
        html = html.replace(reg, curParam.value);
      }
    }
    return html;
  }

  static getComGraphCustomCfg() {
    const config = workspace.getConfiguration('PyPTOToolkitOpen');
    const vscodeConfig = {
      tensorAttr: config.get('tensorAttr') as string,
      tensorColor: config.get('tensorColor') as string,
      operationAttr: config.get('operationAttr') as string,
      operationColor: config.get('operationColor') as string,
    };

    return {
      tensorAttrFunc: eval(vscodeConfig.tensorAttr),
      tensorColorFunc: eval(vscodeConfig.tensorColor),
      operationAttrFunc: eval(vscodeConfig.operationAttr),
      operationColorFunc: eval(vscodeConfig.operationColor)
    }
  }

  static getSwimGraphCustomCfg() {
    const config = workspace.getConfiguration('PyPTOToolkitOpen');
    // 仅对shortcut进行检测
    const configKeys = ['ZoomInShortcut', 'ZoomOutShortcut', 'leftmoveShortcut', 'rightmoveShortcut'];
    const seenShortCut = new Set();
    const result = {};
    for (const key of configKeys) {
      const value = config.get(key);
      if (value) {
        const lowerCaseValue = value.toString().toLowerCase();
        if (seenShortCut.has(lowerCaseValue)) {
          window.showWarningMessage(t('pypto.configWarning'), t('pypto.configImprove')).then((selection) => {
            if (selection === t('pypto.configImprove')) {
              commands.executeCommand('workbench.action.openSettings', '@ext:cann-pub.pypto-toolkit shortcut');
            }
          });
        } else {
          seenShortCut.add(lowerCaseValue);
          result[key] = value;
        }
      }
    }
    // 添加connectionLevel配置
    result['connectionLevel'] = config.get('connectionLevel');
    result['showPerformancePanel'] = config.get('showPerformancePanel');
    result['showIsMixMode'] = config.get('showIsMixMode');
    return result;
  }

  static getCachePath(filename: string) {
    const extensionPath = hismartliteEx.extensionPath;
    const cacheDir = join(dirname(extensionPath), 'PyPTOToolkitCache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir);
    }
    const cachePath = join(cacheDir, filename);
    if (!existsSync(cachePath)) {
      writeFileSync(cachePath, '{}', 'utf-8');
    }
    return cachePath;
  }

  static readSwim2ComGraphMap(cachePath: string) {
    try {
      return JSON.parse(readFileSync(cachePath, 'utf-8'));
    } catch (err) {
      console.error('Failed to parse mapping cahce', err);
    }
    return {};
  }

  static writeJsonCache<T>(cachePath: string, data: T ): void {
    if (!cachePath) {
      console.error('Failed to read cachePath');
    }
    try {
      writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write mapping cache:', err);
    }
  }
  static writeSwimConfigMap(cachePath: string, paramObj: string) {
    try {
      const JsedparamObj = JSON.parse(paramObj);
      const existingData = this.readSwim2ComGraphMap(cachePath);
      const data = {
        ...existingData,
        colorRending: JsedparamObj.kernelColorRending,
        textRending: JsedparamObj.kernelTextRending,
        hashOrderRending: JsedparamObj.hashOrderRending,
        aicpuColorRending: JsedparamObj.aicpuColorRending,
        perfColorReding: JsedparamObj.perfColorReding,
      }
      writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write mapping cache:', err);
    }
  }
}

export function getFileNameByPath(fsPath: string) {
  return basename(fsPath).replace('.json', '');
}

export function getDiffInfo(fsPath: string, ret: Record<string, any>) {
  const curFile = basename(fsPath);
  const result: DiffInfo = {
    beforeFileName: curFile.replace('.json', ''),
    beforeJson: ret,
    beforeFilePath: fsPath,
  };
  return result;
}

export function getOtherFilePath(fsPath: string) {
  const curFile = basename(fsPath);
  let res: string = '';
  if (curFile.toLocaleLowerCase().startsWith('after')) {
    res = fsPath.replace(curFile, `Before${curFile.slice(5)}`);
  }
  if (curFile.toLocaleLowerCase().startsWith('before')) {
    res = fsPath.replace(curFile, `After${curFile.slice(6)}`);
  }
  if (res && existsSync(res)) {
    return res;
  }
}

export function getDebugFilename(prefix: string = 'comgraph', ext: string = '.json'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份从0开始
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const timestamp = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  return `${prefix}_${timestamp}${ext}`;
}
