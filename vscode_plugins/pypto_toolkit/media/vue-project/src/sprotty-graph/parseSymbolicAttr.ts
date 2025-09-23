import { comGraphStore } from "../service/com-graph-store";

// 定义 symbol 类型
type SymType = 0 | 1 | 2;
type OpType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

// Symbol 名称映射
const symsSymNameDict: Record<SymType, string> = {
    0: 'S_IMM',
    1: 'S_SYM',
    2: 'S_EXPR'
};

// 操作名称映射
const symsOpNameDict: Record<OpType, string> = {
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
};

// 操作符映射到实际符号
const opMap: Record<string, string> = {
    'ssop_pos': '',
    'ssop_neg': '-',
    'ssop_not': '!',
    'ssop_add': '+',
    'ssop_sub': '-',
    'ssop_mul': '*',
    'ssop_div': '/',
    'ssop_mod': '%',
    'ssop_eq': '==',
    'ssop_ne': '!=',
    'ssop_lt': '<',
    'ssop_le': '<=',
    'ssop_gt': '>',
    'ssop_ge': '>=',
    'ssop_min': 'min',
    'ssop_max': 'max',
    'ssop_call': '',
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
function symsOpGetInfo(op: OpType, symList: string[], symListReadable: any[]): OpInfo {
    if ([0, 1, 2].includes(op)) {
        return { argNum: 1, opName: symsOpNameDict[op] };
    } else if ([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(op)) {
        return { argNum: 2, opName: symsOpNameDict[op] };
    } else if (op === 16) {
        const argNumStr = symList.shift();
        if (argNumStr === undefined) {
            (window as any).ascEventBus.emit('jsonParseError', 'Missing argument count for ssop_call');
        }
        const argNum = parseInt(argNumStr, 10);
        if (isNaN(argNum)) {
            (window as any).ascEventBus.emit('jsonParseError', `Invalid argument count: ${argNumStr}`);
        }
        symListReadable.push(argNum);
        return { argNum, opName: symsOpNameDict[op] };
    } else {
        (window as any).ascEventBus.emit('jsonParseError', `Invalid op value: ${op}`);
    }
}

/**
 * 递归解析符号列表，生成表达式字符串
 */
function symsGetExpr(symList: any[], symListReadable: any[]): string {
    const symStr = symList.shift();
    if (symStr === undefined) {
        (window as any).ascEventBus.emit('jsonParseError', 'Unexpected end of symbol list');
    }
    const sym = parseInt(symStr, 10) as SymType;
    if (!(sym in symsSymNameDict)) {
        (window as any).ascEventBus.emit('jsonParseError', `Invalid sym value: ${sym}`);
    }
    symListReadable.push(symsSymNameDict[sym]);

    const argStr = symList.shift();
    if (argStr === undefined) {
        (window as any).ascEventBus.emit('jsonParseError', 'Missing argument for symbol');
    }

    if (sym === 0) {
        // S_IMM: 立即数
        const val = parseInt(argStr, 10);
        if (isNaN(val)) {
            (window as any).ascEventBus.emit('jsonParseError', `Invalid immediate value: ${argStr}`);
        }
        symListReadable.push(val);
        return val.toString();
    } else if (sym === 1) {
        // S_SYM: 变量名
        symListReadable.push(argStr);
        return argStr;
    } else if (sym === 2) {
        // S_EXPR: 表达式
        const op = parseInt(argStr, 10) as OpType;
        if (!(op in symsOpNameDict)) {
            (window as any).ascEventBus.emit('jsonParseError', `Invalid op value: ${op}`);
        }
        symListReadable.push(symsOpNameDict[op]);

        const { argNum, opName } = symsOpGetInfo(op, symList, symListReadable);
        const args: string[] = [];
        for (let i = 0; i < argNum; i++) {
            args.push(symsGetExpr(symList, symListReadable));
        }
        return `${opName}(${args.join(',')})`;
    } else {
        (window as any).ascEventBus.emit('jsonParseError', `Invalid sym value: ${sym}`);
    }
}

/**
 * 解析表达式字符串（如 ssop_add(...)）为数学表达式
 */
function parseExpr(expr: string): string {
    if (!expr.startsWith('ssop_')) {
        return expr;
    }

    const opMatch = expr.match(/^(\w+)\((.*)\)$/s);
    if (!opMatch) {
        return expr;
    }

    const [, opType, args] = opMatch;

    if (opType === 'ssop_call') {
        const argsStr = splitArgs(args);
        if (argsStr.length === 0) return '()';
        const funcName = argsStr[0];
        const funcArgs = argsStr.slice(1).map(parseArgs);
        return `${funcName}(${funcArgs.join(', ')})`;
    }

    if (opType in opMap) {
        const opChar = opMap[opType];
        if (oneArgsOperation.includes(opType)) {
            const right = parseArgs(args);
            return opChar === '!' ? `${opChar}(${right})` : `${opChar}${right}`;
        } else {
            const parsedArgs = parseArgs(args);
            if (Array.isArray(parsedArgs)) {
                const [left, right] = parsedArgs;
                if (opChar === 'min' || opChar === 'max') {
                    return `${opChar}(${left}, ${right})`;
                } else {
                    return `${left} ${opChar} ${right}`;
                }
            } else {
                // fallback
                return `${opChar}(${parsedArgs})`;
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
function splitArgs(argsStr: string): string[] {
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
function genMathScalarExpr(lineInfo: (string | number)[] | undefined): string {
    if (lineInfo === undefined) {
        return "";
    }

    const symList = [...lineInfo];
    const symListReadable: any[] = [];
    try {
        const expr = symsGetExpr(symList, symListReadable);
        return parseExpr(expr);
    } catch (error) {
        (window as any).ascEventBus.emit('jsonParseError', `Can not generating math expression. ${error}`);
    }
}

export class AttrReader {
    private index = 0;
    constructor(private attr: Array<string | number | (string | number)[]>) {}

    hasNext(): boolean {
        return this.index < this.attr.length;
    }

    readNumber(): number {
        if (!this.hasNext()) (window as any).ascEventBus.emit('jsonParseError', 'Unexpected end of attributes.');
        return this.attr[this.index++] as number;
    }

    readStringOrNumberArray(): (string | number)[] {
        if (!this.hasNext()) (window as any).ascEventBus.emit('jsonParseError', 'Unexpected end of attributes.');
        const val = this.attr[this.index++];
        if (Array.isArray(val)) return val;
        (window as any).ascEventBus.emit('jsonParseError', 'Expected array for expression.');
    }

    readOptionalNumber(): number | null {
        return this.hasNext() ? (this.attr[this.index++] as number) : null;
    }
}

export function parseSymbolicOrIntList(reader: AttrReader, size: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < size; i++) {
        const kind = reader.readNumber();
        if (kind === 1) {
            // symbolicScalar
            const expr = reader.readStringOrNumberArray();
            result.push(genMathScalarExpr(expr));
        } else if (kind === 2) {
            // integer
            const value = reader.readNumber();
            result.push(value.toString());
        } else {
            (window as any).ascEventBus.emit('jsonParseError', `Invalid kind type: ${kind}. Expected 1 (symbolic) or 2 (integer).`);
        }
    }
    return result;
}

export function parseExprList(reader: AttrReader, size: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < size; i++) {
        const expr = reader.readStringOrNumberArray(); // 直接读取表达式数组
        result.push(genMathScalarExpr(expr));
    }
    return result;
}

interface dynamicAttr {
    hasDynamic: boolean;
    itername?: string;
    begin?: string;
    end?: string;
    step?: string;
    coretype?: string;
    magic_name?: string;
}

export function getCurFunctionDynamicAttr(): dynamicAttr {
    const jsonData: any = comGraphStore.data.jsonData;
    const hasDynamic = jsonData.dynamic !== undefined;
    const begin = jsonData?.dynamic?.begin || undefined;
    const end = jsonData?.dynamic?.end || undefined;
    const step = jsonData?.dynamic?.step || undefined;
    const itername = jsonData?.dynamic?.itername || null;
    const func_magicname = jsonData?.func_magicname || null;
    const coretype = jsonData?.coretype || 20;
    return {
        hasDynamic: hasDynamic,
        itername: itername,
        begin: genMathScalarExpr(begin),
        end: genMathScalarExpr(end),
        step: genMathScalarExpr(step),
        coretype: `${coretype}`,
        magic_name: func_magicname
    }
}
