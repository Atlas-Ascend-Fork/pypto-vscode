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
import { genMathScalarExpr } from '../../core/json-graph/parseSymbolicAttr';
import { ControlFlowIf, ControlFlowPath, DynamicCondition, FunctionNode } from '../../types/control-flow';

type PendingChildrenNode = Omit<ControlFlowIf, 'children'> & { children: PendingChildrenNode[] | ControlFlowPath[] };

/**
 * 解析IF-ELSE条件分支
 * @description 条件分支一定是平衡二叉树
 */
export class ConditionAnalyzer {
  private version: string;

  constructor(version: string) {
    this.version = version;
  }

  /**
   * 函数是否包含条件分支
   */
  public hasCondition(functionNode: FunctionNode): boolean {
    return Boolean(functionNode.dynamic?.paths?.length);
  }

  /**
   * 解析条件分支直到Path节点
   */
  public resolveConditionUntilPath(
    functionNode: FunctionNode,
    getPathFunction: (operation: FunctionNode['operations'][number]) => ControlFlowPath,
  ) {
    const conditionPaths = functionNode.dynamic!.paths!;

    const [conditionTree, leafNodes] = this.generateConditionTree(conditionPaths);

    for (let conditionPath of conditionPaths) {
      const [callMagic, conditions] = conditionPath;
      const callOperation = functionNode.operations.find((item) => item.opmagic === callMagic)!;
      const pathFunction = getPathFunction(callOperation);
      this.pushPathToLeafNode(leafNodes, conditions, pathFunction);
    }
    return conditionTree;
  }

  /**
   * 生成条件树
   * @param conditionPaths
   */
  private generateConditionTree(conditionPaths: [number, DynamicCondition[]][]): [ControlFlowIf, PendingChildrenNode[]] {
    // 所有path条件表达式相同，从第一个path获取所有条件
    const conditions = conditionPaths[0][1].map((item) => item[0]);

    // 根节点
    const rootExpression = genMathScalarExpr(conditions[0], this.version) ?? '';
    let rootNode: PendingChildrenNode = this.makePendingChildrenNode(rootExpression);
    let leafNodes: PendingChildrenNode[] = [rootNode];

    // 平衡二叉树，每个条件增加一层分支
    for (let level = 1; level < conditions.length; level++) {
      const parentNodes = leafNodes;
      leafNodes = [];
      for (const parentNode of parentNodes) {
        const conditionExpression = genMathScalarExpr(conditions[level], this.version) ?? '';
        const left: PendingChildrenNode = this.makePendingChildrenNode(conditionExpression);
        const right: PendingChildrenNode = this.makePendingChildrenNode(conditionExpression);
        parentNode.children = [left, right];
        leafNodes.push(left, right);
      }
    }
    return [rootNode as ControlFlowIf, leafNodes];
  }

  /**
   * 将path函数插入二叉树最下层
   */
  private pushPathToLeafNode(leafNodes: PendingChildrenNode[], conditions: DynamicCondition[], pathFunction: ControlFlowPath): void {
    const operationIndex = this.getOperationIndex(conditions);
    const leafIndex = Math.floor(operationIndex / 2);
    const childrenIndex = operationIndex % 2;
    leafNodes[leafIndex].children[childrenIndex] = pathFunction;
  }

  /**
   * 计算条件在二叉树最下层的序号
   */
  private getOperationIndex(conditions: DynamicCondition[]): number {
    // 条件为true插入1，条件为false插入0，获得二进制数字
    const binaryIndex = conditions.reduce((res, condition) => `${res}${condition[1] ? '0' : '1'}`, '');
    return parseInt(binaryIndex, 2);
  }

  private makePendingChildrenNode(conditionExpression: string): PendingChildrenNode {
    return {
      nodeType: 'IF',
      magic: -1,
      magicName: conditionExpression,
      hash: '',
      children: [],
    };
  }
}
