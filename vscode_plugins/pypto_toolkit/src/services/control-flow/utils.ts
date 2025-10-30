import type { FunctionNode } from '../../types/control-flow';
import type { ExecuteFunction } from '../../types/execute-graph';

export function functionNodeToExecuteFunction(functionNode: FunctionNode): ExecuteFunction {
  return {
    magic: functionNode.funcmagic,
    magicName: getFunctionName(functionNode),
    hash: functionNode.hash,
  };
}

export function getFunctionName(functionNode: FunctionNode): string {
  return functionNode.rawname.replace(/_root$/, '');
}
