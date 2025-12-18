import { SchemaType, PassFormTableaTemplate, TablePass, RunConfigAttribute, ReadSchemaData } from '../../types/config-schema/config-schema';
import * as vscode from 'vscode';
import { getConfigAttributes } from './utils';

/**
 * 生成 pass_global_configs 与 PVC2_OOO 的表格表单数据
 * @param schema 传入schema 对象
 */
export function generatePassStrategyTemplate(schema: SchemaType, passKey: string): PassFormTableaTemplate {
  // 提取global_configs数据
  const passGlobalConfigs = schema.properties?.pass_global_configs;
  const defaultValuePassConfigs = passGlobalConfigs?.properties?.default_pass_configs;
  const defaultPassConfigsProps = defaultValuePassConfigs?.properties || {};
  const defaultPassConfigs = getConfigAttributes(defaultPassConfigsProps);

  // 提取pass阶段数据（PVC2_OOO）
  const properties = schema.properties;
  const passExecutionOrder = properties.pass_execution_order;
  const passDefault = passExecutionOrder.default;

  // 构建表格pass阶段数据
  const pass: TablePass[] = [];
  passDefault.forEach((key, index) => pass.push({ key, index }));

  // 构建global_configs数据
  const global_configs: RunConfigAttribute<any>[] = Object.entries(defaultPassConfigs).map(([key, config]) => {
    key = `${passKey}.${key}`;
    return {
      key,
      label: config.label,
      defaultValue: config.defaultValue,
      type: config.type,
    };
  });

  const result = { pass, global_configs };
  return result;
}

/**
 * 生成 simulator_configs 的数组结构数据
 * @param schema 传入schema 对象
 */
export function generateSimulatorConfigsArray(schema: SchemaType, SimulationKey: string): Array<RunConfigAttribute<any>> {
  const globalConfigs = schema.properties?.global_configs;
  const simulatorConfigs = globalConfigs?.properties?.simulation_configs;
  const simulatorConfigsProps = simulatorConfigs?.properties || {};

  const simulatorConfigsMap = getConfigAttributes(simulatorConfigsProps);
  const result = Object.entries(simulatorConfigsMap).map(([key, config]) => {
    key = `${SimulationKey}.${key}`;
    return {
      key,
      ...config,
    };
  });
  return result;
}

/** schema文件名称，todo schema文件读取路径 */
const CONFIG_SCHEMA_FILE_NAME = 'tile_fwk_config_schema.json';

/**
 * 读取Schema_fwk_config文件
 */
export async function readSchemaData(baseUri: vscode.Uri): Promise<ReadSchemaData> {
  try {
    const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(baseUri, CONFIG_SCHEMA_FILE_NAME));
    return {
      tag: true,
      schemaData: JSON.parse(fileContent.toString()),
    };
  } catch (error) {
    vscode.window.showErrorMessage(`${(error as Error).message}`);
    return {
      tag: false,
    };
  }
}
