import path from 'node:path';

import { t } from 'i18next';
import { has, get, set } from 'lodash-es';
import * as vscode from 'vscode';

import { RunConfigSchema } from '../../types/config-schema/config-schema';

import { readFwkData, writeFileData, getJsonFileList, delFile, CONFIG_FILE_NAME } from './configdata';
import { formatSchemaToGroups, readSchemaData } from './schemadata';

/** PYPTO配置文件目录文件夹名 */
const CONFIG_PATH = 'config';
/** PYPTO自定义配置文件目录文件夹名 */
const CUSTOM_CONFIG_PATH = 'customConfigurations';

/** 当前用户根目录 */
const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;

/** PYPTO运行记录根目录 */
export const RUN_DATA_HOME = process.env.PYPTO_HOME
  ? `${process.env.PYPTO_HOME}${path.sep}run`
  : `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

/**
 * 获取自定义配置文件列表
 * @returns 自定义配置文件列表
 */
export async function getCustomFileList() {
  const outputCollectionUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH, CUSTOM_CONFIG_PATH);
  const jsonFileList = await getJsonFileList(outputCollectionUri);
  return jsonFileList;
}

/**
 * 删除指定文件
 * @param configPath 需要删除的指定文件路径
 */
export async function delCustomFile(configPath: string) {
  const tileFwkCustomConfigUri = vscode.Uri.file(configPath);
  await delFile(tileFwkCustomConfigUri);
}

/**
 * 新增自定义配置文件
 * @param fileName 新增的配置文件名
 */
export async function addNewFwkConfigFile(fileName: string) {
  try {
    const newFwkConfigFileUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH, CUSTOM_CONFIG_PATH, `${fileName}.json`);
    const defaultFwkConfigUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH, CONFIG_FILE_NAME);
    const defaultFwkConfigData = await readFwkData(defaultFwkConfigUri);
    await writeFileData(newFwkConfigFileUri, defaultFwkConfigData);
    return true;
  } catch (err) {
    vscode.window.showErrorMessage(`${(err as Error).message}`);
    return false;
  }
}

const configGroups = [
  { key: 'pass', label: () => t('PyPTOToolkit.runConfig.group.pass'), glob: ['pass.*'] },
  {
    key: 'debug',
    label: () => t('PyPTOToolkit.runConfig.group.debug'),
    glob: ['operator.*', 'verify.*', 'tensor_print.*', 'codegen.*', 'host.*', 'debug.*'],
  },
  { key: 'simulation', label: () => t('PyPTOToolkit.runConfig.group.simulation'), glob: ['simulation.*'] },
  { key: 'runtime', label: () => t('PyPTOToolkit.runConfig.group.runtime'), glob: ['runtime.*'] },
  { key: 'others', label: () => t('PyPTOToolkit.runConfig.group.others'), glob: ['*'] },
];

/**
 * 从schema文件中解析出数组模板
 */
export async function getConfigsTemplate(): Promise<RunConfigSchema | null> {
  const schemaData = await readSchemaData();
  if (!schemaData) {
    return null;
  }
  const groupMap = formatSchemaToGroups(schemaData, configGroups);
  const groups: RunConfigSchema = [];
  for (const { key, label } of configGroups) {
    if (groupMap[key]?.length > 0) {
      groups.push({ key, label: label(), attributes: groupMap[key] });
    }
  }
  return groups;
}

/**
 * 获取指定Config仿真与Pass数据
 * @param path 文件路径
 */
export async function getConfigsForRevise(path: string): Promise<object> {
  const configUri = vscode.Uri.file(path);
  if (!configUri) {
    return {
      tag: false,
      simulationConfig: {},
      passConfig: {},
    };
  }
  return await readFwkData(configUri);
}

/**
 * 更新指定Config仿真与Pass数据
 * @param path 文件路径
 * @param data 包含simulationConfig和passConfig的对象
 * @returns 是否更新成功
 */
export async function updateConfigsFile(path: string, data: object, schema: RunConfigSchema) {
  try {
    const configUri = vscode.Uri.file(path);
    const configData = await readFwkData(configUri);
    if (!configData) {
      return false;
    }

    const savingData = assignDeepWithSchema(configData, data, schema);
    await writeFileData(configUri, savingData);
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`${(error as Error).message}`);
    return false;
  }
}

/**
 * 深度合并两个对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
function assignDeepWithSchema(target: object, source: object, schema: RunConfigSchema): any {
  const result = { ...target };

  for (const group of schema) {
    for (const attribute of group.attributes) {
      if (has(source, attribute.key)) {
        set(result, attribute.key, get(source, attribute.key));
      }
    }
  }

  return result;
}
