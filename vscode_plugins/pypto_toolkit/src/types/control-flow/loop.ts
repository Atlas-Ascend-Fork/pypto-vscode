import { ControlFlowNode } from './basic-node';

export interface ControlFlowLoop extends ControlFlowNode {
  nodeType: 'LOOP';

  children: NonNullable<ControlFlowNode['children']>;

  sourceCode: NonNullable<ControlFlowNode['sourceCode']>;
}
