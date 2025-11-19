import path from 'node:path';

import * as vscode from 'vscode';

import { OutputDetail, OutputRecord, RunDataManifest } from '../../types/workspace';
import { hasOutputRunData, readOutputRunData } from './rundata';
import { getOutputDirectory } from './scan-directory';
import { delFile, getJsonFileList, readFwkData, readSchemaData, writeSchemaData } from './configdata';
import { PtoConfigSchemaModel, TileFWKConfig, updateTitleFWKConfigParams } from '../../types/workspace/config-schema';

export interface GetOutputRecordParams {
  /** 算子源文件 */
  operatorSourceFile?: string;

  /** 排序属性 */
  sortBy?: 'executeTime';

  /** 正序 or 倒序 */
  sortOrder?: 'asc' | 'desc';
}

export interface GetOutputRecordsRes {
  data: OutputRecord[];
}

/** 当前用户根目录 */
const USER_HOME_PATH = process.env.HOME || process.env.USERPROFILE;

/** PYPTO运行记录根目录 */
const RUN_DATA_HOME = process.env.PYPTO_HOME
  ? `${process.env.PYPTO_HOME}${path.sep}run`
  : `${USER_HOME_PATH}${path.sep}.pypto${path.sep}run`;

/** PYPTO配置文件目录文件夹名 */
const CONFIG_PATH = 'config';

/** PYPTO自定义配置文件目录文件夹名 */
const CUSTOM_CONFIG_PATH = 'customConfigurations';

/** PYPTO配置文件文件名 */
const TILE_FWK_FILE_NAME = 'tile_fwk_config.json';

/**
 * 获取运行结果记录
 */
export async function getOutputRecords(params: GetOutputRecordParams): Promise<GetOutputRecordsRes> {
  const { sortBy = 'executeTime', sortOrder = 'desc' } = params;
  const outputCollectionUri = vscode.Uri.file(RUN_DATA_HOME);
  if (!outputCollectionUri) {
    return { data: [] };
  }

  const records: OutputRecord[] = await getRecordsFromDirectory(outputCollectionUri);

  // 执行排序
  records.sort((a, b) => {
    const sortFlag = sortOrder === 'asc' ? 1 : -1;
    return a[sortBy] > b[sortBy] ? sortFlag : sortFlag;
  });

  return { data: records };
}

export interface GetOutputDetailParams {
  outputDirPath: string;
}

export interface GetOutputDetailRes {
  data: OutputDetail;
}

/**
 * 获取运行结果详情
 */
export async function getOutputDetail(params: GetOutputDetailParams): Promise<GetOutputDetailRes> {
  const outputUri = vscode.Uri.file(params.outputDirPath);
  const runData = await readOutputRunData(outputUri);
  const record = getOutputRecord(outputUri, runData);
  const detail = {
    ...record,
    directoryTree: await getOutputDirectory(outputUri, record),
  };
  return { data: detail };
}

/**
 * 获取指定目录下的编译记录
 */
async function getRecordsFromDirectory(directoryUri: vscode.Uri): Promise<OutputRecord[]> {
  let subList: [string, vscode.FileType][];
  try {
    subList = await vscode.workspace.fs.readDirectory(directoryUri);
  } catch {
    // 文件夹不存在
    subList = [];
  }

  const records: OutputRecord[] = [];
  for (const [subPath, fileType] of subList) {
    if (fileType !== vscode.FileType.Directory) {
      continue;
    }
    const rootDirUri = vscode.Uri.joinPath(directoryUri, subPath);
    if (await isOutputDirectory(rootDirUri)) {
      const runData = await readOutputRunData(rootDirUri);
      const record = getOutputRecord(rootDirUri, runData);
      records.push(record);
    }
  }

  return records;
}

const OutputDirectoryRegExp = /^rundata_(\d{14})/;

/**
 * 是否是编译产物目录
 */
async function isOutputDirectory(uri: vscode.Uri): Promise<boolean> {
  const isLegalPath = OutputDirectoryRegExp.test(path.basename(uri.path));
  const hasRunData = await hasOutputRunData(uri);
  return isLegalPath && hasRunData;
}

/**
 * 获取output记录
 */
export function getOutputRecord(outputUri: vscode.Uri, runData: RunDataManifest): OutputRecord {
  const directoryPath = outputUri.path;
  const sourceFilePath = runData.pto_src_file || null;
  const controlFlowFilePath = runData.program_file || null;
  const swimlaneGraphFilePath = runData.swim_graph_path || null;
  const computeGraphDirPath = runData.compute_graph_path || null;

  const directoryName = path.posix.basename(directoryPath);
  const [_, timestamp] = directoryName.match(OutputDirectoryRegExp) ?? [];
  const executeDate = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
  const executeTime = `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}`;
  return {
    title: `${runData.runtype}_${timestamp.slice(0, 8)}_${timestamp.slice(8, 14)}`,
    executeTime: `${executeDate} ${executeTime}`,
    directoryPath,
    sourceFilePath,
    controlFlowFilePath,
    swimlaneGraphFilePath,
    computeGraphDirPath,
  };
}

/**
 * 获取Schema文件数据
 * @returns Schema对象
 */
export async function getSchemaData() {
  const outputCollectionUri = vscode.Uri.joinPath(vscode.Uri.file(RUN_DATA_HOME), CONFIG_PATH);
  if (!outputCollectionUri) {
    return { data: [] };
  }
  const schemaData: PtoConfigSchemaModel = await readSchemaData(outputCollectionUri);
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
  const fwkData: TileFWKConfig = await readFwkData(tileFwkConfigUri);
  return fwkData;
}

/**
 * 更新指定路径下的config文件
 * @param params 指定文件路径，以及更新后的数据对象
 */
export async function updateFwkConfigData(params: updateTitleFWKConfigParams) {
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
