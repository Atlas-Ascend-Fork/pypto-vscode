/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const M = vi.hoisted(() => {
  const getColorByString = vi.fn(() => ({ baseColor: '#123456', lightColor: '#abcdef' }));
  const generateColorList = vi.fn(() => []);
  const getSwimGraphParsedInfoStore = vi.fn(() => ({ set: vi.fn() }));
  const mockFs = { createReadStream: vi.fn(), createWriteStream: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() };
  const makeEmitter = () => { const e = new EventEmitter(); (e as any).on = vi.fn(); (e as any).write = vi.fn(); (e as any).pipe = vi.fn(); (e as any).destroy = vi.fn(); return e; };
  const JSONStreamParse = vi.fn(() => makeEmitter());
  const streamJsonParser = vi.fn(() => makeEmitter());
  const streamChainChain = vi.fn(() => makeEmitter());
  const streamObjectFn = vi.fn(() => makeEmitter());
  return { getColorByString, generateColorList, getSwimGraphParsedInfoStore, mockFs, makeEmitter, JSONStreamParse, streamJsonParser, streamChainChain, streamObjectFn };
});

vi.mock('vscode', async () => { const m = await import('./mocks/vscode'); return { ...m }; });
vi.mock('i18next', () => ({ t: (key: string, opts?: any) => key + (opts ? JSON.stringify(opts) : '') }));
vi.mock(import('../../../src/color-list'), () => ({ generateColorList: M.generateColorList, getColorByString: M.getColorByString }));
vi.mock(import('../../../src/core/swimSqlInit'), () => ({ getSwimGraphParsedInfoStore: M.getSwimGraphParsedInfoStore }));
vi.mock('fs', async (orig) => { const a = await orig<typeof import('fs')>(); return { ...a, ...M.mockFs }; });
vi.mock('JSONStream', () => ({ default: { parse: M.JSONStreamParse } }));
vi.mock('stream-json', () => ({ parser: M.streamJsonParser }));
vi.mock('stream-chain', () => ({ chain: M.streamChainChain }));
vi.mock('stream-json/streamers/StreamObject', () => ({ streamObject: M.streamObjectFn }));

import { getSemanticColor, parsePmuInfo, processTotalPmuCalc, checkPmuDataValid, parseSwimLaneInfo, saveParsedInfoToDB, saveCompressedDataPathToDB, readSwimlaneFileStream, writeLargeObjectToFileThreadGranular, getSavedSwimDataFileStreamAll } from '../../../src/process';
import { hismartliteEx } from '../../../src/hismarliteEx';
import * as swimSqlInitMod from '../../../src/core/swimSqlInit';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  M.getColorByString.mockClear();
  M.getColorByString.mockReturnValue({ baseColor: '#123456', lightColor: '#abcdef' } as any);
  vi.spyOn(swimSqlInitMod, 'getSwimGraphParsedInfoStore').mockReturnValue({ set: vi.fn() } as any);
  M.mockFs.createReadStream.mockClear();
  M.mockFs.createWriteStream.mockClear();
  M.mockFs.existsSync.mockClear();
  M.mockFs.mkdirSync.mockClear();
  M.JSONStreamParse.mockClear();
  M.JSONStreamParse.mockReturnValue(M.makeEmitter());
  M.streamJsonParser.mockClear();
  M.streamJsonParser.mockReturnValue(M.makeEmitter());
  M.streamChainChain.mockClear();
  M.streamChainChain.mockReturnValue(M.makeEmitter());
  M.streamObjectFn.mockClear();
  M.streamObjectFn.mockReturnValue(M.makeEmitter());
  (hismartliteEx as any).context = { globalStorageUri: { fsPath: '/storage' } };
  (hismartliteEx as any).isDebug = false;
  (hismartliteEx as any).startTime = 0;
  (hismartliteEx as any).transformStartTime = 0;
});

describe('getSemanticColor', () => {
  it('returns dark base and light colors', () => {
    const result = getSemanticColor({ color: 'label1' }, [], []);
    expect(result).toBeDefined();
    expect(result.dark).toBeDefined();
    expect(typeof result.dark.base).toBe('string');
  });

  it('returns default color when getColorByString returns null', () => {
    M.getColorByString.mockReturnValueOnce({ baseColor: null, lightColor: null } as any);
    const result = getSemanticColor({}, [], []);
    expect(result.dark.base).toBe('#666666');
    expect(result.dark.light).toBe('#666666');
  });
});

describe('parsePmuInfo', () => {
  it('parses CSV with seqNo', () => {
    const csv = 'seqNo,sub task id,total cycle,vec_busy_cycles,cube_busy_cycles,scalar_busy_cycles,mte1_busy_cycles,mte2_busy_cycles,mte3_busy_cycles,icache_miss,icache_req\n1,10,1000,100,200,50,10,20,30,5,100';
    const result = parsePmuInfo(csv);
    expect(result['1-10']).toBeDefined();
    expect(result['1-10']['vec_ratio']).toBe(0.1);
  });

  it('parses CSV with sub graph id', () => {
    const csv = 'sub graph id,sub task id,total cycle,vec_busy_cycles,cube_busy_cycles,scalar_busy_cycles,mte1_busy_cycles,mte2_busy_cycles,mte3_busy_cycles,icache_miss,icache_req\nsg1,20,2000,200,400,100,20,40,60,10,200';
    const result = parsePmuInfo(csv);
    expect(result['sg1-20']).toBeDefined();
  });

  it('skips lines without seqNo and sub graph id', () => {
    const result = parsePmuInfo('other,total cycle\n1,100');
    expect(Object.keys(result).length).toBe(0);
  });

  it('skips empty lines', () => {
    const csv = 'seqNo,sub task id,total cycle,vec_busy_cycles,cube_busy_cycles,scalar_busy_cycles,mte1_busy_cycles,mte2_busy_cycles,mte3_busy_cycles,icache_miss,icache_req\n1,10,100,100,200,50,10,20,30,5,100\n\n';
    expect(Object.keys(parsePmuInfo(csv)).length).toBe(1);
  });

  it('skips lines with empty seqNo or sub task id', () => {
    const csv = 'other,sub task id,total cycle,vec_busy_cycles,cube_busy_cycles,scalar_busy_cycles,mte1_busy_cycles,mte2_busy_cycles,mte3_busy_cycles,icache_miss,icache_req\n10,,100,100,200,50,10,20,30,5,100\n,20,100,100,200,50,10,20,30,5,100';
    expect(Object.keys(parsePmuInfo(csv)).length).toBe(0);
  });

  it('normalizes PMU field aliases', () => {
    const csv = 'seqNo,sub task id,total cycle,pmu_idc_aic_vec_busy_o,cube_instr_busy,scalar_instr_busy,mte1_instr_busy,mte2_instr_busy,mte3_instr_busy,icache_miss,icache_req\n1,10,1000,100,200,50,10,20,30,5,100';
    const result = parsePmuInfo(csv);
    expect(result['1-10'].vec_busy_cycles).toBe('100');
    expect(result['1-10'].__available_pmu_fields.vec_busy_cycles).toBe(true);
  });
});

describe('processTotalPmuCalc', () => {
  it('converts bigint values to strings and calculates ratios', () => {
    const pmuTotal: any = { 'total cycle': 1000n, vec_busy_cycles: 100n, cube_busy_cycles: 200n, scalar_busy_cycles: 50n, mte1_busy_cycles: 10n, mte2_busy_cycles: 20n, mte3_busy_cycles: 30n, icache_miss: 5n, icache_req: 100n, pmu_fix_instr_busy: 5n };
    processTotalPmuCalc(pmuTotal);
    expect(typeof pmuTotal['total cycle']).toBe('string');
    expect(pmuTotal['vec_ratio']).toBe('0.1');
  });

  it('handles undefined pmu_fix_instr_busy', () => {
    const pmuTotal: any = { 'total cycle': 1000n, vec_busy_cycles: 100n, cube_busy_cycles: 200n, scalar_busy_cycles: 50n, mte1_busy_cycles: 10n, mte2_busy_cycles: 20n, mte3_busy_cycles: 30n, icache_miss: 5n, icache_req: 100n };
    processTotalPmuCalc(pmuTotal);
    expect(pmuTotal.pmu_fix_instr_busy).toBeUndefined();
  });
});

describe('checkPmuDataValid', () => {
  it('returns false for null', () => { expect(checkPmuDataValid(null)).toBe(false); });
  it('returns false for empty', () => { expect(checkPmuDataValid({})).toBe(false); });
  it('returns false when missing required fields', () => { expect(checkPmuDataValid({ 'total cycle': 100, vec_busy_cycles: 50 }, ['x'])).toBe(false); });
  it('returns false when total cycle is 0', () => { expect(checkPmuDataValid({ 'total cycle': 0, vec_busy_cycles: 50 }, [])).toBe(false); });
  it('returns false when no valid busy cycle', () => { expect(checkPmuDataValid({ 'total cycle': 100, vec_busy_cycles: 0 }, [])).toBe(false); });
  it('returns true when valid', () => { expect(checkPmuDataValid({ 'total cycle': 100, vec_busy_cycles: 50 }, [])).toBe(true); });
  it('returns true with all required headers', () => {
    const h = ['pmu_idc_aic_vec_busy_o', 'cube_instr_busy', 'scalar_instr_busy', 'mte1_instr_busy', 'mte2_instr_busy', 'mte3_instr_busy', 'pmu_fix_instr_busy', 'icache_req', 'icache_miss'];
    expect(checkPmuDataValid({ 'total cycle': 100, vec_busy_cycles: 50 }, h)).toBe(true);
  });
});

describe('parseSwimLaneInfo', () => {
  it('returns error when traceData is null', async () => { expect((await parseSwimLaneInfo(null, {}, {}, {})).errMsg).toBeDefined(); });
  it('returns error when traceEvents is missing', async () => { expect((await parseSwimLaneInfo({}, {}, {}, {})).errMsg).toBeDefined(); });
  it('returns error for unsupported event phase', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'Z', name: 't', pid: 1, tid: 1, ts: 0 }] }, {}, {}, {})).errMsg).toBeDefined(); });
  it('parses basic X phase events', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't', pid: 1, tid: 1, ts: 100, dur: 50, args: { name: 'th' } }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); expect(r.processes).toBeInstanceOf(Map); });
  it('parses B/E event pairs', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'B', name: 't', pid: 1, tid: 1, ts: 100, id: 'e1', originalIndex: 0, args: { name: 'th' } }, { ph: 'E', name: 't', pid: 1, tid: 1, ts: 200, id: 'e1', originalIndex: 1, args: { name: 'th' } }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); });
  it('parses counter events', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'C', name: 'c1', pid: 1, tid: 1, ts: 100, args: { size: 50 } }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); expect(r.counterEvents.length).toBe(1); });
  it('parses process_name metadata', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'M', name: 'process_name', pid: 1, args: { name: 'P1', type: 'aicpu' } }, { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } }, { ph: 'X', name: 't', pid: 1, tid: 1, ts: 100, dur: 50, args: {} }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); });
  it('parses flow events', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't1', pid: 1, tid: 1, ts: 100, dur: 100, args: {}, originalIndex: 0 }, { ph: 'X', name: 't2', pid: 1, tid: 2, ts: 150, dur: 100, args: {}, originalIndex: 1 }, { ph: 's', id: 1, pid: 1, tid: 1, ts: 200 }, { ph: 'f', id: 1, pid: 1, tid: 2, ts: 150 }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); });
  it('parses with task2topo dependencies', async () => { const t2t = { '1-10': { leafIndex: '0', successors: ['1-20'] }, '1-20': { leafIndex: '1', successors: [] } }; const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't1', pid: 1, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 }, { ph: 'X', name: 't2', pid: 1, tid: 1, ts: 200, dur: 50, args: { seqNo: 1, taskId: 20 }, originalIndex: 1 }] }, {}, t2t, {}); expect(r.errMsg).toBeUndefined(); });
  it('handles Fake Core events', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } }, { ph: 'X', name: 't', pid: 4, tid: 1, ts: 100, dur: 50, args: {}, originalIndex: 0 }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); });
  it('handles events with syncEvents', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't', pid: 1, tid: 1, ts: 100, dur: 50, args: { syncEvents: [{ time: 100 }] }, originalIndex: 0 }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); });
  it('handles invalid thread_name event', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: {} }] }, {}, {}, {})).errMsg).toBeDefined(); });
  it('handles invalid duration event', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't', pid: 1, tid: 1, dur: 50, args: {} }] }, {}, {}, {})).errMsg).toBeDefined(); });
  it('handles X phase without dur', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't', pid: 1, tid: 1, ts: 100, args: {} }] }, {}, {}, {})).errMsg).toBeDefined(); });
  it('handles invalid counter event', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'C', name: 'c', pid: 1, tid: 1, ts: 100, args: { size: 'x' } }] }, {}, {}, {})).errMsg).toBeDefined(); });
  it('handles counter with /byte', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'C', name: 'c', pid: 1, tid: 1, ts: 100, args: { '/byte': 100 } }] }, {}, {}, {})).errMsg).toBeUndefined(); });
  it('handles counter with value', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'C', name: 'c', pid: 1, tid: 1, ts: 100, args: { value: 100 } }] }, {}, {}, {})).errMsg).toBeUndefined(); });
  it('handles counter with no valid args', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'C', name: 'c', pid: 1, tid: 1, ts: 100, args: { other: 'v' } }] }, {}, {}, {})).errMsg).toBeDefined(); });
  it('skips OOO_ events', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 'OOO_Memory_Trace', pid: 1, tid: 1, ts: 100, dur: 50, args: {} }] }, {}, {}, {})).errMsg).toBeUndefined(); });
  it('handles aicpu process type', async () => { const r = await parseSwimLaneInfo({ traceEvents: [{ ph: 'M', name: 'process_name', pid: 3, args: { name: 'AICPU', type: 'aicpu' } }, { ph: 'M', name: 'process_name', pid: 4, args: { name: 'AICore' } }, { ph: 'X', name: 't1', pid: 3, tid: 1, ts: 100, dur: 50, args: {}, originalIndex: 0 }, { ph: 'X', name: 't2', pid: 4, tid: 1, ts: 200, dur: 50, args: {}, originalIndex: 1 }] }, {}, {}, {}); expect(r.errMsg).toBeUndefined(); expect(r.isE2ESwim).toBe(true); });
  it('handles pmuInfo with matching tasks', async () => {
    const pmu = { '1-10': { vec_busy_cycles: '100', cube_busy_cycles: '200', scalar_busy_cycles: '50', mte1_busy_cycles: '10', mte2_busy_cycles: '20', mte3_busy_cycles: '30', icache_miss: '5', icache_req: '100', 'total cycle': '1000' } };
    expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } }, { ph: 'X', name: 't', pid: 1, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 }] }, pmu, {}, {})).errMsg).toBeUndefined();
  });
  it('handles duplicate task ids in task2topo', async () => { const t2t = { '1-10': { leafIndex: '0', successors: [] } }; expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't1', pid: 1, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 }, { ph: 'X', name: 't2', pid: 1, tid: 1, ts: 200, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 1 }] }, {}, t2t, {})).errMsg).toBeUndefined(); });
  it('handles zero duration events', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'X', name: 't', pid: 1, tid: 1, ts: 100, dur: 0, args: {}, originalIndex: 0 }] }, {}, {}, {})).errMsg).toBeUndefined(); });
  it('handles B without matching E', async () => { expect((await parseSwimLaneInfo({ traceEvents: [{ ph: 'B', name: 't', pid: 1, tid: 1, ts: 100, id: 'e1', originalIndex: 0, args: {} }] }, {}, {}, {})).errMsg).toBeUndefined(); });
});

describe('saveParsedInfoToDB', () => {
  it('saves to DB when useCache is true', async () => {
    const mockSet = vi.fn();
    vi.spyOn(swimSqlInitMod, 'getSwimGraphParsedInfoStore').mockReturnValue({ set: mockSet } as any);
    M.mockFs.existsSync.mockReturnValue(true);
    const ws = { write: vi.fn(), end: vi.fn(), on: vi.fn((e: string, cb: Function) => { if (e === 'finish') setTimeout(cb, 0); }), destroy: vi.fn() };
    M.mockFs.createWriteStream.mockReturnValue(ws);
    await saveParsedInfoToDB(true, '/test/swim.json', '2024-01-01', '', '', { counterEvents: [], processes: {}, processExpanded: {}, lane2line: {}, pmu_total: {}, pmuValid: false, timeInfo: {}, minTs: 0 });
    expect(mockSet).toHaveBeenCalled();
  });

  it('does not save when useCache is false', async () => {
    const mockSet = vi.fn();
    vi.spyOn(swimSqlInitMod, 'getSwimGraphParsedInfoStore').mockReturnValue({ set: mockSet } as any);
    await saveParsedInfoToDB(false, '/test/swim.json', '2024-01-01', '', '', {});
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('initializes pmu_total if missing', async () => {
    const mockSet = vi.fn();
    vi.spyOn(swimSqlInitMod, 'getSwimGraphParsedInfoStore').mockReturnValue({ set: mockSet } as any);
    M.mockFs.existsSync.mockReturnValue(true);
    const ws = { write: vi.fn(), end: vi.fn(), on: vi.fn((e: string, cb: Function) => { if (e === 'finish') setTimeout(cb, 0); }), destroy: vi.fn() };
    M.mockFs.createWriteStream.mockReturnValue(ws);
    const info: any = { counterEvents: [], processes: {}, processExpanded: {}, lane2line: {}, timeInfo: {}, minTs: 0 };
    await saveParsedInfoToDB(true, '/test/swim.json', '2024-01-01', '', '', info);
    expect(info.pmu_total).toEqual({});
  });
});

describe('saveCompressedDataPathToDB', () => {
  it('saves compressed path to DB', async () => {
    const mockSet = vi.fn();
    vi.spyOn(swimSqlInitMod, 'getSwimGraphParsedInfoStore').mockReturnValue({ set: mockSet } as any);
    await saveCompressedDataPathToDB('/test/swim.json', '2024-01-01', '', '', '/cache/compressed');
    expect(mockSet).toHaveBeenCalled();
  });
});

describe('readSwimlaneFileStream', () => {
  it('reads perf swimlane format', async () => {
    const parser = M.makeEmitter();
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    M.JSONStreamParse.mockReturnValue(parser);
    (parser as any).on.mockImplementation((e: string, cb: Function) => { if (e === 'data') setTimeout(() => cb({}), 0); if (e === 'end') setTimeout(cb, 10); });
    const result = await readSwimlaneFileStream('/test/swim.json', true);
    expect(result).toBeDefined();
  });

  it('reads merged swimlane format', async () => {
    const parser = M.makeEmitter();
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    M.JSONStreamParse.mockReturnValue(parser);
    (parser as any).on.mockImplementation((e: string, cb: Function) => { if (e === 'end') setTimeout(cb, 30); });
    (rs as any).on.mockImplementation((e: string, cb: Function) => { if (e === 'data') setTimeout(() => cb(Buffer.from('{"traceEvents":[]}')), 0); if (e === 'end') setTimeout(cb, 20); });
    const result = await readSwimlaneFileStream('/test/swim.json', false);
    expect(result).toBeDefined();
  });
});

describe('writeLargeObjectToFileThreadGranular', () => {
  it('writes object with all fields', async () => {
    M.mockFs.existsSync.mockReturnValue(true);
    const ws = { write: vi.fn(), end: vi.fn(), on: vi.fn((e: string, cb: Function) => { if (e === 'finish') setTimeout(cb, 0); }), destroy: vi.fn() };
    M.mockFs.createWriteStream.mockReturnValue(ws);
    await writeLargeObjectToFileThreadGranular({ counterEvents: [], processes: { '1': { pid: 1, processName: 'P1', type: 'kernel', threads: { '1-1': { tid: 1, threadName: 'T1', events: [] } } } }, processExpanded: { '1': true }, minTs: 0, lane2line: {}, pmu_total: {}, pmuValid: false, timeInfo: { maxTime: 100, minTime: 0 }, colorRendering: {}, isAicpu: true, isE2ESwim: true }, '/test/output.json');
    expect(ws.end).toHaveBeenCalled();
  });

  it('creates directory when missing', async () => {
    M.mockFs.existsSync.mockReturnValue(false);
    const ws = { write: vi.fn(), end: vi.fn(), on: vi.fn((e: string, cb: Function) => { if (e === 'finish') setTimeout(cb, 0); }), destroy: vi.fn() };
    M.mockFs.createWriteStream.mockReturnValue(ws);
    await writeLargeObjectToFileThreadGranular({ counterEvents: [], processes: {}, processExpanded: {}, minTs: 0, lane2line: {}, pmu_total: {}, pmuValid: false, timeInfo: {} }, '/test/new/output.json');
    expect(M.mockFs.mkdirSync).toHaveBeenCalled();
  });

  it('handles write error', async () => {
    M.mockFs.existsSync.mockReturnValue(true);
    const ws = { write: vi.fn(() => { throw new Error('write error'); }), end: vi.fn(), on: vi.fn(), destroy: vi.fn() };
    M.mockFs.createWriteStream.mockReturnValue(ws);
    await expect(writeLargeObjectToFileThreadGranular({ counterEvents: [], processes: {}, processExpanded: {}, minTs: 0, lane2line: {}, pmu_total: {}, pmuValid: false, timeInfo: {} }, '/test/output.json')).rejects.toThrow();
  });

  it('writes without optional fields', async () => {
    M.mockFs.existsSync.mockReturnValue(true);
    const ws = { write: vi.fn(), end: vi.fn(), on: vi.fn((e: string, cb: Function) => { if (e === 'finish') setTimeout(cb, 0); }), destroy: vi.fn() };
    M.mockFs.createWriteStream.mockReturnValue(ws);
    await writeLargeObjectToFileThreadGranular({ counterEvents: [], processes: {}, processExpanded: {}, minTs: 0, lane2line: {}, pmu_total: {}, pmuValid: false, timeInfo: {} }, '/test/output.json');
    expect(ws.end).toHaveBeenCalled();
  });
});

describe('process.ts coverage supplements', () => {
  beforeEach(() => {
    M.getColorByString.mockClear();
    M.getColorByString.mockReturnValue({ baseColor: '#123456', lightColor: '#abcdef' } as any);
    vi.spyOn(swimSqlInitMod, 'getSwimGraphParsedInfoStore').mockReturnValue({ set: vi.fn() } as any);
    (hismartliteEx as any).context = { globalStorageUri: { fsPath: '/storage' } };
  });

  it('Fake Core events with dependencies (predecessors/successors)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } },
      { ph: 'X', name: 'task1', pid: 4, tid: 1, ts: 100, dur: 50, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 4, tid: 1, ts: 200, dur: 50, args: {}, originalIndex: 1 },
      { ph: 's', id: 1, pid: 4, tid: 1, ts: 150 },
      { ph: 'f', id: 1, pid: 4, tid: 1, ts: 200 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('Fake Core events with global clip (renderEndTime > globalMaxTime)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } },
      { ph: 'X', name: 'task1', pid: 4, tid: 1, ts: 100, dur: 500, args: {}, originalIndex: 0 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('Fake Core events with multiple lines (tryPlaceInExistingLine)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } },
      { ph: 'X', name: 'task1', pid: 4, tid: 1, ts: 100, dur: 50, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 4, tid: 1, ts: 110, dur: 50, args: {}, originalIndex: 1 },
      { ph: 'X', name: 'task3', pid: 4, tid: 1, ts: 120, dur: 50, args: {}, originalIndex: 2 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('zero duration event with same startTime as existing line', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 0, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 1, tid: 1, ts: 100, dur: 0, args: {}, originalIndex: 1 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('parsePmuInfo with seqNo but without sub task id column', () => {
    const csv = 'seqNo,total cycle,vec_busy_cycles,cube_busy_cycles,scalar_busy_cycles,mte1_busy_cycles,mte2_busy_cycles,mte3_busy_cycles,icache_miss,icache_req\n1,1000,100,200,50,10,20,30,5,100';
    expect(Object.keys(parsePmuInfo(csv)).length).toBe(0);
  });

  it('parsePmuInfo with sub graph id but without sub task id column', () => {
    const csv = 'sub graph id,total cycle,vec_busy_cycles,cube_busy_cycles,scalar_busy_cycles,mte1_busy_cycles,mte2_busy_cycles,mte3_busy_cycles,icache_miss,icache_req\nsg1,1000,100,200,50,10,20,30,5,100';
    expect(Object.keys(parsePmuInfo(csv)).length).toBe(0);
  });

  it('flow events with matching pid/tid for dependency calculation', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'M', name: 'thread_name', pid: 1, tid: 2, args: { name: 'T2' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 100, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 1, tid: 2, ts: 150, dur: 100, args: {}, originalIndex: 1 },
      { ph: 's', id: 1, pid: 1, tid: 1, ts: 150 },
      { ph: 'f', id: 1, pid: 1, tid: 2, ts: 200 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('flow events where start.ts > end.ts (skipped)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'M', name: 'thread_name', pid: 1, tid: 2, args: { name: 'T2' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 100, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 1, tid: 2, ts: 150, dur: 100, args: {}, originalIndex: 1 },
      { ph: 's', id: 1, pid: 1, tid: 1, ts: 300 },
      { ph: 'f', id: 1, pid: 1, tid: 2, ts: 200 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('flow events with missing start or end (incomplete pair)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 100, args: {}, originalIndex: 0 },
      { ph: 's', id: 1, pid: 1, tid: 1, ts: 150 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('PMU info with not-found tasks and useless PMU entries', async () => {
    const pmu = { '99-99': { vec_busy_cycles: '100', cube_busy_cycles: '200', scalar_busy_cycles: '50', mte1_busy_cycles: '10', mte2_busy_cycles: '20', mte3_busy_cycles: '30', icache_miss: '5', icache_req: '100', 'total cycle': '1000' } };
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 },
    ] };
    const result = await parseSwimLaneInfo(traceData, pmu, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('event with Fake Core threadName in processTaskPmuCalc (skipped)', async () => {
    const pmu = { '1-10': { vec_busy_cycles: '100', cube_busy_cycles: '200', scalar_busy_cycles: '50', mte1_busy_cycles: '10', mte2_busy_cycles: '20', mte3_busy_cycles: '30', icache_miss: '5', icache_req: '100', 'total cycle': '1000' } };
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } },
      { ph: 'X', name: 'task1', pid: 4, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 },
    ] };
    const result = await parseSwimLaneInfo(traceData, pmu, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('event without seqNo/taskId in processTaskPmuCalc', async () => {
    const pmu = { '1-10': { vec_busy_cycles: '100', 'total cycle': '1000' } };
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 50, args: {}, originalIndex: 0 },
    ] };
    const result = await parseSwimLaneInfo(traceData, pmu, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('thread_name event without pid (threadError without id)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', tid: 1, args: { name: 'T1' } },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeDefined();
  });

  it('thread_name event without args.name', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { other: 'val' } },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeDefined();
  });

  it('counter event with non-number /byte', async () => {
    const traceData = { traceEvents: [
      { ph: 'C', name: 'counter1', pid: 1, tid: 1, ts: 100, args: { '/byte': 'not a number' } },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeDefined();
  });

  it('counter event missing required fields', async () => {
    const traceData = { traceEvents: [
      { ph: 'C', name: 'counter1', pid: 1, ts: 100, args: { size: 50 } },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeDefined();
  });

  it('multiple counter events (sorted)', async () => {
    const traceData = { traceEvents: [
      { ph: 'C', name: 'counter1', pid: 1, tid: 1, ts: 200, args: { size: 50 } },
      { ph: 'C', name: 'counter1', pid: 1, tid: 1, ts: 100, args: { size: 30 } },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
    expect(result.counterEvents.length).toBe(2);
    expect(result.counterEvents[0].ts).toBeLessThanOrEqual(result.counterEvents[1].ts);
  });

  it('calculateDependenciesBytopo throws error', async () => {
    const task2topo = { '1-10': { leafIndex: '0', successors: ['1-20'] }, '1-20': { leafIndex: '1', successors: [] } };
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 1, tid: 1, ts: 200, dur: 50, args: { seqNo: 1, taskId: 20 }, originalIndex: 1 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, task2topo, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('writeLargeObjectToFileThreadGranular with multiple processes and threads', async () => {
    M.mockFs.existsSync.mockReturnValue(true);
    const ws = { write: vi.fn(), end: vi.fn(), on: vi.fn((e: string, cb: Function) => { if (e === 'finish') setTimeout(cb, 0); }), destroy: vi.fn() };
    M.mockFs.createWriteStream.mockReturnValue(ws);
    const obj = {
      counterEvents: [],
      processes: {
        '1': { pid: 1, processName: 'P1', type: 'kernel', threads: { '1-1': { tid: 1, threadName: 'T1', events: [] }, '1-2': { tid: 2, threadName: 'T2', events: [] } } },
        '2': { pid: 2, processName: 'P2', threads: { '2-1': { tid: 1, threadName: 'T3', events: [] } } },
      },
      processExpanded: { '1': true, '2': false },
      minTs: 0, lane2line: {}, pmu_total: {}, pmuValid: false,
      timeInfo: { maxTime: 100, minTime: 0 },
    };
    await writeLargeObjectToFileThreadGranular(obj, '/test/output.json');
    expect(ws.end).toHaveBeenCalled();
  });

  it('readPerfSwimlaneFileStream with stream error', async () => {
    const parser = M.makeEmitter();
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    M.JSONStreamParse.mockReturnValue(parser);
    (rs as any).on.mockImplementation((e: string, cb: Function) => { if (e === 'error') setTimeout(() => cb(new Error('read error')), 0); });
    await expect(readSwimlaneFileStream('/test/swim.json', true)).rejects.toThrow();
  });

  it('readPerfSwimlaneFileStream with JSON parse error', async () => {
    const parser = M.makeEmitter();
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    M.JSONStreamParse.mockReturnValue(parser);
    (parser as any).on.mockImplementation((e: string, cb: Function) => { if (e === 'error') setTimeout(() => cb(new Error('parse error')), 0); });
    await expect(readSwimlaneFileStream('/test/swim.json', true)).rejects.toThrow();
  });

  it('readPerfSwimlaneFileStream with createReadStream throwing', async () => {
    M.mockFs.createReadStream.mockImplementation(() => { throw new Error('ENOENT'); });
    await expect(readSwimlaneFileStream('/test/swim.json', true)).rejects.toThrow();
  });

  it('readMergedSwimlaneFileStream with array format', async () => {
    const parser = M.makeEmitter();
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    M.JSONStreamParse.mockReturnValue(parser);
    (parser as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'data') setTimeout(() => cb({ name: 'event' }), 0);
      if (e === 'end') setTimeout(cb, 30);
    });
    (rs as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'data') setTimeout(() => cb(Buffer.from('[{"name":"event"}]')), 0);
      if (e === 'end') setTimeout(cb, 20);
    });
    const result = await readSwimlaneFileStream('/test/swim.json', false);
    expect(result).toBeDefined();
  });

  it('readMergedSwimlaneFileStream with unrecognizable format', async () => {
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    (rs as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'data') setTimeout(() => cb(Buffer.from('invalid_format_data_here')), 0);
    });
    await expect(readSwimlaneFileStream('/test/swim.json', false)).rejects.toThrow();
  });

  it('readMergedSwimlaneFileStream with stream error', async () => {
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    (rs as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'error') setTimeout(() => cb(new Error('read error')), 0);
    });
    await expect(readSwimlaneFileStream('/test/swim.json', false)).rejects.toThrow();
  });

  it('readMergedSwimlaneFileStream with JSON parse error', async () => {
    const parser = M.makeEmitter();
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    M.JSONStreamParse.mockReturnValue(parser);
    (parser as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'error') setTimeout(() => cb(new Error('parse error')), 0);
    });
    (rs as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'data') setTimeout(() => cb(Buffer.from('{"traceEvents":[]}')), 0);
    });
    await expect(readSwimlaneFileStream('/test/swim.json', false)).rejects.toThrow();
  });

  it('readMergedSwimlaneFileStream with stream end before format detected', async () => {
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    (rs as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'end') setTimeout(cb, 0);
    });
    const result = await readSwimlaneFileStream('/test/swim.json', false);
    expect(result).toBeDefined();
  });

  it('readMergedSwimlaneFileStream with createReadStream throwing', async () => {
    M.mockFs.createReadStream.mockImplementation(() => { throw new Error('ENOENT'); });
    await expect(readSwimlaneFileStream('/test/swim.json', false)).rejects.toThrow();
  });

  it('Fake Core event with renderEndTime exceeding globalMaxTime (applyGlobalClip)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } },
      { ph: 'M', name: 'thread_name', pid: 4, tid: 2, args: { name: 'Fake Core 1' } },
      { ph: 'X', name: 'task1', pid: 4, tid: 1, ts: 100, dur: 200, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 4, tid: 2, ts: 50, dur: 400, args: {}, originalIndex: 1 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('Fake Core event where existing line position exceeds maxEnd (continue)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } },
      { ph: 'X', name: 'task1', pid: 4, tid: 1, ts: 100, dur: 50, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 4, tid: 1, ts: 250, dur: 50, args: {}, originalIndex: 1 },
      { ph: 'X', name: 'task3', pid: 4, tid: 1, ts: 100, dur: 50, args: {}, originalIndex: 2 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('flow events where findEvent goes left and returns null', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'M', name: 'thread_name', pid: 1, tid: 2, args: { name: 'T2' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 200, dur: 100, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'task2', pid: 1, tid: 2, ts: 400, dur: 100, args: {}, originalIndex: 1 },
      { ph: 's', id: 1, pid: 1, tid: 1, ts: 50 },
      { ph: 'f', id: 1, pid: 1, tid: 2, ts: 300 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('calculateDependenciesBytopo throws with invalid task2topo', async () => {
    const task2topo = { '1-10': { leafIndex: '0', successors: ['nonexistent'] } };
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, task2topo, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('readMergedSwimlaneFileStream with multiple data chunks after format detected', async () => {
    const parser = M.makeEmitter();
    const rs = M.makeEmitter();
    M.mockFs.createReadStream.mockReturnValue(rs);
    M.JSONStreamParse.mockReturnValue(parser);
    let dataCallCount = 0;
    (parser as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'data') setTimeout(() => cb({ name: 'event' }), 0);
      if (e === 'end') setTimeout(cb, 30);
    });
    (rs as any).on.mockImplementation((e: string, cb: Function) => {
      if (e === 'data') {
        setTimeout(() => { cb(Buffer.from('{"traceEvents":[]}')); dataCallCount++; }, 0);
        setTimeout(() => { cb(Buffer.from(' more data')); }, 5);
      }
      if (e === 'end') setTimeout(cb, 20);
    });
    const result = await readSwimlaneFileStream('/test/swim.json', false);
    expect(result).toBeDefined();
  });

  it('Fake Core event where existing line exceeds maxEnd (tryPlaceInExistingLine continue)', async () => {
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 4, tid: 1, args: { name: 'Fake Core 0' } },
      { ph: 'X', name: 'bigTask', pid: 4, tid: 1, ts: 100, dur: 1000, args: {}, originalIndex: 0 },
      { ph: 'X', name: 'smallTask', pid: 4, tid: 1, ts: 100, dur: 10, args: {}, originalIndex: 1 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, {}, {});
    expect(result.errMsg).toBeUndefined();
  });

  it('calculateDependenciesBytopo throws with invalid task2topo (no successors)', async () => {
    const task2topo = { '1-10': { leafIndex: '0' } };
    const traceData = { traceEvents: [
      { ph: 'M', name: 'thread_name', pid: 1, tid: 1, args: { name: 'T1' } },
      { ph: 'X', name: 'task1', pid: 1, tid: 1, ts: 100, dur: 50, args: { seqNo: 1, taskId: 10 }, originalIndex: 0 },
    ] };
    const result = await parseSwimLaneInfo(traceData, {}, task2topo, {});
    expect(result.errMsg).toBeUndefined();
  });
});

describe('getSavedSwimDataFileStreamAll', () => {
  it('resolves with parsed object', async () => {
    M.mockFs.createReadStream.mockClear();
    M.mockFs.createReadStream.mockReturnValue(M.makeEmitter());
    const p = M.makeEmitter();
    M.streamChainChain.mockReturnValue(p);
    (p as any).on.mockImplementation((e: string, cb: Function) => { if (e === 'data') setTimeout(() => cb({ key: 'f1', value: 'v1' }), 0); if (e === 'end') setTimeout(cb, 10); });
    const result = await getSavedSwimDataFileStreamAll('/test/swim.json');
    expect(result.f1).toBe('v1');
  });

  it('rejects on error', async () => {
    M.mockFs.createReadStream.mockClear();
    M.mockFs.createReadStream.mockReturnValue(M.makeEmitter());
    const p = M.makeEmitter();
    M.streamChainChain.mockReturnValue(p);
    (p as any).on.mockImplementation((e: string, cb: Function) => { if (e === 'error') setTimeout(() => cb(new Error('parse error')), 0); });
    await expect(getSavedSwimDataFileStreamAll('/test/swim.json')).rejects.toThrow();
  });
});
