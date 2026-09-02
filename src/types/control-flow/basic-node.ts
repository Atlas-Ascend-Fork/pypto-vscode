/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { ExecuteFunction } from '../execute-graph';

/**
 * 控制流节点
 */
export interface ControlFlowNode extends ExecuteFunction {
  /** 节点类型 */
  nodeType: 'LOOP' | 'IF' | 'PATH';

  /** 子节点 */
  children?: ControlFlowNode[];

  /** 源代码配置 */
  sourceCode?: {
    /** 源代码文件路径 */
    filePath: string;

    /** 源代码开始行数 */
    startLine: number;

    /** 源代码结束行数 */
    endLine: number;

    /** 源代码指定行 */
    line: number;

    /** 源代码语言类型 */
    language: string;
  };

  /** 节点自定义数据 */
  meta?: unknown;
}

/**
 * 控制流节点读取源码
 */
export interface SourceCodeRequestDto {
  /** 源代码文件路径 */
  filePath: string;

  /** 源代码开始行数 */
  startLine: number;

  /** 源代码结束行数 */
  endLine: number;

  /** 源代码指定行 */
  line: number;
}
