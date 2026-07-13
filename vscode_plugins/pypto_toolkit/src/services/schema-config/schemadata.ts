/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import * as vscode from 'vscode';

import {
  SchemaProperty,
  RunConfigAttribute,
  RunConfigAttributeType,
  RunConfigAttributeOptions,
  RunConfigAttributeRule,
} from '../../types/config-schema/config-schema';
import { t } from 'i18next';

const SCHEMA_FILE_NAME = 'tile_fwk_config_schema.json';
const SCHEMA_FILE_PATH = `/framework/src/interface/configs/${SCHEMA_FILE_NAME}`;

type ConfigGroups = { key: string; glob: string[] }[];

type RunConfigAttributeMap = Record<string, RunConfigAttribute[]>;

/**
 * 读取Schema_fwk_config文件
 */
export async function readSchemaData(): Promise<SchemaProperty | null> {
  const schemaFiles = await vscode.workspace.findFiles(`**/${SCHEMA_FILE_NAME}`);
  for (const fileUri of schemaFiles) {
    if (fileUri.path.endsWith(SCHEMA_FILE_PATH)) {
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      try {
        return JSON.parse(fileContent.toString());
      } catch (e) {
        console.error(e);
        return null;
      }
    }
  }
  return null;
}

/**
 * 将schema文件配置转换为动态表单数据结构
 * @param schema schema文件配置
 * @param configGroups 动态表单分组
 */
export function formatSchemaToAttributeGroups(schema: SchemaProperty, configGroups: ConfigGroups): RunConfigAttributeMap {
  if (!schema.properties) {
    return {};
  }
  const globs = configGroups.flatMap(({ key, glob }) => glob.map((item) => ({ searcher: item.replace('*', ''), groupKey: key })));
  globs.sort((a, b) => b.searcher.search(/\.[^*]/) - a.searcher.search(/\.[^*]/));
  const attributes = searchForAttributes(schema.properties);
  const groups: RunConfigAttributeMap = Object.fromEntries(configGroups.map((item) => [item.key, []]));
  for (const attribute of attributes) {
    for (const { groupKey, searcher } of globs) {
      if (attribute.key.startsWith(searcher)) {
        groups[groupKey].push(attribute);
        break;
      }
    }
  }
  return groups;
}

/**
 * 递归搜索Schema属性，将嵌套的属性结构扁平化为RunConfigAttribute数组
 * @param properties 要搜索的Schema属性对象
 * @param prefix 可选的前缀字符串，用于构建嵌套属性的完整键名
 */
function searchForAttributes(properties: NonNullable<SchemaProperty['properties']>, prefix?: string): RunConfigAttribute[] {
  return Object.entries(properties).flatMap(([key, schema]): RunConfigAttribute[] => {
    const keyWithPrefix = prefix ? `${prefix}.${key}` : key;
    if (schema.properties) {
      return searchForAttributes(schema.properties, keyWithPrefix);
    } else if (schema.type === 'object') {
      return [];
    } else {
      return [
        {
          key: keyWithPrefix,
          type: getAttributeType(schema),
          label: { zh: schema.label?.zh ?? keyWithPrefix, en: schema.label?.en ?? keyWithPrefix },
          defaultValue: schema.default,
          options: getAttributeOptions(schema),
          rules: getAttributeRules(schema),
        },
      ];
    }
  });
}

function getAttributeType(schema: SchemaProperty): RunConfigAttributeType {
  if (schema.options) {
    return 'enum';
  }
  if (schema.type === 'integer') {
    return 'number';
  }
  if (schema.type === 'array') {
    const itemType = schema.items?.type === 'integer' ? 'number' : schema.items?.type ?? 'string';
    return `array:${itemType}`;
  }
  if (schema.type === 'object') {
    return 'string';
  }
  return schema.type;
}

function getAttributeOptions(schema: SchemaProperty): RunConfigAttributeOptions<RunConfigAttributeType> {
  return schema.options?.map((item) => ({ value: item.value, label: item.label ?? { zh: String(item.value), en: String(item.value) } }));
}

function getAttributeRules(schema: SchemaProperty): RunConfigAttributeRule[] {
  const rules: RunConfigAttributeRule[] = [];
  if (schema.type === 'integer' || schema.type === 'number') {
    rules.push(...getNumberAttributeRules(schema));
  } else if (schema.type === 'string') {
    rules.push(...getStringAttributeRules(schema));
  } else if (schema.type === 'array') {
    rules.push(...getArrayAttributeRules(schema));
  }
  return rules;
}

function getNumberAttributeRules(schema: SchemaProperty): RunConfigAttributeRule[] {
  const rules: RunConfigAttributeRule[] = [];
  if (schema.minimum !== undefined) {
    rules.push({
      type: schema.type,
      min: schema.minimum,
      message: t('PyPTOToolkit.runConfig.rule.min', { min: schema.minimum.toString() }) ?? undefined,
      trigger: 'blur',
    });
  }
  if (schema.maximum !== undefined) {
    rules.push({
      type: schema.type,
      max: schema.maximum,
      message: t('PyPTOToolkit.runConfig.rule.max', { max: schema.maximum.toString() }) ?? undefined,
      trigger: 'blur',
    });
  }
  return rules;
}

function getStringAttributeRules(schema: SchemaProperty): RunConfigAttributeRule[] {
  const rules: RunConfigAttributeRule[] = [];
  if (schema.minLength !== undefined) {
    rules.push({
      type: schema.type,
      min: schema.minLength,
      message: t('PyPTOToolkit.runConfig.rule.minLength', { min: schema.minLength.toString() }) ?? undefined,
      trigger: 'blur',
    });
  }
  if (schema.maxLength !== undefined) {
    rules.push({
      type: schema.type,
      max: schema.maxLength,
      message: t('PyPTOToolkit.runConfig.rule.maxLength', { max: schema.maxLength.toString() }) ?? undefined,
      trigger: 'blur',
    });
  }
  if (schema.pattern !== undefined) {
    rules.push({
      type: schema.type,
      pattern: schema.pattern,
      message: t('PyPTOToolkit.runConfig.rule.patternNotMatch', { pattern: schema.pattern }) ?? undefined,
    });
  }
  return rules;
}

function getArrayAttributeRules(schema: SchemaProperty): RunConfigAttributeRule[] {
  const rules: RunConfigAttributeRule[] = [];
  if (schema.minItems !== undefined) {
    rules.push({
      type: schema.type,
      min: schema.minItems,
      message: t('PyPTOToolkit.runConfig.rule.minItems', { min: schema.minItems.toString() }) ?? undefined,
      trigger: 'blur',
    });
  }
  if (schema.maxItems !== undefined) {
    rules.push({
      type: schema.type,
      max: schema.maxItems,
      message: t('PyPTOToolkit.runConfig.rule.maxItems', { max: schema.maxItems.toString() }) ?? undefined,
      trigger: 'blur',
    });
  }
  if (schema.uniqueItems !== undefined) {
    rules.push({
      type: schema.type,
      unique: schema.uniqueItems,
      message: t('PyPTOToolkit.runConfig.rule.unique') ?? undefined,
      trigger: 'blur',
    });
  }
  return rules;
}
