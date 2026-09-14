/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.

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
