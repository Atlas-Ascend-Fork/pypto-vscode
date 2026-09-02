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
