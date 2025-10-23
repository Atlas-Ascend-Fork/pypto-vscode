import { PassStage } from './pass';

interface DirectoryOrFile {
  type: 'dir' | 'file';

  /** 目录或文件名称 */
  name: string;

  /** 绝对路径，例：/d:/demo-project/output/program.json */
  absolutePath: string;
}

interface CommonDirectory extends DirectoryOrFile {
  type: 'dir';

  /** 目录类型 */
  directoryType: 'output' | 'compute' | 'pass';

  /** 子目录或文件 */
  children: DirectoryOrFile[];
}

/**
 * 编译产物目录
 */
export interface OutputDirectory extends CommonDirectory {
  directoryType: 'output';

  /** 子目录或文件 */
  children: (ControlFlowFile | SwimlaneGraphFile | ComputeDirectory)[];
}

/**
 * 计算图目录
 */
export interface ComputeDirectory extends CommonDirectory {
  directoryType: 'compute';

  children: PassDirectory[];
}

/**
 * 编译过程目录
 */
export interface PassDirectory extends CommonDirectory {
  directoryType: 'pass';

  /** 过程所属的阶段 */
  passStage: PassStage;

  /** Pass序号 */
  passIndex: string;

  /** 子目录或文件 */
  children: ComputeGraph[];
}

interface CommonFile extends DirectoryOrFile {
  type: 'file';

  /** 文件类型 */
  fileType: 'controlFlow' | 'computeGraph' | 'swimlaneGraph';

  /** 文件后缀 */
  extname: string;

  /** 所属output绝对路径 */
  outputPath: string;
}

/**
 * 控制流
 */
export interface ControlFlowFile extends CommonFile {
  fileType: 'controlFlow';
}

/**
 * 计算图
 */
export interface ComputeGraph extends CommonFile {
  fileType: 'computeGraph';

  /** 所属pass序号 */
  passIndex: string;

  /** root名称 */
  pathName: string;

  /** 计算图类型 */
  computeType: 'all' | 'root' | 'leaf';

  /** leaf的序号 */
  leafProgramId: string | null;

  /** leaf function的hash值 */
  leafHash: string | null;
}

/**
 * 泳道图
 */
export interface SwimlaneGraphFile extends CommonFile {
  fileType: 'swimlaneGraph';
}
