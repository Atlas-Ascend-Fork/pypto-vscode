import { watch, onBeforeUnmount, ref } from 'vue';

export function useClickOutside(props: any, emits: any, ignoreId?: string) {
  const drawerEl = ref();

  const onClickOutside = (e: MouseEvent) => {
    const composedPath = e.composedPath();
    if (ignoreId && composedPath.some((item) => item.id === ignoreId)) {
      return;
    }
    if (!composedPath.includes(drawerEl.value)) {
      emits('update:modelValue', false);
    }
  };

  watch(
    () => props.modelValue,
    (val) => {
      if (val) {
        setTimeout(() => {
          document.documentElement.addEventListener('click', onClickOutside);
        });
      } else {
        document.documentElement.removeEventListener('click', onClickOutside);
      }
    },
  );

  onBeforeUnmount(() => {
    document.documentElement.removeEventListener('click', onClickOutside);
  });

  return { drawerEl };
}
