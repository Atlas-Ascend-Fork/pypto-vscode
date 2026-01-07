import * as vscode from 'vscode';

/**
 * 自定义配置列表渲染的格式化数据
 */
export interface CustomConfigItemVo {
  configName: string;
  configBaseName: string;
  configPath: string;
}

/**
 * 配置文件信息类型
 */
export interface ConfigFileInfo {
  /** 文件唯一URI */
  uri: vscode.Uri;
  /** 文件绝对路径 */
  path: string;
  /** 文件名 */
  fileName: string;
  /** 所在工作区名称 */
  workspaceName: string;
  /** 最后修改时间 */
  lastModified: Date;
  /** 文件大小（字节） */
  size: number;
}

/**
 * 扫描状态类型
 */
export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'failed';

/**
 * schema仿真数据结构类型
 */
export type RunConfigAttributeType = 'boolean' | 'number' | 'string' | 'enum' | 'array' | 'array:string' | 'array:number';

export type ValueType<T extends RunConfigAttributeType> = T extends 'boolean'
  ? boolean
  : T extends 'number'
  ? number
  : T extends 'string'
  ? string
  : T extends 'enum'
  ? string | number | undefined
  : T extends 'array'
  ? boolean | string | number[]
  : never;

export type OptionsType<T extends RunConfigAttributeType> = T extends 'enum'
  ? { value: ValueType<T>; label: { zh: string; en: string } }[]
  : undefined;

/**
 * schema转换后的数据结构
 */
export interface RunConfigAttribute<T extends RunConfigAttributeType> {
  key: string;
  type: T;
  label: { zh: string; en: string };
  defaultValue: ValueType<T>;
  options?: OptionsType<T>;
}

export type RunConfigSchema = { key: string; label: string; attributes: RunConfigAttribute<any>[] }[];

export interface SchemaProperty {
  type: 'boolean' | 'object' | 'array' | 'number' | 'string' | 'integer';
  default?: boolean | string | number;
  properties?: Record<string, SchemaProperty>;
  items?: { type: 'number' | 'string' | 'integer' };
  label?: { zh: string; en: string };
  options?: { value: boolean | string | number; label?: { zh: string; en: string } }[];
}
