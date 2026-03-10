import { getIDELang } from '../../lang';
import { BaseGraphMsgHandler } from '../../handler/baseGraphMsgHandler';

// 定义 symbol 类型
type SymType = 0 | 1 | 2;

// Symbol 名称映射
const symsSymNameDict: Record<SymType, string> = {
  0: 'S_IMM',
  1: 'S_SYM',
  2: 'S_EXPR',
};

// 操作名称映射
let symsOpNameDict: Record<number, string>;
let ssopCall = 16;
let ssopMMin = 17;
let ssopMMax = 18;
let uopArr = [0, 1, 2];

const oldSymsOpNameDict: Record<number, string> = {
  0: 'ssop_pos',
  1: 'ssop_neg',
  2: 'ssop_not',
  3: 'ssop_add',
  4: 'ssop_sub',
  5: 'ssop_mul',
  6: 'ssop_div',
  7: 'ssop_mod',
  8: 'ssop_eq',
  9: 'ssop_ne',
  10: 'ssop_lt',
  11: 'ssop_le',
  12: 'ssop_gt',
  13: 'ssop_ge',
  14: 'ssop_min',
  15: 'ssop_max',
  16: 'ssop_call',
  17: 'ssop_mmin',
  18: 'ssop_mmax'
};

const newSymsOpNameDict: Record<number, string> = {
  0: 'ssop_call',
  10: 'ssop_pos',
  11: 'ssop_neg',
  12: 'ssop_not',
  20: 'ssop_add',
  21: 'ssop_sub',
  22: 'ssop_mul',
  23: 'ssop_div',
  24: 'ssop_mod',
  25: 'ssop_eq',
  26: 'ssop_ne',
  27: 'ssop_lt',
  28: 'ssop_le',
  29: 'ssop_gt',
  30: 'ssop_ge',
  31: 'ssop_and',
  32: 'ssop_or'
};

const oldCallOp = 16;
const newCallOp = 0;

const oldUOPArr = [0, 1, 2];
const newUOPArr = [10, 11, 12];


// 操作符映射到实际符号
const opMap: Record<string, string> = {
  ssop_pos: '',
  ssop_neg: '-',
  ssop_not: '!',
  ssop_add: '+',
  ssop_sub: '-',
  ssop_mul: '*',
  ssop_div: '/',
  ssop_mod: '%',
  ssop_eq: '==',
  ssop_ne: '!=',
  ssop_lt: '<',
  ssop_le: '<=',
  ssop_gt: '>',
  ssop_ge: '>=',
  ssop_min: 'min',
  ssop_max: 'max',
  ssop_and: '&',
  ssop_or: '|',
  ssop_call: '',
  ssop_mmin: 'multiMin',
  ssop_mmax: 'multiMax',
};

// 一元操作符列表
const oneArgsOperation: string[] = ['ssop_pos', 'ssop_neg', 'ssop_not'];

// symsOpGetInfo 返回类型
interface OpInfo {
  argNum: number;
  opName: string;
}

/**
 * 获取操作所需参数数量和操作名称
 */
function symsOpGetInfo(op: number, symList: string[], symListReadable: any[], server?: any, diffType?: 'before' | 'after'): OpInfo | undefined {
  if (uopArr.includes(op)) {
    return { argNum: 1, opName: symsOpNameDict[op] };
  } else if (op === ssopCall || op === ssopMMin || op === ssopMMax) {
    const argNumStr = symList.shift();
    if (argNumStr === undefined) {
      if (server) {
        BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsOpGetInfo', {},
          'pypto.comGraph.errorLogMessage.funcHash.emptyList', { funcHash: server.comGraphData.funcHash }, diffType)
        return;
      }
    }
    const argNum = parseInt(argNumStr!, 10);
    if (isNaN(argNum)) {
      if (server) {
        BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsOpGetInfo', {},
          'pypto.comGraph.errorLogMessage.symsOpGetInfo', { funcHash: server.comGraphData.funcHash, message: argNumStr }, diffType)
        return;
      }
    }
    symListReadable.push(argNum);
    return { argNum, opName: symsOpNameDict[op] };
  } else {
    return { argNum: 2, opName: symsOpNameDict[op] };
  }
}

/**
 * 递归解析符号列表，生成表达式字符串
 */
function symsGetExpr(symList: any[], symListReadable: any[], server?: any, diffType?: 'before' | 'after'): string | undefined {
  const symStr = symList.shift();
  if (symStr === undefined) {
    if (server) {
      BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsGetExpr', {},
        'pypto.comGraph.errorLogMessage.funcHash.emptyList', { funcHash: server.comGraphData.funcHash }, diffType)
      return;
    }
  }
  const sym = parseInt(symStr, 10) as SymType;
  if (!(sym in symsSymNameDict)) {
    if (server) {
      BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsGetExpr', {},
        'pypto.comGraph.errorLogMessage.invalidSymValue', { funcHash: server.comGraphData.funcHash, message: sym }, diffType)
      return;
    }
  }
  symListReadable.push(symsSymNameDict[sym]);

  const argStr = symList.shift();
  if (argStr === undefined) {
    if (server) {
      BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsGetExpr', {},
        'pypto.comGraph.errorLogMessage.missArgumentForSymbol', { funcHash: server.comGraphData.funcHash }, diffType)
      return;
    }
  }

  if (sym === 0) {
    // S_IMM: 立即数
    const val = parseInt(argStr, 10);
    if (isNaN(val)) {
      if (server) {
        BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsGetExpr', {},
          'pypto.comGraph.errorLogMessage.invalidImmediateValue', { funcHash: server.comGraphData.funcHash, message: argStr }, diffType)
        return;
      }
    }
    symListReadable.push(val);
    return val.toString();
  } else if (sym === 1) {
    // S_SYM: 变量名
    symListReadable.push(argStr);
    return argStr;
  } else if (sym === 2) {
    // S_EXPR: 表达式
    const op = parseInt(argStr, 10);
    if (!(op in symsOpNameDict)) {
      if (server) {
        BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsGetExpr', {},
          'pypto.comGraph.errorLogMessage.invalidOpValue', { funcHash: server.comGraphData.funcHash, message: op }, diffType)
        return;
      }
    }
    symListReadable.push(symsOpNameDict[op]);

    const { argNum, opName } = symsOpGetInfo(op, symList, symListReadable, server, diffType)!;
    const args: string[] = [];
    for (let i = 0; i < argNum; i++) {
      args.push(symsGetExpr(symList, symListReadable, server)!);
    }
    return `${opName}(${args.join(',')})`;
  } else {
    if (server) {
      BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.symsGetExpr', {},
        'pypto.comGraph.errorLogMessage.invalidSymValue', { funcHash: server.comGraphData.funcHash, message: sym }, diffType)
      return;
    }
  }
}

/**
 * 解析表达式字符串（如 ssop_add(...)）为数学表达式
 */
function parseExpr(expr: string): string {
  expr = expr.trim();

  if (!expr.startsWith('ssop_')) {
    return expr;
  }

  const opMatch = expr.match(/^(\w+)\((.*)\)$/s);
  if (!opMatch) {
    return expr;
  }

  const [, opType, insideArgStr] = opMatch;
  const args = splitArgs(insideArgStr).map(parseExpr);
  const argStr = splitArgs(args as unknown as string);
  if (argStr.length === 0) {
    return '()';
  }

  if (!opType || !(opType in opMap)) {
    return expr;
  }

  if (opType === 'ssop_call') {
    const funcName = args[0];
    const funcArgs = args.slice(1).join(', ');
    return `${funcName}(${funcArgs})`;
  }

  if (opType === 'ssop_mmin' || opType === 'ssop_mmax') {
    const opChar = opMap[opType];
    const funcArgs = args.join(', ');
    return `${opChar}(${funcArgs})`;
  }

  if (opType in opMap) {
    const opChar = opMap[opType];

    if (oneArgsOperation.includes(opType)) {
      const right = splitArgs(insideArgStr).map(parseExpr);
      return opChar === '!' ? `${opChar}(${right})` : `${opChar}${right}`;
    } else {
      if (opType === 'ssop_min' || opType === 'ssop_max') {
        return `${opChar}(${args[0]}, ${args[1]})`;
      }

      if (args.length === 2) {
        return `(${args[0]} ${opChar} ${args[1]})`;
      }

      if (args.length === 1) {
        return `${opChar}(${args[0]})`;
      }
    }
  }

  return expr;
}

/**
 * 解析参数字符串，支持嵌套括号
 */
function parseArgs(argsStr: string): string | string[] {
  if (!argsStr || !argsStr.trim()) return [];

  const args: string[] = [];
  let cur = '';
  let depth = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }

  if (cur.trim()) {
    args.push(cur.trim());
  }

  return args.length === 1 ? parseExpr(args[0]) : args.map(parseExpr);
}

/**
 * 分割参数（不解析，仅按逗号分割，考虑括号嵌套）
 */
function splitArgs(argsStr): string[] {
  const args: string[] = [];
  let cur = '';
  let depth = 0;

  for (const char of argsStr) {
    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
    } else if (char === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
      continue;
    }
    cur += char;
  }

  if (cur.trim()) {
    args.push(cur.trim());
  }

  return args;
}

/**
 * 主函数：从 lineInfo 生成数学表达式
 */
export function genMathScalarExpr(lineInfo: (string | number)[] | undefined, version: string, server?: any, diffType?: 'before' | 'after'): string | undefined {
  if (getVersionNum(version) > 20) {
    symsOpNameDict = newSymsOpNameDict;
    ssopCall = newCallOp;
    uopArr = newUOPArr;
  } else {
    symsOpNameDict = oldSymsOpNameDict;
    ssopCall = oldCallOp;
    uopArr = oldUOPArr;
  }
  if (lineInfo === undefined) {
    return '';
  }

  const symList = [...lineInfo];
  const symListReadable: any[] = [];
  try {
    const expr = symsGetExpr(symList, symListReadable, server, diffType);
    return parseExpr(expr!);
  } catch (error) {
    if (server) {
      BaseGraphMsgHandler.returnError(server, 'pypto.comGraph.errorMessage.error', { processName: "genMathScalarExpr" },
        'pypto.comGraph.errorLogMessage.error', { logText: error }, diffType)
      return;
    }
  }
}

export class AttrReader {
  private index = 0;
  constructor(public server: any, private attr: Array<string | number | (string | number)[]>) { }

  hasNext(): boolean {
    return this.index < this.attr.length;
  }

  readIndex(): number {
    return this.index as number;
  }

  readNumber(diffType?: 'before' | 'after'): number {
    if (!this.hasNext()) {
      BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.attrReader', {},
        'pypto.comGraph.errorLogMessage.unexpectedEndOfAttr', { funcHash: this.server.comGraphData.funcHash }, diffType)
      return NaN;
    }
    return this.attr[this.index++] as number;
  }

  readStringOrNumberArray(diffType?: 'before' | 'after'): (string | number)[] | undefined {
    if (!this.hasNext()) {
      BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.attrReader', {},
        'pypto.comGraph.errorLogMessage.unexpectedEndOfAttr', { funcHash: this.server.comGraphData.funcHash })
      return;
    }
    const val = this.attr[this.index++];
    if (Array.isArray(val)) return val;
    BaseGraphMsgHandler.returnError(this.server, 'pypto.comGraph.errorMessage.attrReader', {},
      'pypto.comGraph.errorLogMessage.expectedArrayForExpression', { funcHash: this.server.comGraphData.funcHash, message: val }, diffType);
  }

  readOptionalNumber(): number | null {
    return this.hasNext() ? (this.attr[this.index++] as number) : null;
  }
}

function getVersionNum(version: string): number {
  let versionNumber = 0;
  version.split('.').forEach((t, index) => {
    versionNumber += Number(t) * (index ? 1 : 10);
  })

  return versionNumber || 20;
}

export function parseSymbolicOrIntList(reader: AttrReader, size: number, version = '2.0', diffType?: 'before' | 'after'): string[] {
  const result: string[] = [];
  for (let i = 0; i < size; i++) {
    const kind = reader.readNumber(diffType);
    if (kind === 1) {
      // symbolicScalar
      const expr = reader.readStringOrNumberArray(diffType);
      result.push(genMathScalarExpr(expr, version, reader.server, diffType)!);
    } else if (kind === 2) {
      // integer
      const value = reader.readNumber(diffType);
      result.push(value.toString());
    } else {
      BaseGraphMsgHandler.returnError(reader.server, 'pypto.comGraph.errorMessage.parseSymbolicOrIntList', {},
        'pypto.comGraph.errorLogMessage.invalidKindType', { funcHash: reader.server.comGraphData.funcHash, message: kind }, diffType)
      return [];
    }
  }
  return result;
}

export function parseExprList(reader: AttrReader, size: number, version = '2.0', diffType?: 'before' | 'after'): string[] {
  const result: string[] = [];
  for (let i = 0; i < size; i++) {
    const expr = reader.readStringOrNumberArray(diffType); // 直接读取表达式数组
    result.push(genMathScalarExpr(expr, version, reader.server, diffType)!);
  }
  return result;
}
