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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export interface VcdSignal {
  id: string;
  name: string;
  width: number;
  type: string;
  scope: string;
}

export interface VcdScopeNode {
  name: string;
  type: string;
  children: VcdScopeNode[];
  signals: string[];
}

export interface VcdMetadata {
  timescale: string;
  date: string;
  version: string;
  signals: VcdSignal[];
  signalTree: VcdScopeNode[];
  timeRange: { start: number; end: number };
  signalCount: number;
  changeCount: number;
}

export interface VcdParsedData extends VcdMetadata {
  changes: Map<string, [number, string][]>;
}

export interface VcdChangeChunk {
  type: 'meta' | 'changes';
  signalId?: string;
  data?: [number, string][];
  meta?: VcdMetadata;
}

interface ScopeFrame {
  node: VcdScopeNode;
  path: string;
}

export function parseVcdStream(filePath: string): Promise<VcdParsedData> {
  return new Promise((resolve, reject) => {
    const signals: VcdSignal[] = [];
    const signalMap = new Map<string, VcdSignal>();
    const changes = new Map<string, [number, string][]>();
    const rootScopes: VcdScopeNode[] = [];
    const scopeStack: ScopeFrame[] = [];

    let timescale = '';
    let date = '';
    let version = '';
    let currentTime = 0;
    let minTime = Infinity;
    let maxTime = -Infinity;
    let totalChanges = 0;
    let inDumpvars = false;
    let pendingKeyword = '';
    let pendingText = '';

    const rl = createInterface({
      input: createReadStream(filePath, { encoding: 'utf8', highWaterMark: 256 * 1024 }),
      crlfDelay: Infinity,
    });

    rl.on('line', (rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      if (pendingKeyword) {
        if (line.includes('$end')) {
          const idx = line.indexOf('$end');
          pendingText += ' ' + line.substring(0, idx).trim();
          processKeyword(pendingKeyword, pendingText.trim());
          pendingKeyword = '';
          pendingText = '';
        } else {
          pendingText += ' ' + line;
        }
        return;
      }

      if (inDumpvars) {
        if (line.startsWith('$end')) {
          inDumpvars = false;
          return;
        }
        processValueChange(line, 0);
        return;
      }

      if (line.startsWith('$date') || line.startsWith('$version') ||
          line.startsWith('$timescale') || line.startsWith('$scope') ||
          line.startsWith('$var') || line.startsWith('$comment')) {
        const keyword = line.split(/\s/)[0];
        if (line.includes('$end')) {
          const idx = line.indexOf('$end');
          const text = line.substring(keyword.length, idx).trim();
          processKeyword(keyword, text);
        } else {
          pendingKeyword = keyword;
          pendingText = line.substring(keyword.length);
        }
        return;
      }

      if (line.startsWith('$upscope')) {
        scopeStack.pop();
        return;
      }
      if (line.startsWith('$enddefinitions')) {
        return;
      }
      if (line.startsWith('$dumpvars')) {
        inDumpvars = true;
        return;
      }
      if (line.startsWith('#')) {
        currentTime = parseInt(line.substring(1), 10);
        if (currentTime < minTime) minTime = currentTime;
        if (currentTime > maxTime) maxTime = currentTime;
        return;
      }
      if (!line.startsWith('$')) {
        processValueChange(line, currentTime);
      }
    });

    function resolveScopePath(
      children: VcdScopeNode[],
      segments: string[],
      basePath: string,
      type: string,
    ): { node: VcdScopeNode; path: string } {
      let curChildren = children;
      let path = basePath;
      let node: VcdScopeNode | undefined;
      for (const seg of segments) {
        node = curChildren.find((child) => child.name === seg);
        if (!node) {
          node = { name: seg, type, children: [], signals: [] };
          curChildren.push(node);
        }
        path = path ? `${path}.${seg}` : seg;
        curChildren = node.children;
      }
      return { node: node as VcdScopeNode, path };
    }

    function processKeyword(keyword: string, text: string) {
      switch (keyword) {
        case '$date': date = text; break;
        case '$version': version = text; break;
        case '$timescale': timescale = text; break;
        case '$scope': {
          const parts = text.split(/\s+/);
          const scopeType = parts[0] || 'module';
          const rawName = parts[1] || 'unnamed';
          const segments = rawName.startsWith('\\')
            ? [rawName.slice(1)]
            : rawName.split('.').filter((s) => s.length > 0);
          if (segments.length === 0) segments.push('unnamed');
          const parent = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null;
          const resolved = resolveScopePath(
            parent ? parent.node.children : rootScopes,
            segments,
            parent ? parent.path : '',
            scopeType,
          );
          scopeStack.push({ node: resolved.node, path: resolved.path });
          break;
        }
        case '$var': {
          const parts = text.split(/\s+/);
          const varType = parts[0] || 'wire';
          const width = parseInt(parts[1], 10) || 1;
          const id = parts[2];
          let name = parts.slice(3).join(' ') || id;
          const parent = scopeStack.length > 0 ? scopeStack[scopeStack.length - 1] : null;
          const basePath = parent ? parent.path : '';
          let scope = basePath;
          let leafHost: VcdScopeNode | null = parent ? parent.node : null;
          if (name.startsWith('\\')) {
            name = name.slice(1);
          } else if (name.includes('.')) {
            const segments = name.split('.').filter((s) => s.length > 0);
            if (segments.length > 1) {
              const resolved = resolveScopePath(
                parent ? parent.node.children : rootScopes,
                segments.slice(0, -1),
                basePath,
                'module',
              );
              name = segments[segments.length - 1];
              scope = resolved.path;
              leafHost = resolved.node;
            }
          }
          const signal: VcdSignal = { id, name, width, type: varType, scope };
          signals.push(signal);
          signalMap.set(id, signal);
          changes.set(id, []);
          if (leafHost) {
            leafHost.signals.push(id);
          }
          break;
        }
      }
    }

    function processValueChange(line: string, time: number) {
      let id: string;
      let value: string;
      if (line[0] === 'b' || line[0] === 'B' || line[0] === 'r' || line[0] === 'R') {
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx === -1) return;
        value = line.substring(1, spaceIdx);
        id = line.substring(spaceIdx + 1).trim();
      } else {
        value = line[0];
        id = line.substring(1).trim();
      }
      const arr = changes.get(id);
      if (arr) {
        arr.push([time, value]);
        totalChanges++;
        if (time < minTime) minTime = time;
        if (time > maxTime) maxTime = time;
      }
    }

    rl.on('close', () => {
      if (minTime === Infinity) minTime = 0;
      if (maxTime === -Infinity) maxTime = 0;
      const meta: VcdMetadata = {
        timescale, date, version, signals,
        signalTree: rootScopes,
        timeRange: { start: minTime, end: maxTime },
        signalCount: signals.length,
        changeCount: totalChanges,
      };
      resolve({ ...meta, changes });
    });

    rl.on('error', reject);
  });
}

export function getSignalChangesInRange(
  changes: Map<string, [number, string][]>,
  signalIds: string[],
  startTime: number,
  endTime: number,
): { signalId: string; data: [number, string][] }[] {
  const result: { signalId: string; data: [number, string][] }[] = [];
  for (const id of signalIds) {
    const arr = changes.get(id);
    if (!arr) continue;
    const lo = lowerBound(arr, startTime);
    const hi = upperBound(arr, endTime);
    const startIdx = lo > 0 ? lo - 1 : 0;
    result.push({ signalId: id, data: arr.slice(startIdx, hi) });
  }
  return result;
}

export function buildChangeChunks(parsed: VcdParsedData, chunkSize = 5000): VcdChangeChunk[] {
  const chunks: VcdChangeChunk[] = [];
  const meta: VcdMetadata = {
    timescale: parsed.timescale,
    date: parsed.date,
    version: parsed.version,
    signals: parsed.signals,
    signalTree: parsed.signalTree,
    timeRange: parsed.timeRange,
    signalCount: parsed.signalCount,
    changeCount: parsed.changeCount,
  };
  chunks.push({ type: 'meta', meta });

  for (const [signalId, arr] of parsed.changes) {
    for (let i = 0; i < arr.length; i += chunkSize) {
      chunks.push({ type: 'changes', signalId, data: arr.slice(i, i + chunkSize) });
    }
  }
  return chunks;
}

export function lowerBound(arr: [number, string][], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid][0] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function upperBound(arr: [number, string][], target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid][0] <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
