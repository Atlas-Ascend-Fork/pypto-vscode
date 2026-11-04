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
import { onBeforeUnmount, onMounted } from 'vue';
import { useViewServer } from '../../../core/use-view-server';
import type { ThreeColumnServer } from 'ext:/view/servers/three-column-server';

type LockSource = 'py' | 'cce' | 'swim' | 'com';
interface LockInput {
  opmagic?: number;
  hash?: string;
  leafHash?: string;
  file?: string;
  line?: number;
}

/** py 行反查出的 op 落点（供计算图列下钻 + 精确选中） */
export interface OpSelection {
  leafHash: string;
  opmagic: string;
  subgraphid: number;
  label: string | null;
  pyFile: string | null;
  pyLine: number | null;
}

export interface GraphLinkageCallbacks {
  applyOpsSelection: (ops: OpSelection[], opts: { stable: boolean; label?: string }) => void;
}

/**
 * 计算图列的四联动点击/悬停锁定通道：图列作为中枢，消费 py/CCE/泳道的点击，
 * 经 server 反查后广播 activeLockFromCom，并回调 simpleComGraph 下钻 + 选中 op。
 */
export function useFourColumnGraphLinkage(callbacks: GraphLinkageCallbacks) {
  const { server } = useViewServer<ThreeColumnServer>();

  async function emitLock(source: LockSource, input: LockInput): Promise<void> {
    const res = await server.resolveActiveLock(input);
    if (res) {
      (window as any).ascEventBus.emit('activeLockFromCom', { source, ...res });
    }
  }

  // 计算图自身点击：leaf op → {leafHash, opMagic}；ROOT 层 CALL 节点只给被调 leafHash（服务端取该 leaf 首个 op）
  async function emitComLock(leafHash: string, opMagic?: number): Promise<void> {
    await emitLock('com', opMagic == null ? { hash: leafHash } : { hash: leafHash, opmagic: opMagic });
  }

  // 上一/下一 op 切换
  async function stepOp(leafHash: string, opMagic: number, direction: -1 | 1): Promise<void> {
    const next = await server.stepOp({ leafHash, opMagic, direction });
    if (next != null) {
      await emitComLock(leafHash, next);
    }
  }

  // 代码行 → 计算图：py 行反查 op 落点，交给 simpleComGraph 下钻 + 选中，
  // 并按文档第 2/3 条分别产出 returnOpsFromCom{source:'py'}（悬停）与 activeLockFromCom{source:'py'}（点击）。
  async function handlePyLine(
    file: string | undefined,
    line: number | undefined,
    stable: boolean,
    label?: string,
  ): Promise<void> {
    if (!file || !line) {
      if (!stable) {
        callbacks.applyOpsSelection([], { stable: false });
        (window as any).ascEventBus.emit('returnOpsFromCom', { source: 'py', hash: '', ops: [] });
      }
      return;
    }
    const res = await server.resolveOpsFromPyLine({ file, line });
    const ops = res?.ops ?? [];
    callbacks.applyOpsSelection(ops, { stable, label });
    if (stable) {
      // 复用已解析的首个 op，避免 resolveActiveLock 再查一次同一行（两次查询无 ORDER BY，
      // 顺序分叉会导致「图高亮 op A、其它栏锁定 op B」）
      const first = ops[0];
      await emitLock('py', first ? { hash: first.leafHash, opmagic: Number(first.opmagic) } : { file, line });
    } else {
      // 文档第 2 条：returnOpsFromCom{source:'py'} 只带「第一个 leaf」的 hash + 该 leaf 下全部 opmagic
      const first = ops[0];
      const leafHash = first?.leafHash ?? '';
      (window as any).ascEventBus.emit('returnOpsFromCom', {
        source: 'py',
        hash: leafHash,
        ops: leafHash ? ops.filter((o) => o.leafHash === leafHash).map((o) => Number(o.opmagic)) : [],
      });
    }
  }

  const onLockFromPy = (args: { label?: string; file?: string; line?: number }) => {
    void handlePyLine(args?.file, args?.line, true, args?.label);
  };
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  const onHoverFromPy = (args: { file?: string; line?: number }) => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
    }
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      void handlePyLine(args?.file, args?.line, false);
    }, 200);
  };
  const onLockFromCce = (args: { opmagic?: number; hash?: string }) => {
    void emitLock('cce', { opmagic: args?.opmagic, hash: args?.hash });
  };
  const onLockFromSwim = (args: { opmagic?: number; leafHash?: string }) => {
    void emitLock('swim', { opmagic: args?.opmagic, leafHash: args?.leafHash });
  };

  onMounted(() => {
    (window as any).ascEventBus.on('activeLockFromPy', onLockFromPy);
    (window as any).ascEventBus.on('returnFileLineFromCode', onHoverFromPy);
    (window as any).ascEventBus.on('activeLockFromCce', onLockFromCce);
    (window as any).ascEventBus.on('activeLockFromSwim', onLockFromSwim);
  });
  onBeforeUnmount(() => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    (window as any).ascEventBus.remove('activeLockFromPy', onLockFromPy);
    (window as any).ascEventBus.remove('returnFileLineFromCode', onHoverFromPy);
    (window as any).ascEventBus.remove('activeLockFromCce', onLockFromCce);
    (window as any).ascEventBus.remove('activeLockFromSwim', onLockFromSwim);
  });

  return { emitComLock, stepOp };
}