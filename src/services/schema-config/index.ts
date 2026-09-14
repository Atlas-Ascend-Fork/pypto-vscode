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
import path from 'node:path';

import { t } from 'i18next';
import { get, set } from 'lodash';
import * as vscode from 'vscode';

import { RunConfigAttributeType, RunConfigSchema } from '../../types/config-schema/config-schema';

import { readFwkData, writeFileData, getJsonFileList, delFile } from './configdata';
import { formatSchemaToAttributeGroups, readSchemaData } from './schemadata';

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
  const groupMap = formatSchemaToAttributeGroups(schemaData, configGroups);
  const groups: RunConfigSchema = [];
  for (const { key, label } of configGroups) {
    if (groupMap[key]?.length > 0) {
      groups.push({ key, label: label(), attributes: groupMap[key] });
    }
  }
  return groups;
}

/**
 * 获取指定Config数据
 * @param path 文件路径
 */
export async function getConfigsForRevise(path: string, schema: RunConfigSchema): Promise<Record<string, unknown>> {
  const configUri = vscode.Uri.file(path);
  const originalConfigData = await readFwkData(configUri);
  const configFormData: Record<string, unknown> = {};
  for (const group of schema) {
    for (const attribute of group.attributes) {
      configFormData[attribute.key] = getValueByType(get(originalConfigData, attribute.key), attribute.type);
    }
  }
  return configFormData;
}

/**
 * 更新指定Config仿真与Pass数据
 * @param path 文件路径
 * @param formData 表单数据
 * @returns 是否更新成功
 */
export async function updateConfigsFile(path: string, formData: Record<string, unknown>, schema: RunConfigSchema) {
  try {
    const configUri = vscode.Uri.file(path);
    const configData = await readFwkData(configUri);
    if (!configData) {
      return false;
    }

    const savingData = assignDeepWithSchema(configData, formData, schema);
    await writeFileData(configUri, savingData);
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`${(error as Error).message}`);
    return false;
  }
}

function getValueByType(sourceValue: unknown, type: RunConfigAttributeType) {
  if (type === 'boolean') {
    return getBooleanValue(sourceValue);
  } else if (type === 'number') {
    return getNumberValue(sourceValue);
  } else {
    return sourceValue;
  }
}

function getBooleanValue(sourceValue: unknown): boolean | undefined {
  if (typeof sourceValue === 'boolean') {
    return sourceValue;
  }
  if (String(sourceValue) === '1') {
    return true;
  }
  if (String(sourceValue) === '0') {
    return false;
  }
}

function getNumberValue(sourceValue: unknown): number | undefined {
  if (typeof sourceValue === 'number') {
    return sourceValue;
  }
  if (!isNaN(Number(sourceValue))) {
    return Number(sourceValue);
  }
}

/**
 * 深度合并两个对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
function assignDeepWithSchema(target: object, source: Record<string, unknown>, schema: RunConfigSchema): any {
  const result = { ...target };

  for (const group of schema) {
    for (const attribute of group.attributes) {
      if (Reflect.has(source, attribute.key)) {
        set(result, attribute.key, Reflect.get(source, attribute.key));
      }
    }
  }

  return result;
}
