import { request } from '@/core/request';
import {
  CustomConfigItemVo,
  PtoConfigSchemaResponseDto,
  TileFWKConfigResponseDto,
  updateTitleFWKConfigRequestDto,
} from 'ext:/types/config-schema/config-schema';

const CONFIG = 'config';

/**
 * 获取自定义配置列表
 */
export function getCustomFileList(): Promise<CustomConfigItemVo[]> {
  return request.post(`${CONFIG}/getCustomFileList`, null);
}

/**
 * 获取配置schema
 */
export function getSchemaData(): Promise<PtoConfigSchemaResponseDto> {
  return request.post(`${CONFIG}/getSchemaData`, null);
}

/**
 * 获取配置fwkConfig
 */
export function getTileFwkConfigData(configDirPath: string): Promise<TileFWKConfigResponseDto> {
  return request.post(`${CONFIG}/getTileFwkConfigData`, configDirPath);
}

/**
 * 更新配置fwkConfig
 */
export function updateFwkConfigData(params: updateTitleFWKConfigRequestDto) {
  return request.post(`${CONFIG}/updateFwkConfigData`, params);
}

/**
 * 删除配置fwkConfig
 */
export function delCustomFile(configDirPath: string) {
  return request.post(`${CONFIG}/delCustomFile`, configDirPath);
}

/**
 * 新增自定义配置
 * @param configName 自定义配置名
 * @returns 是否新增成功
 */
export function addCustomFile(configName: string): Promise<boolean> {
  return request.post(`${CONFIG}/addNewFwkConfigFile`, configName);
}
