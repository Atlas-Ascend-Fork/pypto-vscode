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
  };

  /** 节点自定义数据 */
  meta?: unknown;
}
