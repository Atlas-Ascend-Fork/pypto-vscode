import * as vscode from 'vscode';

import { ControlFlowPath, ControlFlowIf, ControlFlowLoop } from '../../types/control-flow';

export interface GetControlFlowParams {
  /** 编译结果文件夹路径 */
  outputDirPath: string;
}

export interface GetControlFlowRes {
  /** 控制流 */
  controlFlow: (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[];
}

/** 解析program文件的运行环境 */
interface ReadFileContext {
  /**  */
  sourceCodePath: string;
  functionMap: Map<string, any>;
}

/** 函数类型 */
const enum FunctionType {
  DYNAMIC = 3,
  PATH = 4,
}

/** 条件分支 [条件(波兰式), 是否满足] */
type DynamicCondition = [(string | number)[], boolean];

/** 函数节点 */
interface FunctionNode {
  functype: FunctionType;

  /** 执行图id（唯一） */
  funcmagic: number;

  /** 执行图节点名称 */
  func_magicname: string;

  /** hash值用来查询调用关系 */
  hash: string;

  /** 调用的其他函数或算子 */
  operations: { calleehash?: string; opmagic?: number }[];

  /** 动态函数属性 */
  dynamic?: {
    paths?: [number, DynamicCondition[]][];
  };
}

export async function getControlFlow(params: GetControlFlowParams): Promise<GetControlFlowRes> {
  const programUri = vscode.Uri.joinPath(vscode.Uri.parse(params.outputDirPath), 'program.json');
  const fileContent = (await vscode.workspace.fs.readFile(programUri)).toString();
  const program = JSON.parse(fileContent);

  // TODO 源代码文件路径待实现
  const sourceCodePath = vscode.Uri.joinPath(vscode.Uri.parse(params.outputDirPath), 'xxx.cpp').fsPath;
  const functionMap = new Map();
  for (const functionNode of program.functions) {
    functionMap.set(functionNode.hash, functionNode);
  }
  const context: ReadFileContext = { sourceCodePath, functionMap };

  const entryFunction = functionMap.get(program.entryhash);
  const controlFlow: (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[] = [];
  for (const operation of entryFunction.operations) {
    const calleeFunction = functionMap.get(operation.calleehash);
    if (calleeFunction.functype === FunctionType.DYNAMIC) {
      controlFlow.push(readDynamicFunction(calleeFunction, context));
    } else {
      // TODO 仅有静态方法
    }
  }

  return { controlFlow };
}

/**
 * 读取 循环 or 循环+条件 节点
 * @param functionNode
 * @param context
 * @returns
 */
function readDynamicFunction(functionNode: FunctionNode, context: ReadFileContext): ControlFlowLoop {
  const { sourceCodePath, functionMap } = context;
  const loopFunction: ControlFlowLoop = {
    nodeType: 'LOOP',
    magic: functionNode.funcmagic,
    magicName: functionNode.func_magicname,
    hash: functionNode.hash,
    sourceCode: {
      filePath: sourceCodePath,
      startLine: 0,
      endLine: 0,
    },
    children: [],
  };

  const hasConditionNode = functionNode.dynamic?.paths?.length;
  if (hasConditionNode) {
    loopFunction.children.push(readCondition(functionNode, context));
  } else {
    const calleeFunction = functionMap.get(functionNode.operations[0].calleehash!);
    loopFunction.children.push(...readPathFunction(calleeFunction, context));
  }

  return loopFunction;
}

/**
 * 读取条件节点
 * @param functionNode
 * @param context
 * @returns
 */
function readCondition(functionNode: FunctionNode, context: ReadFileContext): ControlFlowIf {
  const conditionPaths = functionNode.dynamic!.paths!;
  const conditions = conditionPaths[0][1].map((item) => item[0]);
  type PendingChildrenNode = Omit<ControlFlowIf, 'children'> & { children: PendingChildrenNode[] | ControlFlowPath[] };
  let rootNode: PendingChildrenNode = {
    nodeType: 'IF',
    magic: -1,
    magicName: '',
    hash: '',
    children: [],
  };
  let leafNodes: PendingChildrenNode[] = [rootNode];
  for (let level = 1; level < conditions.length; level++) {
    const parentNodes = leafNodes;
    leafNodes = [];
    for (const parentNode of parentNodes) {
      const left: PendingChildrenNode = {
        nodeType: 'IF',
        magic: -1,
        magicName: '',
        hash: '',
        children: [],
      };
      const right: PendingChildrenNode = {
        nodeType: 'IF',
        magic: -1,
        magicName: '',
        hash: '',
        children: [],
      };
      parentNode.children = [left, right];
      leafNodes.push(left, right);
    }
  }
  for (let conditionPath of conditionPaths) {
    const [callMagic, conditions] = conditionPath;
    const calleeHash = functionNode.operations.find((item) => item.opmagic === callMagic)?.calleehash;
    if (!calleeHash) {
      continue;
    }
    const calleeFunction = context.functionMap.get(calleeHash);
    const binaryIndex = conditions.reduce((res, condition) => `${res}${condition[1] ? '0' : '1'}`, '');
    const leafIndex = Math.floor(parseInt(binaryIndex, 2) / 2);
    const childrenIndex = parseInt(binaryIndex, 2) % 2;
    leafNodes[leafIndex].children[childrenIndex] = readPathFunction(calleeFunction, context)[0] as ControlFlowPath;
  }
  return rootNode as ControlFlowIf;
}

/**
 * 读取 叶子节点 or 串行动态方法
 * @param functionNode
 * @param context
 * @returns
 */
function readPathFunction(functionNode: any, context: ReadFileContext): ControlFlowPath[] | ControlFlowLoop[] {
  const testOperation = functionNode.operations[0];
  const noCalleeHash = !Reflect.has(testOperation, 'calleehash');
  const noDynamicCalleeFunction = context.functionMap.get(testOperation.calleehash).functype !== FunctionType.DYNAMIC;
  const isLeafPath = noCalleeHash || noDynamicCalleeFunction;

  if (isLeafPath) {
    return [
      {
        nodeType: 'PATH',
        magic: functionNode.funcmagic,
        magicName: functionNode.func_magicname,
        hash: functionNode.hash,
        // TODO 下钻 leaf function，使用单独接口避免阻塞渲染
        meta: {
          leafFunctions: [],
          calledRecords: [],
          calleeRecords: [],
          passes: [],
        },
      },
    ];
  } else {
    return functionNode.operations.map(({ calleehash }) => {
      const calleeFunction = context.functionMap.get(calleehash);
      return readDynamicFunction(calleeFunction, context);
    });
  }
}
