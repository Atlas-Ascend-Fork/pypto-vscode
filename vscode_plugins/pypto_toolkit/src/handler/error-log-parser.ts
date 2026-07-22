/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import { readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import type { OpError } from './handler-types';
import type { AbstractGraphData } from '../core/graphData';

/**
 * 在指定目录中查找同名文件（不递归子目录）。
 */
export function findFileHere(dir: string, name: string): string | null {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === name) {
      return join(dir, entry.name);
    }
  }
  return null;
}

/**
 * 从错误列表中收集与目标函数关联的 OpMagic。
 * 同时将错误记录通过 server.setRef 发送给前端。
 */
export async function collectOpMagic(
  server: any,
  errlist: OpError[],
  targetFuncMagic: number,
): Promise<Set<number>> {
  const magics = new Set<number>();
  const records: { magic: number; error: string }[] = [];
  for (const { FuncMagic, OpMagic, error } of errlist) {
    if (OpMagic === null) continue;
    if (FuncMagic === null || FuncMagic === targetFuncMagic) {
      magics.add(OpMagic);
      records.push({ magic: OpMagic, error });
    }
  }
  server.setRef('nodeErrorList', { data: records });
  return magics;
}

/**
 * 根据图数据文件路径，查找对应的 .log 文件并提取错误栈。
 * 日志文件名推导规则：
 *   1. 若文件名含 PATH\d+_xxx 模式 → 截取前缀 + .log
 *   2. 否则 → 去掉前两个 _ 分隔段 + .log
 *   3. 去掉数字后缀得到 targetLog
 */
export async function getErrorMessage(gd: AbstractGraphData): Promise<any[]> {
  const dirName = dirname(gd.fsPath);
  const jsonFile = basename(gd.fsPath);
  let stacks: any[] = [];
  let key: any;

  const mpath = jsonFile.match(/PATH\d+_[^_]+/);
  if (mpath) {
    key = jsonFile.slice(0, jsonFile.indexOf(mpath[0]) + mpath[0].length)
      .replace(/^[^_]+_[^_]+_/, '').replace(/\.json$/, '') + '.log';
  } else {
    key = jsonFile.split('_').slice(2).join('_').replace(/\.json$/, '.log');
  }
  const targetLog = key.replace(/^([^_]*?)\d*_/, '$1');
  const logFile = findFileHere(dirName, targetLog);
  if (logFile) {
    stacks = await extractErrorBackTrace(logFile);
  }
  return stacks;
}

/**
 * 逐行读取日志文件，提取包含 [ERROR] 和 magic/opmagic 的行。
 */
export async function extractErrorBackTrace(logPath: string): Promise<OpError[]> {
  const errorLines: string[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(logPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  const magicRe = /\b(?:magic|opmagic):\s*\d+/i;
  for await (const line of rl) {
    if (line.includes('[ERROR]') && magicRe.test(line)) {
      errorLines.push(line.trim());
    }
  }
  return parseErrorLogs(errorLines);
}

/**
 * 将错误日志行解析为结构化的 OpError 对象。
 * 提取 FuncMagic、OpMagic 和错误文本。
 */
export async function parseErrorLogs(logs: string[]): Promise<OpError[]> {
  return logs.map(line => {
    const funcMatch = line.match(/FuncMagic:(\d+)/);
    const FuncMagic = funcMatch ? Number(funcMatch[1]) : null;
    const magicRe = /\b(?:magic|opmagic):\s*(\d+)/i;
    const m = line.match(magicRe);
    const OpMagic = m ? Number(m[1]) : null;
    const errorText = line
      .replace(/^.*\[ERROR\]:\s*(.*?)(?:\s*\[FuncMagic:\d+\]\[OpMagic:\d+\]\[Backtrace\].*)?$/, '$1')
      .trim();
    return { FuncMagic, OpMagic, error: errorText };
  });
}
