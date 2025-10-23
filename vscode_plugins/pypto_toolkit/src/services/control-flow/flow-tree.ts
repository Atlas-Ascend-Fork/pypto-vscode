import { ControlFlowIf, ControlFlowLoop, ControlFlowPath, FunctionNode, FunctionType, ProgramOutput } from '../../types/control-flow';
import { PassDirectory } from '../../types/workspace';

import { ConditionAnalyzer } from './condition';
import { PathLeafAnalyzer } from './path-leaf';
import { functionNodeToExecuteFunction } from './utils';

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
    this.conditionAnalyzer = new ConditionAnalyzer();
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
   * @param context
   * @returns
   */
  private readDynamicFunction(functionNode: FunctionNode): ControlFlowLoop {
    const loopFunction: ControlFlowLoop = {
      nodeType: 'LOOP',
      ...functionNodeToExecuteFunction(functionNode),
      sourceCode: {
        filePath: '',
        startLine: 0,
        endLine: 0,
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
   * @param functionNode
   * @param context
   * @returns
   */
  private readPathFunction(functionNode: FunctionNode): ControlFlowPath[] | ControlFlowLoop[] {
    const testOperation = functionNode.operations[0];
    const noCalleeHash = !Reflect.has(testOperation, 'calleehash');
    const noDynamicCalleeFunction = this.getCalleeFunctionByOperation(testOperation)?.functype !== FunctionType.DYNAMIC;
    const isLeafPath = noCalleeHash || noDynamicCalleeFunction;

    if (isLeafPath) {
      const pathFunction: ControlFlowPath = this.pathLeafAnalyzer.makePathFunction(functionNode);
      return [pathFunction];
    } else {
      return functionNode.operations.map((operation) => {
        const calleeFunction = this.getCalleeFunctionByOperation(operation)!;
        return this.readDynamicFunction(calleeFunction);
      });
    }
  }

  private getCalleeFunctionByOperation(operation: FunctionNode['operations'][number]): FunctionNode | undefined {
    if (!operation.calleehash) {
      return undefined;
    }
    return this.functionHashMap.get(operation.calleehash);
  }
}
