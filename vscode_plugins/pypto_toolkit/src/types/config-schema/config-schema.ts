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
export type RunConfigAttributeType = 'boolean' | 'number' | 'string' | 'enum' | 'array:string' | 'array:number';

/**
 * schema转换后的数据结构
 */
export interface RunConfigAttribute<T extends RunConfigAttributeType = RunConfigAttributeType> {
  key: string;
  type: T;
  label: { zh: string; en: string };
  defaultValue?: RunConfigValue<T>;
  options: RunConfigAttributeOptions<T>;
  rules: RunConfigAttributeRule[];
}

export type RunConfigValue<T extends RunConfigAttributeType> = T extends 'boolean'
  ? boolean
  : T extends 'number'
  ? number
  : T extends 'string'
  ? string
  : T extends 'enum'
  ? string | number | boolean
  : T extends 'array:string'
  ? string[]
  : T extends 'array:number'
  ? number[]
  : never;

export type RunConfigAttributeOptions<T extends RunConfigAttributeType> = T extends 'enum'
  ? { value: RunConfigValue<T>; label: { zh: string; en: string } }[]
  : undefined;

export interface RunConfigAttributeRule {
  trigger?: 'change' | 'blur';

  message?: string;

  /** 必填 */
  required?: boolean;

  min?: number;

  max?: number;
}

export type RunConfigSchema = { key: string; label: string; attributes: RunConfigAttribute[] }[];

/**
 * 配置文件Schema属性类型
 */
export interface SchemaProperty {
  /** 属性类型 */
  type: 'boolean' | 'object' | 'array' | 'number' | 'string' | 'integer';
  /** 默认值 */
  default?: boolean | string | number | string[] | number[];
  /** 子属性 */
  properties?: Record<string, SchemaProperty>;
  /** 数组元素 */
  items?: { type: 'number' | 'string' | 'integer' };
  /** 【校验】最小值 */
  minimum?: number;
  /** 【校验】最大值 */
  maximum?: number;
  /** 【校验】枚举值 */
  enum?: (string | number)[];
  /** 属性名称 */
  label?: { zh: string; en: string };
  /** 枚举选项 */
  options?: { value: boolean | string | number; label?: { zh: string; en: string } }[];
}
