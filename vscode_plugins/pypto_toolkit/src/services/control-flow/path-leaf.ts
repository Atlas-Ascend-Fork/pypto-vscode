import type { CallLeafRecord, ControlFlowPath, FunctionNode, LeafFunction, PathInPass } from '../../types/control-flow';
import type { ExecuteFunction } from '../../types/execute-graph';
import { PassDirectory } from '../../types/workspace';
import { hasHealthReport } from '../../utils/health-report';

import { functionNodeToExecuteFunction } from './utils';

/**
 * 解析PATH函数和下属leaf functions
 */
export class PathLeafAnalyzer {
  /** 所有path */
  private pathFunctions: ControlFlowPath[] = [];

  /** leaf function被调用 */
  private leafFunctionCalledMap: Map<string, ExecuteFunction[]> = new Map();

  /**
   * @param functionHashMap 所有函数(key: hash)
   * @param ownedFunctions 函数和下属函数关系(key: magic)
   */
  constructor(
    private functionHashMap: Map<string, FunctionNode>,
    private ownedFunctions: Map<number, FunctionNode[]>,
    private passes: PassDirectory[],
  ) {}

  /**
   * 生成控制流PATH节点
   */
  public makePathFunction(functionNode: FunctionNode): ControlFlowPath {
    const pathFunction: ControlFlowPath = {
      nodeType: 'PATH',
      ...functionNodeToExecuteFunction(functionNode),
      meta: {
        leafFunctions: this.findOwnedLeafFunctions(functionNode.funcmagic),
        /**
         * 遍历functions后计算赋值
         * @see calculateLeafFunctionCalledRecords
         */
        calledRecords: [],
        calleeRecords: this.findCalleeRecords(functionNode),
        passes: this.findPathInPasses(functionNode),
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

  /**
   * 查找path下属所有leaf function
   */
  private findOwnedLeafFunctions(pathMagic: number): ControlFlowPath['meta']['leafFunctions'] {
    const subFunctions = this.ownedFunctions.get(pathMagic) ?? [];
    return subFunctions.map((item) => functionNodeToExecuteFunction(item));
  }

  /**
   * 查找path调用的所有leaf function
   */
  private findCalleeRecords(pathFunction: FunctionNode): ControlFlowPath['meta']['calleeRecords'] {
    const noCalleeHash = !Reflect.has(pathFunction.operations[0], 'calleehash');
    if (noCalleeHash) {
      return [];
    }
    const leafFunctionNodes = pathFunction.operations.map(({ calleehash }) => this.functionHashMap.get(calleehash!)!);
    return leafFunctionNodes.map((leafFunctionNode) => {
      const callerFunction = functionNodeToExecuteFunction(pathFunction);
      if (!this.leafFunctionCalledMap.has(leafFunctionNode.hash)) {
        this.leafFunctionCalledMap.set(leafFunctionNode.hash, []);
      }
      this.leafFunctionCalledMap.get(leafFunctionNode.hash)?.push(callerFunction);
      const calleeFunction = functionNodeToExecuteFunction(leafFunctionNode);
      return this.makeCallRecord(callerFunction, calleeFunction);
    });
  }

  /**
   * 获取所有过程中的path计算图
   */
  private findPathInPasses(pathFunction: FunctionNode): PathInPass[] {
    const magicName = pathFunction.func_magicname;
    const pathInPasses: PathInPass[] = [];
    for (const pass of this.passes) {
      const pathFile = pass.children.find(({ name }) => name.includes(magicName));
      if (pathFile) {
        pathInPasses.push({
          passIndex: pass.passIndex,
          passStage: pass.passStage,
          passName: pass.name,
          graphFilePath: pathFile.absolutePath,
          hasHealthReport: hasHealthReport(pathFile.absolutePath),
        });
      }
    }
    return pathInPasses;
  }

  private makeCallRecord(caller: ExecuteFunction, callee: LeafFunction): CallLeafRecord {
    return {
      callerHash: caller.hash,
      callerFunction: caller,
      calleeHash: callee.hash,
      calleeFunction: callee,
    };
  }
}
