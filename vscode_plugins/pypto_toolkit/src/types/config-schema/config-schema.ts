import * as vscode from 'vscode';

interface SchemaItem {
  description?: string;
  type: string;
  properties?: {
    [key: string]: SchemaItem;
  };
}

/**
 * 读取的Schema文件返回数据类型
 */
export interface PtoConfigSchemaResponseDto {
  additionalProperties: boolean;
  type: string;
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  properties: {
    [key: string]: SchemaItem;
  };
  required: string[];
  $comment: string;
}

interface PlatformConfigs {
  USE_SSA: boolean;
  ENABLE_COST_MODEL: boolean;
  ENABLE_DYN_COST_MODEL: boolean;
  ENABLE_DYN_FULL_COST_MODEL: boolean;
  ENABLE_AIHAC_BACKEND: boolean;
  ONLY_TENSOR_GRAPH: boolean;
  ONLY_HOST_COMPILE: boolean;
  PRINT_TENSOR_GRAPH: boolean;
  TEST_IS_TIG: boolean;
  ENABLE_SOFT_MEMORY: boolean;
  ENABLE_PV_DATA: boolean;
  DUMP_SOURCE_LOCATION: boolean;
  ENABLE_CHECKER: boolean;
  DEVICE_PLATFORM: string;
}

interface HostConfigs {
  STRATEGY: string;
  ENABLE_BINARY_CACHE: boolean;
  workspace_recycle_period: number;
  estimated_stitching_count: number;
  ONLY_CODEGEN: boolean;
  DUMP_BIN_AND_JSON: boolean;
  DUMP_BIN_AND_JSON_PATH: string;
  DUMP_KERNEL_NAME: string;
}

interface SimulationConfigs {
  DEBUG_SINGLE_FUNC: boolean;
  DEBUG_SINGLE_FUNCNAME: string;
  DRAW_FUNCTION_GRAPH: boolean;
  BUILD_TASK_BASED_TOPO: boolean;
  SIM_MODE: number;
  ACCURACY_LEVEL: number;
  PV_LEVEL: number;
  LOG_LEVEL: number;
  EXECUTE_CYCLE_THRESHOLD: number;
  JSON_PATH: string;
  AGENT_JSON_PATH: string;
  args: string[];
}

interface CodegenConfigs {
  PARALLEL_THREAN_NUM: number;
  SUPPORT_DYNAMIC_UNALIGNED: boolean;
  CODEGEN_BY_JSON: boolean;
  CODEGEN_DUMP_TO_OUTPUT: boolean;
  CODEGEN_FORCE_DUMP_CCE_ON_EXIST: boolean;
  CODEGEN_EXPRESSION_FUSION: boolean;
  COMPILE_CCE_BY_MACHINE: boolean;
  CODEGEN_SUPPORT_LAYOUT: boolean;
  CODEGEN_NEED_COMPILE: boolean;
}

interface OperationConfigs {
  FORCE_COMBINE_AXIS: boolean;
}

interface DistributedConfigs {
  AICPU_WAIT_FLAG_ENABLE: boolean;
}

interface GlobalConfigs {
  platform_configs: PlatformConfigs;
  host_configs: HostConfigs;
  device_configs: object; //文件未体现
  core_configs: object; //文件未体现
  simulation_configs: SimulationConfigs;
  codegen_configs: CodegenConfigs;
  operation_configs: OperationConfigs;
  distributed_configs: DistributedConfigs;
}

/**
 * 默认pass渲染的格式化数据
 */
export interface DefaultPassConfigsVo {
  PRINT_FUNCTION: boolean;
  PRINT_PROGRAM: boolean;
  DUMP_TENSOR_GRAPH: boolean;
  DUMP_TILE_GRAPH: boolean;
  DUMP_BLOCK_GRAPH: boolean;
  DUMP_FUNCTION_GRAPH_BEFORE_PASS: boolean;
  DUMP_FUNCTION_GRAPH_AFTER_PASS: boolean;
  DUMP_PASS_TIME_COST: boolean;
  PRE_CHECK: boolean;
  POST_CHECK: boolean;
  EXPECTED_VALUE_CHECK: boolean;
  DISABLE_PASS: boolean;
  HEALTH_CHECK: boolean;
}

interface PassGlobalConfigs {
  enable_pass_configs: boolean;
  enabled_last_pass_type: string;
  enable_cv_fuse: boolean;
  pass_thread_num: number;
  default_pass_configs: DefaultPassConfigsVo;
}

interface PVC2_OOOConfig {
  ExpandFunction: {
    EXPECTED_VALUE_CHECK: boolean;
  };
  SubgraphToFunction: {
    PRE_CHECK: boolean;
    POST_CHECK: boolean;
    USE_MAX_FREQ_LABEL: boolean;
  };
}

interface Strategies {
  Readme?: {
    [key: string]: {
      [key: string]: any;
    };
  };
  PVC2_OOO: PVC2_OOOConfig;
}

/**
 * 读取的config文件返回数据类型
 */
export interface TileFWKConfigResponseDto {
  version?: string;
  nbuffer_num?: number;
  l1_reuse_num?: number;
  cube_nbuffer_num?: number;
  cycle_upper_bound?: number;
  cycle_lower_bound?: number;
  parallel_threshold?: number;
  copyin_threshold: number;
  db_type?: number;
  global_configs: GlobalConfigs;
  pass_global_configs: PassGlobalConfigs;
  strategies: Strategies;
  $schema?: string;
}

/**
 * 更新自定义配置文件请求接口入参
 */
export interface updateTitleFWKConfigRequestDto {
  filePath: string;
  data: TileFWKConfigResponseDto;
}

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
export type RunConfigAttributeType = 'boolean' | 'number' | 'string' | 'enum' | 'array';

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
  type: T;
  label: { zh: string; en: string };
  defaultValue: ValueType<T>;
  options?: OptionsType<T>;
}
export interface SchemaProperty {
  type: string;
  defaultValue?: boolean | string | number;
  description?: { zh: string; en: string };
  options?: { value: boolean | string | number; description?: { zh: string; en: string } }[];
  properties?: Record<string, SchemaProperty>;
  items?: { type: string };
}

export interface SchemaType {
  additionalProperties: boolean;
  type: 'object';
  properties: {
    global_configs?: SchemaProperty;
    pass_global_configs?: SchemaProperty;
    strategies?: SchemaProperty;
  };
}

/**
 * schema Pass表格表单数据结构类型
 */
export interface TablePass {
  key: string;
  index: number;
}

export interface TableGlobalConfigs {
  key: string;
  label: { zh: string; en: string };
}

export interface PassFormTableaTemplate {
  pass: TablePass[];
  global_configs: TableGlobalConfigs[];
}
