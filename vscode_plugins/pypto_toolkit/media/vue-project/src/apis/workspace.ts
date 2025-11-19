import { request, RequestOptions } from '../core/request';
import type {
  GetOutputDetailParams,
  GetOutputDetailRes,
  GetOutputRecordParams,
  GetOutputRecordsRes,
} from '../../../../src/services/workspace';
import { CustomConfigItem, PtoConfigSchemaModel, TileFWKConfig, updateTitleFWKConfigParams } from 'ext:/types/workspace/config-schema';

const WORKSPACE_PREFIX = 'workspace';

/**
 * 获取所有运行记录
 */
export function getOutputRecords(params: GetOutputRecordParams, options?: RequestOptions): Promise<GetOutputRecordsRes> {
  return request.post(`${WORKSPACE_PREFIX}/getOutputRecords`, params, options);
}

/**
 * 获取运行记录详情（子目录）
 */
export function getOutputDetail(outputDirPath: string): Promise<GetOutputDetailRes> {
  const params: GetOutputDetailParams = { outputDirPath };
  return request.post(`${WORKSPACE_PREFIX}/getOutputDetail`, params);
}

/**
 * 获取自定义配置列表
 */
export function getCustomFileList(): Promise<CustomConfigItem[]> {
  return request.post(`${WORKSPACE_PREFIX}/getCustomFileList`, null);
}

/**
 * 获取配置schema
 */
export function getSchemaData(): Promise<PtoConfigSchemaModel> {
  return request.post(`${WORKSPACE_PREFIX}/getSchemaData`, null);
}

/**
 * 获取配置fwkConfig
 */
export function getTileFwkConfigData(configDirPath: string): Promise<TileFWKConfig> {
  return request.post(`${WORKSPACE_PREFIX}/getTileFwkConfigData`, configDirPath);
}

/**
 * 更新配置fwkConfig
 */
export function updateFwkConfigData(params: updateTitleFWKConfigParams) {
  return request.post(`${WORKSPACE_PREFIX}/updateFwkConfigData`, params);
}

/**
 * 删除配置fwkConfig
 */
export function delCustomFile(configDirPath: string) {
  return request.post(`${WORKSPACE_PREFIX}/delCustomFile`, configDirPath);
}

/**
 * 新增自定义配置
 * @param configName 自定义配置名
 * @returns 是否新增成功
 */
export function addCustomFile(configName: string): Promise<boolean> {
  return request.post(`${WORKSPACE_PREFIX}/addNewFwkConfigFile`, configName);
}
