
const symsSymNameDict= {
    0: 'S_IMM',
    1: 'S_SYM',
    2: 'S_EXPR'
};

const symsOpNameDict = {
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
}

const opMap = {
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
}

const oneArgsOperation = ['ssop_pos', 'ssop_neg', 'ssop_not'];

function symsOpGetInfo(op, symList, symListReadable) {
    if([0, 1, 2].includes(op)) {
        return [1, `${symsOpNameDict[op]}`];
    } else if ([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(op)) {
        return [2, `${symsOpNameDict[op]}`];
    } else if ([16].includes(op)) {
        const argNum = parseInt(symList.shift(), 10);
        symListReadable.push(argNum);
        return [parseInt(argNum, 10), `${symsOpNameDict[op]}`];
    } else {
        throw new Error(`invlid op value: ${op}`);
    }
}

function symsGetExpr(symList, symListReadable) {
    const sym = parseInt(symList.shift(), 10);
    symListReadable.push(symsSymNameDict[sym]);
    const argStr = symList.shift();
    if (sym == 0) {
        const val = parseInt(argStr, 10);
        symListReadable.push(val);
        return val.toString();
    } else if (sym == 1) {
        symListReadable.push(argStr);
        return argStr;
    } else if (sym == 2) {
        const op = parseInt(argStr, 10);
        symListReadable.push(symsSymNameDict[op]);
        const [argNum, opName] = symsOpGetInfo(op, symList, symListReadable);
        const args = [];
        for (let i = 0; i < argNum; i++) {
            args.push(String(symsGetExpr(symList, symListReadable)));
        }
        return `${opName}(${args.join(',')})`;
    } else {
        throw new Error(`invlid sym value: ${sym}`);
    }
}

function parseExpr(expr) {
    if(!expr.startsWith('ssop_')) {
        return expr;
    }
    const opMatch = expr.match(/^(\w+)\((.*?)\)$/);
    if(!opMatch) {
        return expr;
    }
    const [_, opType, args] = opMatch;
    if(opType === 'ssop_call') {
        const argsStr = splitArgs(args);
        const funcName = argsStr[0];
        const funcArgsS = argsStr.slice(1);
        let ans = `${funcName}(`;
        funcArgsS.forEach((arg, index) => {
            const funcArg = parseArgs(arg);
            if(index < argsStr.length - 2) {
                ans += `${funcArg}, `;
            } else {
                ans += `${funcArg}`;
            }
        });
        return ans += ')';
    } else if (Object.keys(opMap).includes(opType)) {
        const opChar = opMap[opType];
        if (oneArgsOperation.includes(opType)) {
            const right = parseArgs(args);
            if (opChar == 'not') {
                return `${opChar}(${right})`;
            } else {
                return `${opChar}${right}`;
            }
        } else {
            const [left, right] = parseArgs(args);
            if (opChar == 'min' || opChar == 'max') {
                return `${opChar}(${left}, ${right})`;
            } else {
                return `${left} ${opChar} ${right}`;
            }
        }
    }
    return expr;
}

function parseArgs(argsStr) {
    if(!argsStr) return [];
    const args = [];
    let cur = '';
    let depth = 0;
    for(let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];
        if(char === '(') depth++;
        if (char === ')') depth--;
        if (char === ',' && depth == 0) {
            args.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    if(cur.trim()) {
        args.push(cur.trim());
        return args.map(arg => parseExpr(arg));
    }
}

function splitArgs(argsStr) {
    let cur = '';
    let depth = 0;
    const args = [];
    for(let i = 0; i < argsStr.length; i++) {
        const char = argsStr[i];
        if(char == '(') {
            depth++;
        } else if (char == ')') {
            depth--;
        } else if (char == ',' && depth == 0) {
            args.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    if(cur.trim() != '') {
        args.push(cur.trim());
    }
    return args;
}

function genMathScalarExpr(lineInfo) {
    if(lineInfo === undefined) {
        return;
    }
    const symList = [...lineInfo];
    const symListReadable = [];
    const expr = symsGetExpr(symList, symListReadable);
    const mathExpr = parseExpr(expr);
    return mathExpr;
}

function addloopDetail(report) {
    console.log("Creating loop detail from data: ", report);
    if("dynamic" in report) {
        const itername = report.dynamic.itername;
        const begin = report.dynamic.begin;
        const end = report.dynamic.end;
        const step = report.dynamic.step;
        var beginS = genMathScalarExpr(begin);
        var endS = genMathScalarExpr(end);
        var stepS = genMathScalarExpr(step);
        const coretype = "coretype" in report ? report.coretype : '0';
        const magic_name = report.func_magicname;
        $('#loop-detail').show();
        $('#itername').html(`itername:${itername}`);
        $('#begin').html(`begin:${beginS}`);
        $('#end').html(`end:${endS}`);
        $('#step').html(`step:${stepS}`);
        $('#coretype').html(`coretype:${coretype}`);
        $('#magicname').html(`magicname:${magic_name}`);
    } else {
        return;
    }
}
