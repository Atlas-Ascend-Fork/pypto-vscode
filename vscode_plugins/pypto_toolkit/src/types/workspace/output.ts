import { OutputDirectory } from './directory-tree';

/**
 * 运行数据声明文件
 */
export interface RunDataManifest {
  /** 运行类型（例：simulation、onChip） */
  runtype: string;

  /** 源码路径 */
  pto_src_file: string;

  /** 计算图目录 */
  compute_graph_path: string;

  /** 泳道图目录 */
  swim_graph_path: string;
}

export interface OutputRecord {
  dir: OutputDirectory;
}
