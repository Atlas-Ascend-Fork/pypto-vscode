import type { CallOp, ExecuteFunction } from '../execute-graph';
import { PassStage } from '../workspace/pass';
import { ControlFlowNode } from './basic-node';

/**
 * 控制流PATH节点
 */
export interface ControlFlowPath extends ControlFlowNode {
  nodeType: 'PATH';

  meta: {
    /** 下属leaf function */
    leafFunctions: LeafFunction[];

    /** 下属leaf function被调用记录 */
    calledRecords: CallLeafRecord[];

    /** 调用所有leaf function记录 */
    calleeRecords: CallLeafRecord[];

    /** 优化过程 */
    passes: PathInPass[];
  };
}

export interface LeafFunction extends ExecuteFunction {
  /** 在PATH下的序号 */
  programId: string;
}

/**
 * root->leaf记录
 */
export interface CallLeafRecord extends CallOp {
  /** 调用方函数 */
  callerFunction: ExecuteFunction;

  /** 被调用方函数 */
  calleeFunction: LeafFunction;
}

/**
 * 单个优化过程内的PATH信息
 */
export interface PathInPass {
  /** 过程序号 */
  passIndex: string;

  /** 过程所属阶段 */
  passStage: PassStage;

  /** 过程名称 */
  passName: string;

  /** PATH名称 */
  pathName: string;

  /** 计算图文件路径 */
  graphFilePath: string;

  /** 是否有健康报告 */
  hasHealthReport: boolean;

  /** 当前过程调用的leaf function */
  leafFunctions: LeafInPass[];
}

/**
 * 单个优化过程内的PATH调用的Leaf信息
 */
export interface LeafInPass {
  /** 名称 */
  leafName: string;

  /** 是否属于当前PATH */
  isOwnedLeaf: boolean;

  /** PATH下的Leaf序号 */
  programId: string;

  /** Leaf计算图文件路径 */
  leafFilePath: string;

  /** 所属PATH的名称 */
  rootPathName: string;

  /** 所属PATH的计算图文件路径 */
  rootFilePath: string;
}
