import {
  SchemaType,
  PassFormTableaTemplate,
  TablePass,
  RunConfigAttribute,
  TableGlobalConfigs,
} from '../../types/config-schema/config-schema';
import * as vscode from 'vscode';
import { getConfigAttributes } from './utils';

/**
 * 生成 pass_global_configs 与 PVC2_OOO 的表格表单数据
 * @param schema 传入schema 对象
 */
export function generatePassStrategyTemplate(schema: SchemaType): PassFormTableaTemplate {
  // 提取global_configs数据
  const passGlobalConfigs = schema.properties?.pass_global_configs;
  const defaultValuePassConfigs = passGlobalConfigs?.properties?.defaultValue_pass_configs;
  const defaultPassConfigsProps = defaultValuePassConfigs?.properties || {};
  const defaultPassConfigs = getConfigAttributes(defaultPassConfigsProps);

  // 提取pass阶段数据（PVC2_OOO）
  const strategies = schema.properties?.strategies;
  const pvc2OOO = strategies?.properties?.PVC2_OOO;
  const pvc2OOOProps = pvc2OOO?.properties || {};
  const pvc2OOOConfigs = getConfigAttributes(pvc2OOOProps);

  // 构建表格pass阶段数据
  const pass: TablePass[] = [
    ...Object.entries(pvc2OOOConfigs).map(([colKey], index) => {
      return {
        index,
        key: colKey,
      };
    }),
  ];

  // 构建global_configs数据
  const global_configs: TableGlobalConfigs[] = Object.entries(defaultPassConfigs).map(([key, config]) => ({
    key,
    label: config.label,
  }));

  const result = { pass, global_configs };
  return result;
}

/**
 * 生成 simulator_configs 的数组结构数据
 * @param schema 传入schema 对象
 */
export function generateSimulatorConfigsArray(schema: SchemaType): Array<RunConfigAttribute<any> & { key: string }> {
  const globalConfigs = schema.properties?.global_configs;
  const simulatorConfigs = globalConfigs?.properties?.simulator_configs;
  const simulatorConfigsProps = simulatorConfigs?.properties || {};

  const simulatorConfigsMap = getConfigAttributes(simulatorConfigsProps);
  const result = Object.entries(simulatorConfigsMap).map(([key, config]) => ({
    key,
    ...config,
  }));

  return result;
}

const CONFIG_SCHEMA_FILE_NAME = 'schema.json';

/**
 * 读取Schema_fwk_config文件
 */
export async function readSchemaData(baseUri: vscode.Uri): Promise<SchemaType> {
  const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(baseUri, CONFIG_SCHEMA_FILE_NAME));
  return JSON.parse(fileContent.toString());
}
