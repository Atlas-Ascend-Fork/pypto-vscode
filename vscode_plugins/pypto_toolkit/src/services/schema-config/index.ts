import * as vscode from 'vscode';
import { SchemaType, TileFWKConfigResponseDto, updateTitleFWKConfigRequestDto } from '../../types/config-schema/config-schema';
import { readFwkData, writeSchemaData, getJsonFileList, delFile } from './configdata';
import path from 'node:path';
import { generatePassStrategyTemplate, generateSimulatorConfigsArray, readSchemaData } from './schemadata';

/** PYPTO配置文件目录文件夹名 */
const CONFIG_PATH = 'config';
/** PYPTO自定义配置文件目录文件夹名 */
const CUSTOM_CONFIG_PATH = 'customConfigurations';
/** PYPTO配置文件文件名 */
const TILE_FWK_FILE_NAME = 'tile_fwk_config.json';

/** 当前用户根目录 */
const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;

/** PYPTO运行记录根目录 */
export const RUN_DATA_HOME = process.env.PYPTO_HOME
  ? `${process.env.PYPTO_HOME}${path.sep}run`
  : `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

/**
 * 获取Schema文件数据
 * @returns Schema对象
 */
export async function getSchemaData() {
  const outputCollectionUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH);
  if (!outputCollectionUri) {
    return { data: [] };
  }
  const schemaData: SchemaType = await readSchemaData(outputCollectionUri);
  return schemaData;
}

/**
 * 获取指定路径下的config配置对象
 * @param configPath 指定路径
 * @returns 指定路径下的config配置对象
 */
export async function getTileFwkConfigData(configPath: string) {
  const tileFwkConfigUri = vscode.Uri.file(configPath);
  if (!tileFwkConfigUri) {
    return { data: [] };
  }
  const fwkData: TileFWKConfigResponseDto = await readFwkData(tileFwkConfigUri);
  return fwkData;
}

/**
 * 更新指定路径下的config文件
 * @param params 指定文件路径，以及更新后的数据对象
 */
export async function updateFwkConfigData(params: updateTitleFWKConfigRequestDto) {
  const { filePath, data } = params;
  const outputCollectionUri = vscode.Uri.file(filePath);
  await writeSchemaData(outputCollectionUri, data);
}

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
    const defaultFwkConfigUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH, TILE_FWK_FILE_NAME);
    const defaultFwkConfigData = await readFwkData(defaultFwkConfigUri);
    await writeSchemaData(newFwkConfigFileUri, defaultFwkConfigData);
    return true;
  } catch (err) {
    vscode.window.showErrorMessage(`${(err as Error).message}`);
    return false;
  }
}

/**
 * 从schema文件中解析出生成Pass表格的二维数组模板
 */
export async function getPassTableTemplate() {
  const configUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH);
  if (!configUri) {
    return { data: [] };
  }
  const schemaData = await readSchemaData(configUri);
  const passTableTemplate = await generatePassStrategyTemplate(schemaData);
  return passTableTemplate;
}

/**
 * 从schema文件中解析出生成Simulator的数组模板
 */
export async function getSimulatorConfigsTemplate() {
  const configUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH);
  if (!configUri) {
    return { data: [] };
  }
  const schemaData = await readSchemaData(configUri);
  const simulatorConfigsTemplate = await generateSimulatorConfigsArray(schemaData);
  return simulatorConfigsTemplate;
}
