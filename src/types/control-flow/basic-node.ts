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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
