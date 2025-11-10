import { computed, ref, watch } from 'vue';
import { comGraphStore } from '../../../service/com-graph-store';
import { extractFuncMap } from '../../../utils/search';

export function useNavbar() {
  const funcMap = ref({});
  const curPath = ref([]);
  const comGraphName = computed(() => {
    if (curPath.value.length) {
      return funcMap.value[curPath.value[curPath.value.length - 1]]?.func_magicname ?? '';
    }
    return '';
  });

  watch(
    () => comGraphStore.data.calleeMap,
    (val) => {
      if (Object.keys(val).length === 0) {
        return;
      }
      funcMap.value = extractFuncMap(val);
    },
    { immediate: true },
  );

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.command == 'returnFuncTree') {
      curPath.value = typeof message.curPath === 'string' ? JSON.parse(message.curPath) : message.curPath;
    }
  });

  return { comGraphName };
}
