import { OutputDirectory } from './directory-tree';

/**
 * 运行数据声明文件
 */
export interface RunDataManifest {
  /** 运行类型（例：simulation、onChip） */
  runtype?: string;

  /** 源码路径 */
  pto_src_file?: string;

  /** 控制流路径 */
  program_file?: string;

  /** 计算图目录 */
  compute_graph_path?: string;

  /** 泳道图目录 */
  swim_graph_path?: string;
}

export type OutputRecord = Omit<OutputDetail, 'directoryTree'>;

export interface OutputDetail {
  /** 标题 */
  title: string;

  /** 执行时间 */
  executeTime: string;

  /** rundata文件夹地址 */
  directoryPath: string;

  /** 文件目录树 */
  directoryTree: OutputDirectory | null;

  /** 源代码文件地址 */
  sourceFilePath: string | null;

  /** 控制流文件地址 */
  controlFlowFilePath: string | null;

  /** 泳道图文件地址 */
  swimlaneGraphFilePath: string | null;

  /** 计算图目录地址 */
  computeGraphDirPath: string | null;

  /** 是否存在ope校验 */
  hasOpeCheck: boolean;

  /** ope校验目录路径 */
  opeCheckDirPath: string[] | null;
}
