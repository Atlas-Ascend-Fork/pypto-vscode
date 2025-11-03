/**
 * program.json文件内容
 */
export interface ProgramOutput {
  /** 入口函数hash */
  entryhash: string;

  /** 所有函数 */
  functions: FunctionNode[];
}

/** 函数类型 */
export const enum FunctionType {
  /** 动态函数（循环、条件分支） */
  DYNAMIC = 3,

  /** 顺序执行的函数 */
  PATH = 4,
}

/** 函数节点 */
export interface FunctionNode {
  functype: FunctionType;

  /** 执行图id（唯一） */
  funcmagic: number;

  /** 父级函数的执行图id */
  parent_funcmagic?: number;

  /** 执行图节点名称 */
  func_magicname: string;

  /** 执行图节点名称(无magic) */
  rawname: string;

  /** hash值用来查询调用关系 */
  hash: string;

  /** 调用的其他函数或算子 */
  operations: { calleehash?: string; opmagic?: number }[];

  /** 直属leaf function 的 magic 清单 */
  programs?: number[];

  /** 动态函数属性 */
  dynamic?: {
    /** 条件路径 [operation.opmagic， [[条件, 是否满足条件], ...]] */
    paths?: [number, DynamicCondition[]][];
  };
}

/** 条件分支 [条件(波兰式), 是否满足] */
export type DynamicCondition = [(string | number)[], boolean];
