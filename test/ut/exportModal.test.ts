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
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EventBus from '../../media/vue-project/src/service/event-bus';

describe('export image result notifications', () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    [{ result: true, fileName: 'graph.png' }, 'success', 'imageExportSuccessInfo'],
    [{ result: false, message: 'write failed' }, 'error', 'write failed'],
  ])('shows the result without corrupting message listeners: %j', (result, type, text) => {
    vi.useFakeTimers();
    const sourcePath = process.env.EXPORT_MODAL_SOURCE ?? 'media/vue-project/src/components/exportModal/exportModal.vue';
    const source = readFileSync(sourcePath, 'utf8');
    const script = source.match(/<script setup>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toBeDefined();

    const bus = new EventBus();
    const listener = vi.fn();
    const message = vi.fn();
    const watchers = new Map<object, CallableFunction>();
    const refs: { value: unknown }[] = [];
    const server = {
      CheckSysResult: {},
      SaveDirPath: {},
      SaveFileResult: {},
      CheckFilePathResult: {},
    };
    bus.on('message_notice', listener);

    // Run the actual setup script with lightweight Vue and bridge doubles.
    // This exercises the real event bus but does not render a browser UI.
    runInNewContext(script!.replace(/^import .*;\s*$/gm, ''), {
      window: { ascEventBus: bus },
      ref: (value: unknown) => {
        const state = { value };
        refs.push(state);
        return state;
      },
      reactive: (value: unknown) => value,
      computed: (fn: () => unknown) => ({ get value() { return fn(); } }),
      watch: (key: object, callback: CallableFunction) => watchers.set(key, callback),
      onMounted: (callback: () => void) => callback(),
      useViewServer: () => ({ server }),
      useI18n: () => ({ t: (key: string) => key }),
      defineProps: () => ({ dataUrl: 'data:image/png;base64,AA==', fileName: 'graph' }),
      Message: message,
    });

    // The second ref is modalVisible; model an open export dialog.
    refs[1].value = true;
    watchers.get(server.SaveFileResult)!(result);
    expect(message).toHaveBeenCalledOnce();
    expect(message).toHaveBeenCalledWith({ type, message: text });
    expect(refs[1].value).toBe(!result.result);
    bus.emit('message_notice', 'next notification');
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('next notification');
  });
});
