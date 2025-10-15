import { ControlFlowNode } from './basic-node';

export interface ControlFlowIf extends ControlFlowNode {
  nodeType: 'IF';

  /** if节点的子节点一定有2个，对应true和false */
  children: [ControlFlowNode, ControlFlowNode];
}
