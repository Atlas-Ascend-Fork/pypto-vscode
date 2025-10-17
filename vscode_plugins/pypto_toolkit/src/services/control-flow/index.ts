import * as vscode from 'vscode';

import { ControlFlowPath, ControlFlowIf, ControlFlowLoop } from '../../types/control-flow';
import { ExecuteFunction } from '../../types/execute-graph';

export interface GetControlFlowParams {
  /** 编译结果文件夹路径 */
  outputDirPath: string;
}

export interface GetControlFlowRes {
  /** 控制流 */
  controlFlow: (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[];
}

/** 函数类型 */
const enum FunctionType {
  /** 动态函数（循环、条件分支） */
  DYNAMIC = 3,

  /** 顺序执行的函数 */
  PATH = 4,
}

/** 条件分支 [条件(波兰式), 是否满足] */
type DynamicCondition = [(string | number)[], boolean];

/** 函数节点 */
interface FunctionNode {
  functype: FunctionType;

  /** 执行图id（唯一） */
  funcmagic: number;

  /** 父级函数的执行图id */
  parent_funcmagic?: number;

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

/** 解析program文件的运行环境 */
interface ReadFileContext {
  /** 以hash为键的function */
  functionHashMap: Map<string, FunctionNode>;

  /** 以parent_funcmagic为键的function */
  functionParentMap: Map<number, FunctionNode[]>;

  /** 遍历过程中收集的数据 */
  runningCollections: {
    /** 所有path */
    pathFunctions: ControlFlowPath[];

    /** leaf function被调用 */
    leafFunctionCalledMap: Map<string, ExecuteFunction[]>;
  };
}

/**
 * program.json文件内容
 */
interface ProgramContent {
  /** 入口函数hash */
  entryhash: string;

  /** 所有函数 */
  functions: FunctionNode[];
}

/**
 * 获取工作流图信息
 * @param params
 * @returns
 */
export async function getControlFlow(params: GetControlFlowParams): Promise<GetControlFlowRes> {
  const programUri = vscode.Uri.joinPath(vscode.Uri.file(params.outputDirPath), 'program.json');
  const fileContent = (await vscode.workspace.fs.readFile(programUri)).toString();
  const program: ProgramContent = JSON.parse(fileContent);
  const context = makeReadFileContext(program.functions);
  const controlFlow = resolveFunctionTree(program, context);
  calculateLeafFunctionCalledRecords(context);
  return { controlFlow };
}

/**
 * 生成扫描文件运行环境
 * @param functions 所有函数配置
 * @returns
 */
function makeReadFileContext(functions: FunctionNode[]): ReadFileContext {
  const functionHashMap = new Map();
  const functionParentMap = new Map();
  for (const functionNode of functions) {
    functionHashMap.set(functionNode.hash, functionNode);

    if (functionNode.parent_funcmagic) {
      if (!functionParentMap.has(functionNode.parent_funcmagic)) {
        functionParentMap.set(functionNode.parent_funcmagic, []);
      }
      functionParentMap.get(functionNode.parent_funcmagic).push(functionNode);
    }
  }

  return { functionHashMap, functionParentMap, runningCollections: { pathFunctions: [], leafFunctionCalledMap: new Map() } };
}

function resolveFunctionTree(program: ProgramContent, context: ReadFileContext): (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[] {
  const entryFunction = context.functionHashMap.get(program.entryhash)!;
  const controlFlow: (ControlFlowPath | ControlFlowIf | ControlFlowLoop)[] = [];
  for (const operation of entryFunction.operations) {
    const calleeFunction = context.functionHashMap.get(operation.calleehash!)!;
    if (calleeFunction.functype === FunctionType.DYNAMIC) {
      controlFlow.push(readDynamicFunction(calleeFunction, context));
    } else if (calleeFunction.functype === FunctionType.PATH) {
      controlFlow.push(...readPathFunction(calleeFunction, context));
    } else {
      throw new Error(`未知的根节点类型（functype: ${calleeFunction.functype},hash: ${calleeFunction.hash}）`);
    }
  }
  return controlFlow;
}

/**
 * 读取 循环 or 循环+条件 节点
 * @param functionNode
 * @param context
 * @returns
 */
function readDynamicFunction(functionNode: FunctionNode, context: ReadFileContext): ControlFlowLoop {
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

  const hasConditionNode = functionNode.dynamic?.paths?.length;
  if (hasConditionNode) {
    loopFunction.children.push(readCondition(functionNode, context));
  } else {
    const calleeFunction = getCalleeFunctionByOperation(functionNode.operations[0], context)!;
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
  // TODO 反向序列化IF条件
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
    const callOperation = functionNode.operations.find((item) => item.opmagic === callMagic)!;
    const calleeFunction = getCalleeFunctionByOperation(callOperation, context)!;
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
function readPathFunction(functionNode: FunctionNode, context: ReadFileContext): ControlFlowPath[] | ControlFlowLoop[] {
  const testOperation = functionNode.operations[0];
  const noCalleeHash = !Reflect.has(testOperation, 'calleehash');
  const noDynamicCalleeFunction = getCalleeFunctionByOperation(testOperation, context)?.functype !== FunctionType.DYNAMIC;
  const isLeafPath = noCalleeHash || noDynamicCalleeFunction;

  if (isLeafPath) {
    const pathFunction: ControlFlowPath = {
      nodeType: 'PATH',
      ...functionNodeToExecuteFunction(functionNode),
      meta: {
        leafFunctions: findOwnedLeafFunctions(functionNode.funcmagic, context),
        /**
         * 遍历functions后计算赋值
         * @see calculateLeafFunctionCalledRecords
         */
        calledRecords: [],
        calleeRecords: findCalleeRecords(functionNode, context),
        passes: [], // TODO
      },
    };
    context.runningCollections.pathFunctions.push(pathFunction);
    return [pathFunction];
  } else {
    return functionNode.operations.map((operation) => {
      const calleeFunction = getCalleeFunctionByOperation(operation, context)!;
      return readDynamicFunction(calleeFunction, context);
    });
  }
}

/**
 * 查找path下属所有leaf function
 */
function findOwnedLeafFunctions(pathMagic: number, context: ReadFileContext): ControlFlowPath['meta']['leafFunctions'] {
  const subFunctions = context.functionParentMap.get(pathMagic) ?? [];
  return subFunctions.map((item) => functionNodeToExecuteFunction(item));
}

/**
 * 查找path调用的所有leaf function，并在context记录调用关系
 * @param pathFunction
 * @param context
 * @returns
 */
function findCalleeRecords(pathFunction: FunctionNode, context: ReadFileContext): ControlFlowPath['meta']['calleeRecords'] {
  const noCalleeHash = !Reflect.has(pathFunction.operations[0], 'calleehash');
  if (noCalleeHash) {
    return [];
  }
  const leafFunctionNodes = pathFunction.operations.map((operation) => getCalleeFunctionByOperation(operation, context)!);

  const { leafFunctionCalledMap } = context.runningCollections;
  return leafFunctionNodes.map((leafFunctionNode) => {
    const callerFunction = functionNodeToExecuteFunction(pathFunction);
    if (!leafFunctionCalledMap.has(leafFunctionNode.hash)) {
      leafFunctionCalledMap.set(leafFunctionNode.hash, []);
    }
    leafFunctionCalledMap.get(leafFunctionNode.hash)?.push(callerFunction);
    return {
      callerHash: pathFunction.hash,
      callerFunction,
      calleeHash: leafFunctionNode.hash,
      calleeFunction: functionNodeToExecuteFunction(leafFunctionNode),
    };
  });
}

/**
 * 计算leaf functions被调用记录
 * @param context
 */
function calculateLeafFunctionCalledRecords(context: ReadFileContext): void {
  const { pathFunctions, leafFunctionCalledMap } = context.runningCollections;
  pathFunctions.forEach((pathFunction) => {
    pathFunction.meta.calledRecords = pathFunction.meta.leafFunctions.flatMap((leafFunction) => {
      return (
        leafFunctionCalledMap.get(leafFunction.hash)?.map<ControlFlowPath['meta']['calleeRecords'][number]>((callerFunction) => {
          return {
            callerHash: callerFunction.hash,
            callerFunction,
            calleeHash: leafFunction.hash,
            calleeFunction: leafFunction,
          };
        }) ?? []
      );
    });
  });
}

function functionNodeToExecuteFunction(functionNode: FunctionNode): ExecuteFunction {
  return {
    magic: functionNode.funcmagic,
    magicName: functionNode.func_magicname,
    hash: functionNode.hash,
  };
}

function getCalleeFunctionByOperation(operation: FunctionNode['operations'][number], context: ReadFileContext): FunctionNode | undefined {
  if (!operation.calleehash) {
    return undefined;
  }
  return context.functionHashMap.get(operation.calleehash);
}
