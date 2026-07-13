/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
/**
 * program.json文件内容
 */
export interface ProgramOutput {
  /** 入口函数hash */
  entryhash: string;

  /** 所有函数 */
  functions: FunctionNode[];

  /** program版本 */
  version: string;
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
  graphtype: number;

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

  /** 源文件地址 */
  file: string;

  /** 源代码起始行 */
  line: number;
}

/** 条件分支 [条件(波兰式), 是否满足] */
export type DynamicCondition = [(string | number)[], boolean];
