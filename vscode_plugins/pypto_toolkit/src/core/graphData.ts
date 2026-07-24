/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { createReadStream } from 'fs';
const { parser } = require('stream-json');
const { streamValues } = require('stream-json/streamers/StreamValues');
import * as fs from 'fs/promises';

import { SQLiteCache, getMTime } from './sqliteCache';
const DATA_LENGTH_LIMIT = 62000000;
import { getComGraphFuncDataStore, getComGraphFileHashMapStore, getComGraphFileCalleeOpAttrStore } from './sqlInit';

export interface AbstractGraphData {
  fsPath: string;
  funcHash?: string;
  isUsedDB: boolean;
  dataMap: Record<string, string>;
  funcHashMap: Record<string, any>;
  calleeOpMagic?: string;
  calleeOpSubgraphId?: string;
  outputDirPath?: string;
  pathName?: string;
  calleeOpAttrMap: Record<string, string>;
  curPath?: string;
  magicName?: string;
  firstExecFuncHash?: string;
  readFileAndSetCache(fsPath: string): Promise<void>;
  getCompleteData(fsPath: string): Promise<any>;
}

export abstract class GraphData {
  funcHashMap: Record<string, any> = {};
  dataMap: Record<string, string> = {};
  callHashArrMap: Record<string, string> = {};
  calleeOpAttrMap: Record<string, string> = {};
  isUsedDB = false;
  version?: string;

  /** 外部可 await 的“写入+提交”完成信号 */
  public writeDone!: Promise<void>;

  constructor(
    public fsPath: string,
    public funcHash: string | undefined,
    public calleeOpMagic?: string,
    public calleeOpSubgraphId?: string,
    public outputDirPath?: string,
    public pathName?: string,
    public curPath?: string,
    public magicName?: string,
    public parentInfo?: any,
    public firstExecFuncHash?: string,
  ) { }

  // 读取json文件并存入缓存 并返回大小文件判断
  async readFileAndSetCache(fsPath: string): Promise<void> {
    const { size } = await fs.stat(fsPath);

    // 策略：小文件用 JSON.parse（快），大文件用流（防崩）
    if (size < 200 * 1024 * 1024) { // < 200MB
      const buffer = await fs.readFile(fsPath);
      const value = JSON.parse(buffer.toString());
      if (value?.functions) {
        await this.processFunctions(fsPath, value);
      }
    } else {
      // 超大文件走流式（防止内存爆炸）
      await this.readWithStream(fsPath);
    }
  }

  private async readWithStream(fsPath: string): Promise<void> {
    const fileStream = createReadStream(fsPath);
    const jsonParser = parser();
    const valuesStreamer = streamValues();
    // 错误统一收集
    let streamError: Error | null = null;

    fileStream.on('error', (err) => streamError = Object.assign(err, { code: 'FILE_READ_ERROR' }));
    jsonParser.on('error', (err) => streamError = Object.assign(err, { code: 'JSON_PARSE_ERROR' }));
    valuesStreamer.on('error', (err) => streamError = Object.assign(err, { code: 'STREAM_PROCESSING_ERROR' }));

    try {
      const pipelineStream = fileStream.pipe(jsonParser).pipe(valuesStreamer);
      for await (const ele of pipelineStream) {
        if (streamError) throw streamError; // 检查是否有流错误
        const value = ele.value;
        if (value?.functions) {
          await this.processFunctions(fsPath, value);
        }
      }
    } catch (error) {
      // 优先返回流错误，否则返回当前错误
      throw streamError || error;
    }
  }

  async getCompleteData(fsPath) {
    const fileStream = createReadStream(fsPath);
    const pipeline = fileStream.pipe(parser()).pipe(streamValues());
    let result: any;

    return await new Promise((resolve, reject) => {
      pipeline
        .on('data', async (ele) => {
          // 处理数据
          const value = ele.value;
          if (!value.functions) return;
          result = value;
        })
        .on('end', () => {
          resolve(result);
        })
        .on('error', (err) => {
          // 错误处理
          reject(err);
        });
    });
  }

  private buildFuncHashMap(functions: any[]): void {
    let findExecFunc = true;
    for (const funcItem of functions) {
      const hash = String(funcItem.hash);
      this.funcHashMap[hash] = {
        functype: funcItem.functype || null,
        func_magicname: funcItem.func_magicname || null,
        graphtype: funcItem.graphtype ?? null,
      };
      if (findExecFunc && funcItem.graphtype?.toString() === '2' && funcItem.semantic_label?.[0] !== '') {
        this.firstExecFuncHash = hash;
        findExecFunc = false;
      }
    }
  }

  private processOperations(funcItem: any, sqlJobs: (() => Promise<void>)[]): string[] {
    const callHashArr: string[] = [];
    const seen = new Set<string>;
    for (const op of funcItem.operations) {
      if (seen.has(op.opmagic)) {
        throw Object.assign(
          new Error(`Validation failed: OpMagic (${op.opmagic}) duplicated.`),
          { code: 'DATA_VALIDATION_OP_MAGIC_ERROR' }
        );
      }
      seen.add(op.opmagic);
      if (!op.calleehash) continue;
      callHashArr.push(String(op.calleehash));
      if (Array.isArray(op.attr) && op.attr.length > 0) {
        op.attr[0] = op.calleehash;
      }
      op.functype = this.funcHashMap[op.calleehash]?.functype;
      op.func_magicname = this.funcHashMap[op.calleehash]?.func_magicname;
      if (!op.opmagic.toString()) continue;
      if (this.isUsedDB) {
        const ioperands = [...new Set(op.ioperands)];
        sqlJobs.push(() =>
          getComGraphFileCalleeOpAttrStore().set({
            calleehash: op.calleehash,
            opMagic: op.opmagic,
            opSubgraphid: op.subgraphid.toString(),
            opAttr: JSON.stringify(op.attr),
            ioperands: JSON.stringify(ioperands)
          })
        );
      } else {
        this.calleeOpAttrMap[op.calleehash + '_' + op.opmagic + '_' + op.subgraphid] = op.attr.toString();
      }
    }
    return callHashArr;
  }

  private async processFunctions(fsPath: string, value: any): Promise<void> {
    try {
      const sqlJobs: (() => Promise<void>)[] = [];
      this.buildFuncHashMap(value.functions);
      if (this.isUsedDB) {
        sqlJobs.push(() => getComGraphFileHashMapStore().set({ filePath: fsPath, data: JSON.stringify(this.funcHashMap) }));
      }
      const lastChangeTime = await getMTime(fsPath);
      this.version = value.version;

      for (const funcItem of value.functions) {
        const callHashArr = this.processOperations(funcItem, sqlJobs);
        const data = JSON.stringify(funcItem);
        if (!this.isUsedDB) {
          this.dataMap[funcItem.hash] = data;
          this.callHashArrMap[funcItem.hash] = callHashArr.toString();
          return;
        }
        sqlJobs.push(() =>
          getComGraphFuncDataStore().set({ filePath: fsPath, funcHash: String(funcItem.hash), lastChangeTime: lastChangeTime, callHashArr: callHashArr.toString(), data: data, firstEntryHash: this.firstExecFuncHash || '' }),
        );
      }
      if (sqlJobs.length) {
        await Promise.all(sqlJobs.map((fn) => fn()));
      }
    } catch (err: any) {
      if (err.code === 'DATA_VALIDATION_OP_MAGIC_ERROR') {
        throw err;
      }
      if (this.isUsedDB) {
        console.warn('[DB] 数据库操作失败，自动降级 >>>', err);
        this.isUsedDB = false;
        return await this.processFunctions(fsPath, value);
      } else {
        console.error('纯内存操作失败，数据可能有误', err);
        throw Object.assign(new Error(), { code: 'PURE_MEMORY' });
      }
    }
  }

  static async getEntryHash(fsPath: string): Promise<EntryInfo> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(fsPath, { encoding: 'utf8' });
      let buffer = '';
      let result: EntryInfo = {};
      let foundCount = 0;
      const needed = 1;

      const tryExtract = (text: string) => {
        // 只在还没找到时才匹配
        if (result.entryhash === undefined) {
          const matchHash = text.match(/"entryhash"\s*:\s*"([^"]*)"/);
          if (matchHash) {
            result.entryhash = matchHash[1];
            foundCount++;
          }
        }
        if (foundCount >= needed) {
          stream.destroy();
          resolve(result);
        }
      };

      stream.on('data', (chunk: string | Buffer) => {
        buffer += chunk;
        // 尽快尝试匹配（避免 buffer 过大）
        tryExtract(buffer);
        // 可选：如果 buffer 太大且还没找到，保留最后 200 字符防跨 chunk
        if (buffer.length > 1000 && foundCount === 0) {
          buffer = buffer.slice(-200);
        }
      });

      stream.on('end', () => {
        // 最后一次尝试（以防字段在末尾）
        tryExtract(buffer);
        resolve(result);
      });

      stream.on('error', (err) => {
        reject(Object.assign(err, { code: 'FILE_READ_ERROR' }));
      });
    });
  }
}

interface EntryInfo {
  entryhash?: string;
}

export class SingleGraphData extends GraphData {
  // 目前没有任何额外字段/逻辑，只是“能实例化”
}

export class DiffGraphData extends GraphData {
  // 目前没有任何额外字段/逻辑，只是“能实例化”
}
