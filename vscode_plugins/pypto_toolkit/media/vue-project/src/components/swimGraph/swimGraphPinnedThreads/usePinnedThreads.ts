import { reactive, computed } from 'vue';
import { pushState, pullState } from '../../../core/state';

export function usePinnedThreads(processes) {
  // 置顶线程状态
  const pinnedThreads = reactive(new Map());

  const pinnedThreadsList = computed(() => {
    return Array.from(pinnedThreads.entries()).map(([key, value]) => ({
      id: key,
      ...value
    }));
  });

  // 保存置顶状态到 vscode state
  const savePinnedState = () => {
    const pinnedState = Array.from(pinnedThreads.entries()).map(([key, value]) => ({
      processKey: value.processKey,
      threadKey: value.threadKey
    }));
    pushState({ pinnedThreads: pinnedState });
  };

  // 从 vscode state 恢复置顶状态
  const restorePinnedState = () => {
    const state = pullState();
    if (state && state.pinnedThreads && Array.isArray(state.pinnedThreads)) {
      state.pinnedThreads.forEach(pinned => {
        const process = processes.get(pinned.processKey);
        if (process) {
          const thread = process.threads.get(pinned.threadKey);
          if (thread) {
            const key = `${pinned.processKey}-${pinned.threadKey}`;
            pinnedThreads.set(key, {
              processKey: pinned.processKey,
              threadKey: pinned.threadKey,
              thread,
              process
            });
            thread.isPinned = true;
          }
        }
      });
    }
  };

  // 置顶线程
  const pinThread = (processKey, threadKey, offsetY) => {
    const process = processes.get(processKey);
    if (!process) return;
    
    const thread = process.threads.get(threadKey);
    if (!thread) return;
    
    const key = `${processKey}-${threadKey}`;
    pinnedThreads.set(key, {
      processKey,
      threadKey,
      thread,
      process
    });
    
    // 标记线程为置顶状态
    thread.isPinned = true;
    thread.offsetY = offsetY;
    
    // 保存状态
    savePinnedState();
  };

  // 取消置顶
  const unpinThread = (processKey, threadKey) => {
    const key = `${processKey}-${threadKey}`;
    const pinnedData = pinnedThreads.get(key);
    if (pinnedData) {
      pinnedData.thread.isPinned = false;
      delete pinnedData.thread.offsetY;
    }
    pinnedThreads.delete(key);
    
    // 保存状态
    savePinnedState();
  };

  return {
    pinnedThreads,
    pinnedThreadsList,
    pinThread,
    unpinThread,
    restorePinnedState
  };
}
