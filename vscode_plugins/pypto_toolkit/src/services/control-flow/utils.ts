import type { FunctionNode } from '../../types/control-flow';
import type { ExecuteFunction } from '../../types/execute-graph';

export function functionNodeToExecuteFunction(functionNode: FunctionNode): ExecuteFunction {
  return {
    magic: functionNode.funcmagic,
    magicName: functionNode.func_magicname,
    hash: functionNode.hash,
  };
}
