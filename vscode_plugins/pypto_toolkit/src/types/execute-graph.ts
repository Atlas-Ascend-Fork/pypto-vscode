/**
 * 执行图函数
 */
export interface ExecuteFunction {
  /** function索引（唯一） */
  magic: number;

  /** function名称（包含父级信息） */
  magicName: string;

  /** function内容hash加密的值（执行图阶段唯一） */
  hash: string;
}

/**
 * 执行图函数调用关系
 */
export interface CallOp {
  /** 调用方hash */
  callerHash: string;

  /** 被调用方hash */
  calleeHash: string;
}
