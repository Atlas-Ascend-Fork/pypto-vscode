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
import { ControlFlowIf, ControlFlowLoop, ControlFlowPath, FunctionNode, FunctionType, ProgramOutput } from '../../types/control-flow';
import { PassDirectory } from '../../types/workspace';

import { ConditionAnalyzer } from './condition';
import { PathLeafAnalyzer } from './path-leaf';
import { functionNodeToExecuteFunction, getLanguageIdByFilePath } from './utils';

/**
 * 解析控制流树
 */
export class FlowTreeAnalyzer {
  /** 以hash为键的function */
  private functionHashMap: Map<string, FunctionNode> = new Map();

  /** 以magic为键的function */
  private functionMagicMap: Map<number, FunctionNode> = new Map();

  private conditionAnalyzer: ConditionAnalyzer;

  private pathLeafAnalyzer: PathLeafAnalyzer;

  constructor(private program: ProgramOutput, passes: PassDirectory[]) {
    this.allFunctionsToMap(program.functions);
    this.conditionAnalyzer = new ConditionAnalyzer(program.version);
    this.pathLeafAnalyzer = new PathLeafAnalyzer(this.functionHashMap, this.functionMagicMap, passes);
  }

  public getControlFlow(): (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[] {
    const entryFunction = this.functionHashMap.get(this.program.entryhash)!;
    const controlFlow: (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[] = [];
    for (const operation of entryFunction.operations) {
      const calleeFunction = this.functionHashMap.get(operation.calleehash!)!;
      if (calleeFunction.functype === FunctionType.DYNAMIC) {
        controlFlow.push(this.readDynamicFunction(calleeFunction));
      } else if (calleeFunction.functype === FunctionType.PATH) {
        controlFlow.push(...this.readPathFunction(calleeFunction));
      } else {
        throw new Error(`未知的根节点类型（functype: ${calleeFunction.functype},hash: ${calleeFunction.hash}）`);
      }
    }
    this.pathLeafAnalyzer.calculateLeafFunctionCalledRecords();
    return controlFlow;
  }

  private allFunctionsToMap(functions: FunctionNode[]) {
    for (const functionNode of functions) {
      this.functionHashMap.set(functionNode.hash, functionNode);
      this.functionMagicMap.set(functionNode.funcmagic, functionNode);
    }
  }

  /**
   * 读取 循环 or 循环+条件 节点
   * @param functionNode
   * @returns
   */
  private readDynamicFunction(functionNode: FunctionNode): ControlFlowLoop {
    const loopFunction: ControlFlowLoop = {
      nodeType: 'LOOP',
      ...functionNodeToExecuteFunction(functionNode),
      sourceCode: {
        filePath: functionNode.file ? functionNode.file : '',
        startLine: functionNode.file ? (functionNode.line - 5 > 0 ? functionNode.line - 5 : 0) : 0,
        endLine: functionNode.file ? functionNode.line + 5 : 0,
        line: functionNode.file ? functionNode.line : 0,
        language: functionNode.file ? getLanguageIdByFilePath(functionNode.file) : '',
      },
      children: [],
    };

    if (this.conditionAnalyzer.hasCondition(functionNode)) {
      loopFunction.children.push(
        this.conditionAnalyzer.resolveConditionUntilPath(functionNode, (operation) => {
          const calleeFunction = this.getCalleeFunctionByOperation(operation)!;
          return this.pathLeafAnalyzer.makePathFunction(calleeFunction);
        }),
      );
    } else {
      const calleeFunction = this.getCalleeFunctionByOperation(functionNode.operations[0])!;
      loopFunction.children.push(...this.readPathFunction(calleeFunction));
    }

    return loopFunction;
  }

  /**
   * 读取 叶子节点 or 串行动态方法
   * 全是叶子节点返回单个PATH / 全是自动调用返回多个LOOP / 混合（第一个是动态）所有操作按动态处理 / 混合（第一个为叶子节点）逐个判断
   * @param functionNode
   * @param context
   * @returns
   */
  private readPathFunction(functionNode: FunctionNode): (ControlFlowPath | ControlFlowLoop)[] {
    const operations = functionNode.operations;

    const firstOperation = operations[0];
    const firstCalleeFunction = this.getCalleeFunctionByOperation(firstOperation);
    const firstNoCalleeHash = !Reflect.has(firstOperation, 'calleehash');
    const firstIsLeaf = firstNoCalleeHash || !firstCalleeFunction || firstCalleeFunction.functype !== FunctionType.DYNAMIC;

    const allLeaf = operations.every((operation) => {
      const calleeFunction = this.getCalleeFunctionByOperation(operation);
      const noCalleeHash = !Reflect.has(operation, 'calleehash');
      return noCalleeHash || !calleeFunction || calleeFunction.functype !== FunctionType.DYNAMIC;
    });

    const allDynamic = operations.every((operation) => {
      const calleeFunction = this.getCalleeFunctionByOperation(operation);
      return Reflect.has(operation, 'calleehash') && calleeFunction && calleeFunction.functype === FunctionType.DYNAMIC;
    });

    if (allLeaf) {
      return [this.pathLeafAnalyzer.makePathFunction(functionNode)];
    }

    if (allDynamic) {
      return operations.map((operation) => {
        const calleeFunction = this.getCalleeFunctionByOperation(operation)!;
        return this.readDynamicFunction(calleeFunction);
      });
    }

    if (firstIsLeaf && functionNode.graphtype === 2) {
      const results: (ControlFlowPath | ControlFlowLoop)[] = [];
      for (const operation of operations) {
        const calleeFunction = this.getCalleeFunctionByOperation(operation);
        const noCalleeHash = !Reflect.has(operation, 'calleehash');
        const isLeaf = noCalleeHash || !calleeFunction || calleeFunction.functype !== FunctionType.DYNAMIC;

        if (isLeaf) {
          results.push(this.pathLeafAnalyzer.makePathFunction(functionNode));
        } else {
          results.push(this.readDynamicFunction(calleeFunction!));
        }
      }
      return results;
    }

    return operations.map((operation) => {
      const calleeFunction = this.getCalleeFunctionByOperation(operation);
      if (calleeFunction && calleeFunction.functype === FunctionType.DYNAMIC) {
        return this.readDynamicFunction(calleeFunction);
      }
      return this.pathLeafAnalyzer.makePathFunction(functionNode);
    });
  }

  private getCalleeFunctionByOperation(operation: FunctionNode['operations'][number]): FunctionNode | undefined {
    if (!operation.calleehash) {
      return undefined;
    }
    return this.functionHashMap.get(operation.calleehash);
  }
}
