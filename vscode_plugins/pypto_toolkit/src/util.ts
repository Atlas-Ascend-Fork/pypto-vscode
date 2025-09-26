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
    const config = workspace.getConfiguration('PyPTOToolkit');
    return {
      tensorAttr: config.get('tensorAttr'),
      tensorColor: config.get('tensorColor'),
      operationAttr: config.get('operationAttr'),
      operationColor: config.get('operationColor'),
    };
  }

  static getSwimGraphCustomCfg() {
    const config = workspace.getConfiguration('PyPTOToolkit');
    // 仅对shortcut进行检测
    const configKeys = ['ZoomInShortcut', 'ZoomOutShortcut', 'leftmoveShortcut', 'rightmoveShortcut'];
    const seenShortCut = new Set();
    const result = {};
    for (const key of configKeys) {
      const value = config.get(key);
      if (value !== undefined && value !== null) {
        const lowerCaseValue = value.toString().toLowerCase();
        if (seenShortCut.has(lowerCaseValue)) {
          window.showWarningMessage(t('pypto.configWarning'), t('pypto.configImprove')).then((selection) => {
            if (selection === t('pypto.configImprove')) {
              commands.executeCommand('workbench.action.openSettings', '@ext:hismartliteopen.pypto-toolkit shortcut');
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
    return result;
  }

  static getCachePath() {
    const extensionPath = hismartliteEx.extensionPath;
    const cacheDir = join(dirname(extensionPath), 'PyPTOToolkitCache');
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir);
    }
    const cachePath = join(cacheDir, 'swim2com.json');
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

  static writeSwim2ComGraphMap(cachePath: string, data: { [swimPath: string]: string }) {
    try {
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
