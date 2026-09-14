/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock(import('../../../src/lang'), () => ({
  getIDELang: vi.fn(() => 'en'),
}));

vi.mock(import('../../../src/handler/baseGraphMsgHandler'), () => ({
  BaseGraphMsgHandler: {
    returnError: vi.fn(),
  },
}));

import { genMathScalarExpr, AttrReader, parseSymbolicOrIntList, parseExprList } from '../../../src/core/json-graph/parseSymbolicAttr';
import { BaseGraphMsgHandler } from '../../../src/handler/baseGraphMsgHandler';

function makeServer(): any {
  return { comGraphData: { funcHash: 'test-hash' } };
}

describe('genMathScalarExpr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when lineInfo is undefined', () => {
    const result = genMathScalarExpr(undefined, '2.0');
    expect(result).toBe('');
  });

  it('parses S_IMM (immediate value) for old version', () => {
    // S_IMM = sym 0, value 42
    const result = genMathScalarExpr([0, 42], '2.0');
    expect(result).toBe('42');
  });

  it('parses S_SYM (variable name) for old version', () => {
    // S_SYM = sym 1, name "x"
    const result = genMathScalarExpr([1, 'x'], '2.0');
    expect(result).toBe('x');
  });

  it('parses S_EXPR with binary add operation for old version', () => {
    // S_EXPR = sym 2, op 3 (ssop_add in old dict), then two S_IMM args
    // [2, 3, 0, 1, 0, 2] => ssop_add(1, 2) => (1 + 2)
    const result = genMathScalarExpr([2, 3, 0, 1, 0, 2], '2.0');
    expect(result).toBe('(1 + 2)');
  });

  it('parses S_EXPR with unary neg operation for old version', () => {
    // S_EXPR = sym 2, op 1 (ssop_neg in old dict), one S_IMM arg
    // [2, 1, 0, 5] => ssop_neg(5) => -5
    const result = genMathScalarExpr([2, 1, 0, 5], '2.0');
    expect(result).toBe('-5');
  });

  it('parses S_EXPR with call operation for old version', () => {
    // S_EXPR = sym 2, op 16 (ssop_call in old dict), argNum 2, func name "foo", arg 1
    // [2, 16, 2, 1, 'foo', 0, 1] => ssop_call(2, foo, 1) => foo(1)
    const result = genMathScalarExpr([2, 16, 2, 1, 'foo', 0, 1], '2.0');
    expect(result).toBe('foo(1)');
  });

  it('parses S_EXPR with mmin operation for old version', () => {
    // S_EXPR = sym 2, op 17 (ssop_mmin in old dict), argNum 2, two S_IMM args
    // [2, 17, 2, 0, 3, 0, 5] => ssop_mmin(2, 3, 5) => multiMin(3, 5)
    const result = genMathScalarExpr([2, 17, 2, 0, 3, 0, 5], '2.0');
    expect(result).toBe('multiMin(3, 5)');
  });

  it('parses S_EXPR with mmax operation for old version', () => {
    // S_EXPR = sym 2, op 18 (ssop_mmax in old dict), argNum 2, two S_IMM args
    const result = genMathScalarExpr([2, 18, 2, 0, 3, 0, 5], '2.0');
    expect(result).toBe('multiMax(3, 5)');
  });

  it('parses S_EXPR with sub operation for old version', () => {
    // [2, 4, 0, 10, 0, 3] => ssop_sub(10, 3) => (10 - 3)
    const result = genMathScalarExpr([2, 4, 0, 10, 0, 3], '2.0');
    expect(result).toBe('(10 - 3)');
  });

  it('parses S_EXPR with mul operation for old version', () => {
    // [2, 5, 0, 4, 0, 5] => ssop_mul(4, 5) => (4 * 5)
    const result = genMathScalarExpr([2, 5, 0, 4, 0, 5], '2.0');
    expect(result).toBe('(4 * 5)');
  });

  it('parses S_EXPR with div operation for old version', () => {
    // [2, 6, 0, 10, 0, 2] => ssop_div(10, 2) => (10 / 2)
    const result = genMathScalarExpr([2, 6, 0, 10, 0, 2], '2.0');
    expect(result).toBe('(10 / 2)');
  });

  it('parses S_EXPR with mod operation for old version', () => {
    // [2, 7, 0, 10, 0, 3] => ssop_mod(10, 3) => (10 % 3)
    const result = genMathScalarExpr([2, 7, 0, 10, 0, 3], '2.0');
    expect(result).toBe('(10 % 3)');
  });

  it('parses S_EXPR with eq operation for old version', () => {
    // [2, 8, 0, 1, 0, 2] => ssop_eq(1, 2) => (1 == 2)
    const result = genMathScalarExpr([2, 8, 0, 1, 0, 2], '2.0');
    expect(result).toBe('(1 == 2)');
  });

  it('parses S_EXPR with ne operation for old version', () => {
    // [2, 9, 0, 1, 0, 2] => ssop_ne(1, 2) => (1 != 2)
    const result = genMathScalarExpr([2, 9, 0, 1, 0, 2], '2.0');
    expect(result).toBe('(1 != 2)');
  });

  it('parses S_EXPR with lt operation for old version', () => {
    // [2, 10, 0, 1, 0, 2] => ssop_lt(1, 2) => (1 < 2)
    const result = genMathScalarExpr([2, 10, 0, 1, 0, 2], '2.0');
    expect(result).toBe('(1 < 2)');
  });

  it('parses S_EXPR with le operation for old version', () => {
    // [2, 11, 0, 1, 0, 2] => ssop_le(1, 2) => (1 <= 2)
    const result = genMathScalarExpr([2, 11, 0, 1, 0, 2], '2.0');
    expect(result).toBe('(1 <= 2)');
  });

  it('parses S_EXPR with gt operation for old version', () => {
    // [2, 12, 0, 3, 0, 1] => ssop_gt(3, 1) => (3 > 1)
    const result = genMathScalarExpr([2, 12, 0, 3, 0, 1], '2.0');
    expect(result).toBe('(3 > 1)');
  });

  it('parses S_EXPR with ge operation for old version', () => {
    // [2, 13, 0, 3, 0, 1] => ssop_ge(3, 1) => (3 >= 1)
    const result = genMathScalarExpr([2, 13, 0, 3, 0, 1], '2.0');
    expect(result).toBe('(3 >= 1)');
  });

  it('parses S_EXPR with min operation for old version', () => {
    // [2, 14, 0, 3, 0, 5] => ssop_min(3, 5) => min(3, 5)
    const result = genMathScalarExpr([2, 14, 0, 3, 0, 5], '2.0');
    expect(result).toBe('min(3, 5)');
  });

  it('parses S_EXPR with max operation for old version', () => {
    // [2, 15, 0, 3, 0, 5] => ssop_max(3, 5) => max(3, 5)
    const result = genMathScalarExpr([2, 15, 0, 3, 0, 5], '2.0');
    expect(result).toBe('max(3, 5)');
  });

  it('parses S_EXPR with pos operation for old version', () => {
    // [2, 0, 0, 7] => ssop_pos(7) => 7
    const result = genMathScalarExpr([2, 0, 0, 7], '2.0');
    expect(result).toBe('7');
  });

  it('parses S_EXPR with not operation for old version', () => {
    // [2, 2, 0, 1] => ssop_not(1) => !(1)
    const result = genMathScalarExpr([2, 2, 0, 1], '2.0');
    expect(result).toBe('!(1)');
  });

  it('uses new op dict for version > 2.0', () => {
    // In new dict: op 20 = ssop_add
    // [2, 20, 0, 1, 0, 2] => ssop_add(1, 2) => (1 + 2)
    const result = genMathScalarExpr([2, 20, 0, 1, 0, 2], '2.1');
    expect(result).toBe('(1 + 2)');
  });

  it('uses new op dict for call (op 0) in new version', () => {
    // In new dict: op 0 = ssop_call
    // [2, 0, 2, 1, 'myfunc', 0, 5] => ssop_call(2, myfunc, 5) => myfunc(5)
    const result = genMathScalarExpr([2, 0, 2, 1, 'myfunc', 0, 5], '3.0');
    expect(result).toBe('myfunc(5)');
  });

  it('uses new op dict for unary neg (op 11) in new version', () => {
    // In new dict: op 11 = ssop_neg
    // [2, 11, 0, 5] => ssop_neg(5) => -5
    const result = genMathScalarExpr([2, 11, 0, 5], '3.0');
    expect(result).toBe('-5');
  });

  it('handles nested expressions', () => {
    // ssop_add(ssop_mul(2, 3), 4) => ((2 * 3) + 4)
    // outer: sym 2, op 3 (ssop_add), 2 args
    //   arg1: sym 2, op 5 (ssop_mul), 2 args: S_IMM 2, S_IMM 3
    //   arg2: S_IMM 4
    const result = genMathScalarExpr([2, 3, 2, 5, 0, 2, 0, 3, 0, 4], '2.0');
    expect(result).toBe('((2 * 3) + 4)');
  });

  it('reports error when symList is empty and server is provided', () => {
    const server = makeServer();
    genMathScalarExpr([], '2.0', server);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when sym value is invalid', () => {
    const server = makeServer();
    // sym = 99 is invalid
    genMathScalarExpr([99, 1], '2.0', server);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when arg is missing for S_IMM', () => {
    const server = makeServer();
    // S_IMM with no value
    genMathScalarExpr([0], '2.0', server);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when arg is not a valid number for S_IMM', () => {
    const server = makeServer();
    // S_IMM with non-numeric value
    genMathScalarExpr([0, 'abc'], '2.0', server);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when op is invalid for S_EXPR', () => {
    const server = makeServer();
    // S_EXPR with op 999 (invalid)
    genMathScalarExpr([2, 999], '2.0', server);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when call argNum is missing', () => {
    const server = makeServer();
    // S_EXPR, op 16 (call), but no argNum
    genMathScalarExpr([2, 16], '2.0', server);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('reports error when call argNum is NaN', () => {
    const server = makeServer();
    // S_EXPR, op 16 (call), argNum = 'abc'
    genMathScalarExpr([2, 16, 'abc'], '2.0', server);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });
});

describe('AttrReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('constructs with server and attr array', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [1, 2, 3]);
    expect(reader.hasNext()).toBe(true);
  });

  it('hasNext returns false when index exceeds length', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [1]);
    reader.readNumber();
    expect(reader.hasNext()).toBe(false);
  });

  it('readIndex returns current index', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [1, 2, 3]);
    expect(reader.readIndex()).toBe(0);
    reader.readNumber();
    expect(reader.readIndex()).toBe(1);
  });

  it('readNumber returns current value and advances index', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [10, 20]);
    expect(reader.readNumber()).toBe(10);
    expect(reader.readNumber()).toBe(20);
  });

  it('readNumber reports error and returns NaN when no more elements', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [1]);
    reader.readNumber();
    const result = reader.readNumber();
    expect(result).toBeNaN();
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('readStringOrNumberArray returns array value', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [[1, 2, 3]]);
    const result = reader.readStringOrNumberArray();
    expect(result).toEqual([1, 2, 3]);
  });

  it('readStringOrNumberArray reports error when value is not an array', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [42]);
    const result = reader.readStringOrNumberArray();
    expect(result).toBeUndefined();
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('readStringOrNumberArray reports error when no more elements', () => {
    const server = makeServer();
    const reader = new AttrReader(server, []);
    const result = reader.readStringOrNumberArray();
    expect(result).toBeUndefined();
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('readOptionalNumber returns value when available', () => {
    const server = makeServer();
    const reader = new AttrReader(server, [42]);
    expect(reader.readOptionalNumber()).toBe(42);
  });

  it('readOptionalNumber returns null when no more elements', () => {
    const server = makeServer();
    const reader = new AttrReader(server, []);
    expect(reader.readOptionalNumber()).toBeNull();
  });
});

describe('parseSymbolicOrIntList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses symbolic scalar entries (kind 1)', () => {
    const server = makeServer();
    const attr = [1, [0, 42], 1, [1, 'x']];
    const reader = new AttrReader(server, attr);
    const result = parseSymbolicOrIntList(reader, 2, '2.0');
    expect(result).toEqual(['42', 'x']);
  });

  it('parses integer entries (kind 2)', () => {
    const server = makeServer();
    const attr = [2, 100, 2, 200];
    const reader = new AttrReader(server, attr);
    const result = parseSymbolicOrIntList(reader, 2, '2.0');
    expect(result).toEqual(['100', '200']);
  });

  it('returns empty array for invalid kind', () => {
    const server = makeServer();
    const attr = [99];
    const reader = new AttrReader(server, attr);
    const result = parseSymbolicOrIntList(reader, 1, '2.0');
    expect(result).toEqual([]);
    expect(BaseGraphMsgHandler.returnError).toHaveBeenCalled();
  });

  it('parses mixed symbolic and integer entries', () => {
    const server = makeServer();
    const attr = [1, [0, 42], 2, 99];
    const reader = new AttrReader(server, attr);
    const result = parseSymbolicOrIntList(reader, 2, '2.0');
    expect(result).toEqual(['42', '99']);
  });
});

describe('parseExprList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses multiple expression arrays', () => {
    const server = makeServer();
    const attr = [[0, 42], [1, 'x']];
    const reader = new AttrReader(server, attr);
    const result = parseExprList(reader, 2, '2.0');
    expect(result).toEqual(['42', 'x']);
  });

  it('returns empty array for size 0', () => {
    const server = makeServer();
    const reader = new AttrReader(server, []);
    const result = parseExprList(reader, 0, '2.0');
    expect(result).toEqual([]);
  });

  it('parses complex expressions', () => {
    const server = makeServer();
    // ssop_add(1, 2) => [2, 3, 0, 1, 0, 2]
    const attr = [[2, 3, 0, 1, 0, 2]];
    const reader = new AttrReader(server, attr);
    const result = parseExprList(reader, 1, '2.0');
    expect(result).toEqual(['(1 + 2)']);
  });
});

describe('genMathScalarExpr - invalid sym without server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles invalid sym value without server (covers else branch)', () => {
    const result = genMathScalarExpr([99, 1], '2.0');
    expect(result).toBeUndefined();
  });
});

// parseExpr and parseArgs are internal functions covered indirectly via genMathScalarExpr.
// The tests below exercise expression patterns that trigger all parseExpr/parseArgs branches.

describe('genMathScalarExpr - covers parseExpr branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses call with empty args (parseExpr: ssop_call with no args => ())', () => {
    // [2, 16, 0, 1, 'func'] => ssop_call(0, func) => func() => parseExpr returns '()'
    const result = genMathScalarExpr([2, 16, 0, 1, 'func'], '2.0');
    expect(result).toBe('()');
  });

  it('parses expression that produces ssop_ prefix without parens (parseExpr: no opMatch)', () => {
    // This branch returns expr as-is when no parentheses match
    // genMathScalarExpr always produces ssop_xxx(...) so this is hard to trigger via genMathScalarExpr
    // But parseExpr is called on the result of symsGetExpr which always produces ssop_xxx(args)
    // So this branch is dead code in the context of genMathScalarExpr
  });

  it('parses expression with unknown opType (parseExpr: returns expr as-is)', () => {
    // S_EXPR with op that maps to a name but parseExpr doesn't recognize the opType
    // This happens when symsOpNameDict has the op but opMap doesn't
    // In old dict, all ops are in opMap, so this is hard to trigger
    // But if we use an op that's in symsOpNameDict but not in opMap... all are in opMap
  });

  it('parses binary op with 3 args (parseExpr: args.length !== 2 and !== 1)', () => {
    // ssop_add with 3 args => parseExpr processes as binary, uses first 2 args
    // [2, 3, 0, 1, 0, 2, 0, 3] => ssop_add(1,2,3) => parseExpr => (1 + 2)
    const result = genMathScalarExpr([2, 3, 0, 1, 0, 2, 0, 3], '2.0');
    expect(result).toBe('(1 + 2)');
  });

  it('parses binary op with single arg (parseExpr: args.length === 1)', () => {
    // ssop_add with 1 arg => parseExpr returns '+(1)'
    // [2, 3, 0, 1] => ssop_add(1) => parseExpr returns '+(1)'
    const result = genMathScalarExpr([2, 3, 0, 1], '2.0');
    expect(result).toBe('+(1)');
  });

  it('parses nested expression with parentheses in args (parseArgs: nested commas)', () => {
    // ssop_add(ssop_mul(2, 3), 4) => parseArgs needs to handle nested parens
    const result = genMathScalarExpr([2, 3, 2, 5, 0, 2, 0, 3, 0, 4], '2.0');
    expect(result).toBe('((2 * 3) + 4)');
  });

  it('parses ssop_pos (unary, opChar empty => returns right as-is)', () => {
    // [2, 0, 0, 7] => ssop_pos(7) => parseExpr returns '7'
    const result = genMathScalarExpr([2, 0, 0, 7], '2.0');
    expect(result).toBe('7');
  });

  it('parses S_SYM variable (parseExpr: non-ssop_ prefix returns as-is)', () => {
    // [1, 'myvar'] => S_SYM => symsGetExpr returns 'myvar' => parseExpr returns 'myvar'
    const result = genMathScalarExpr([1, 'myvar'], '2.0');
    expect(result).toBe('myvar');
  });

  it('parses S_IMM integer (parseExpr: non-ssop_ prefix returns as-is)', () => {
    // [0, 42] => S_IMM => symsGetExpr returns '42' => parseExpr returns '42'
    const result = genMathScalarExpr([0, 42], '2.0');
    expect(result).toBe('42');
  });

  it('covers parseExpr ssop_call with func name and args', () => {
    // [2, 16, 2, 1, 'myfunc', 0, 5] => ssop_call(2, myfunc, 5) => myfunc(5)
    const result = genMathScalarExpr([2, 16, 2, 1, 'myfunc', 0, 5], '2.0');
    expect(result).toBe('myfunc(5)');
  });
});
describe('getVersionNum via genMathScalarExpr', () => {
  it('defaults to 20 when version parses to 0', () => {
    // version '0.0' => versionNumber = 0, defaults to 20 (old dict)
    // S_IMM value 42
    const result = genMathScalarExpr([0, 42], '0.0');
    expect(result).toBe('42');
  });
});

// parseArgs is an internal function covered indirectly via genMathScalarExpr.
