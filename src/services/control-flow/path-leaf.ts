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
import type { CallLeafRecord, ControlFlowPath, FunctionNode, LeafFunction, LeafInPass, PathInPass } from '../../types/control-flow';
import type { ExecuteFunction } from '../../types/execute-graph';
import { ComputeGraph, PassDirectory, PassStage } from '../../types/workspace';

import { functionNodeToExecuteFunction, getFunctionName } from './utils';

/**
 * 解析PATH函数和下属leaf functions
 */
export class PathLeafAnalyzer {
  /** 所有path */
  private pathFunctions: ControlFlowPath[] = [];

  private leafFunctionHashMap: Map<string, LeafFunction> = new Map();

  /** leaf function被调用 */
  private leafFunctionCalledMap: Map<string, ExecuteFunction[]> = new Map();

  private passFiles: {
    roots: Record<string, ComputeGraph>;
    leafs: Record<string, ComputeGraph> | null;
    passName: string;
    passStage: PassStage;
  }[] = [];

  /**
   * @param functionHashMap 所有函数(key: hash)
   * @param functionMagicMap 所有函数(key: magic)
   */
  constructor(
    private functionHashMap: Map<string, FunctionNode>,
    private functionMagicMap: Map<number, FunctionNode>,
    passes: PassDirectory[],
  ) {
    this.scanAllPasses(passes);
  }

  /**
   * 生成控制流PATH节点
   */
  public makePathFunction(functionNode: FunctionNode): ControlFlowPath {
    const ownedLeafFunctions = this.findOwnedLeafFunctions(functionNode);
    const callerFunction = functionNodeToExecuteFunction(functionNode);
    const calleeRecords = this.findCalleeRecords(functionNode, callerFunction);
    const pathFunction: ControlFlowPath = {
      nodeType: 'PATH',
      ...callerFunction,
      meta: {
        leafFunctions: ownedLeafFunctions,
        /**
         * 遍历functions后计算赋值
         * @see calculateLeafFunctionCalledRecords
         */
        calledRecords: [],
        calleeRecords: calleeRecords,
        passes: this.findPathInPasses(functionNode, ownedLeafFunctions, calleeRecords),
      },
    };

    this.pathFunctions.push(pathFunction);
    return pathFunction;
  }

  /**
   * 计算leaf functions被调用记录
   */
  public calculateLeafFunctionCalledRecords(): void {
    this.pathFunctions.forEach((pathFunction) => {
      pathFunction.meta.calledRecords = pathFunction.meta.leafFunctions.flatMap((leafFunction) => {
        const callers = this.leafFunctionCalledMap.get(leafFunction.hash) ?? [];
        return callers.map((callerFunction) => this.makeCallRecord(callerFunction, leafFunction));
      });
    });
  }

  private scanAllPasses(passes: PassDirectory[]): void {
    for (const pass of passes) {
      const roots: Record<string, ComputeGraph> = {};
      const leafs: Record<string, ComputeGraph> = {};
      let noLeaf = true;
      for (const computeGraph of pass.children) {
        if (computeGraph.computeType === 'root') {
          roots[computeGraph.pathName] = computeGraph;
        } else if (computeGraph.computeType === 'all' && !roots[computeGraph.pathName]) {
          roots[computeGraph.pathName] = computeGraph;
        } else {
          noLeaf = false;
          leafs[computeGraph.leafHash!] = computeGraph;
        }
      }
      this.passFiles.push({ roots, leafs: noLeaf ? null : leafs, passName: pass.name, passStage: pass.passStage });
    }
  }

  /**
   * 查找path下属所有leaf function
   */
  private findOwnedLeafFunctions(pathFunction: FunctionNode): ControlFlowPath['meta']['leafFunctions'] {
    return (
      pathFunction.programs?.map<LeafFunction>((leafFunctionMagic, programIndex) => {
        const leafFunctionNode = this.functionMagicMap.get(leafFunctionMagic)!;
        const programId = programIndex.toString().padStart(2, '0');
        if (!this.leafFunctionHashMap.has(leafFunctionNode.hash)) {
          this.leafFunctionHashMap.set(leafFunctionNode.hash, functionNodeToExecuteFunction(leafFunctionNode) as LeafFunction);
        }
        const leafFunction = this.leafFunctionHashMap.get(leafFunctionNode.hash)!;
        leafFunction.magicName = `${getFunctionName(pathFunction)}_leaf_${programId}`;
        leafFunction.programId = programId;
        return leafFunction;
      }) ?? []
    );
  }

  /**
   * 查找path调用的所有leaf function
   */
  private findCalleeRecords(pathFunction: FunctionNode, callerFunction: ExecuteFunction): ControlFlowPath['meta']['calleeRecords'] {
    const noCalleeHash = !Reflect.has(pathFunction.operations[0], 'calleehash');
    if (noCalleeHash) {
      return [];
    }
    const leafFunctionNodes = pathFunction.operations.map(({ calleehash }) => this.functionHashMap.get(calleehash!)!);
    return leafFunctionNodes.map((leafFunctionNode) => {
      if (!this.leafFunctionCalledMap.has(leafFunctionNode.hash)) {
        this.leafFunctionCalledMap.set(leafFunctionNode.hash, []);
      }
      this.leafFunctionCalledMap.get(leafFunctionNode.hash)?.push(callerFunction);

      const calleeFunction =
        this.leafFunctionHashMap.get(leafFunctionNode.hash) ?? (functionNodeToExecuteFunction(leafFunctionNode) as LeafFunction);
      this.leafFunctionHashMap.set(leafFunctionNode.hash, calleeFunction);
      return this.makeCallRecord(callerFunction, calleeFunction);
    });
  }

  private makeCallRecord(caller: ExecuteFunction, callee: LeafFunction): CallLeafRecord {
    return {
      callerHash: caller.hash,
      callerFunction: caller,
      calleeHash: callee.hash,
      calleeFunction: callee,
    };
  }

  /**
   * 获取所有过程中的path计算图
   */
  private findPathInPasses(
    pathFunction: FunctionNode,
    ownedLeafFunctions: ControlFlowPath['meta']['leafFunctions'],
    calleeRecords: ControlFlowPath['meta']['calleeRecords'],
  ): ControlFlowPath['meta']['passes'] {
    const pathName = getFunctionName(pathFunction);
    const pathInPasses: PathInPass[] = [];
    for (const { roots, leafs, passName, passStage } of this.passFiles) {
      const pathFile = roots[pathName];
      if (pathFile) {
        const hasHealthReport = this.pathHasHealthReport(
          pathFile,
          ownedLeafFunctions.map((item) => leafs?.[item.hash]),
        );
        pathInPasses.push({
          passIndex: pathFile.passIndex,
          passName,
          passStage,
          pathName,
          graphFilePath: pathFile.absolutePath,
          hasHealthReport,
          leafFunctions: leafs ? this.findLeafInPass(calleeRecords, roots, leafs, pathName) : [],
        });
      }
    }
    return pathInPasses;
  }

  private pathHasHealthReport(pathFile: ComputeGraph, leafFiles: (ComputeGraph | undefined)[]) {
    return [pathFile, ...leafFiles].some((item) => item?.hasHealthReport);
  }

  private findLeafInPass(
    calleeRecords: ControlFlowPath['meta']['calleeRecords'],
    roots: Record<string, ComputeGraph>,
    leafs: Record<string, ComputeGraph>,
    rootPathName: string,
  ): LeafInPass[] {
    const usedLeaf = new Set();
    const leafFunctions: LeafInPass[] = [];
    for (const record of calleeRecords) {
      if (usedLeaf.has(record.calleeHash)) {
        continue;
      }
      usedLeaf.add(record.calleeHash);
      const leafFile = leafs[record.calleeHash];
      if (!leafFile) {
        continue;
      }
      leafFunctions.push({
        leafName: `${leafFile.pathName}_leaf_${leafFile.leafProgramId}`,
        isOwnedLeaf: leafFile.pathName === rootPathName,
        programId: leafFile.leafProgramId!,
        leafFileName: leafFile.name,
        leafFilePath: leafFile.absolutePath,
        rootPathName: leafFile.pathName,
        rootFilePath: roots[leafFile.pathName].absolutePath,
      });
    }
    return leafFunctions;
  }
}
