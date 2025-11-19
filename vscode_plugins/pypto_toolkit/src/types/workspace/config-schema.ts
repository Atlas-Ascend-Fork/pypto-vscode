interface SchemaItemModel {
  description: string;
  type: string;
  properties?: {
    [key: string]: SchemaItemModel;
  };
}

export interface PtoConfigSchemaModel {
  $schema: string;
  $id: string;
  title: string;
  description: string;
  type: string;
  properties: {
    [key: string]: SchemaItemModel;
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

export interface DefaultPassConfigs {
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
  default_pass_configs: DefaultPassConfigs;
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
  Readme: {
    [key: string]: {
      [key: string]: any;
    };
  };
  PVC2_OOO: PVC2_OOOConfig;
}

export interface TileFWKConfig {
  version: string;
  nbuffer_num: number;
  l1_reuse_num: number;
  cube_nbuffer_num: number;
  cycle_upper_bound: number;
  cycle_lower_bound: number;
  parallel_threshold: number;
  copyin_threshold: number;
  db_type: number;
  global_configs: GlobalConfigs;
  pass_global_configs: PassGlobalConfigs;
  strategies: Strategies;
  $schema: string;
}

export interface updateTitleFWKConfigParams {
  filePath: string;
  data: TileFWKConfig;
}

export interface CustomConfigItem {
  configName: string;
  configBaseName: string;
  configPath: string;
}
