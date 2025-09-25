import { ref, reactive, watch, onBeforeUnmount } from 'vue';

export function useMoveable(props: Record<string, any>) {
  const rootEl = ref<HTMLElement>();
  const dragEl = ref<HTMLElement>();
  const styles = reactive({
    left: '0px',
    top: '56px',
  });
  let ModalWidth = 240;
  const OffsetRight = 96;
  let dragging = false;
  let topStart = 0;
  let leftStart = 0;
  let userSelectCache = '';
  let dragLeftRange: number[] = [];
  let dragTopRange: number[] = [];

  const onMousemove = (e: MouseEvent) => {
    if (dragging && rootEl.value) {
      e.stopPropagation();
      e.preventDefault();
      let currentTop = e.clientY - topStart;
      let currentLeft = e.clientX - leftStart;
      currentTop = Math.min(dragTopRange[1], Math.max(currentTop, dragTopRange[0]));
      currentLeft = Math.min(dragLeftRange[1], Math.max(currentLeft, dragLeftRange[0]));
      styles.top = `${currentTop}px`;
      styles.left = `${currentLeft}px`;
    }
  };

  const onMouseup = () => {
    dragging = false;
    document.body.style.userSelect = userSelectCache;
    document.removeEventListener('mouseup', onMouseup);
    document.removeEventListener('mousemove', onMousemove);
  };

  const onMousedown = (e: MouseEvent) => {
    if (e.button === 2 || !rootEl.value) {
      return;
    }
    dragging = true;
    const { width, height } = rootEl.value.getBoundingClientRect();
    topStart = e.clientY - Number(rootEl.value.style.top.replace('px', ''));
    leftStart = e.clientX - Number(rootEl.value.style.left.replace('px', ''));
    dragLeftRange = [0, window.innerWidth - width];
    dragTopRange = [0, window.innerHeight - height];

    userSelectCache = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.addEventListener('mouseup', onMouseup);
    document.addEventListener('mousemove', onMousemove);
  };

  function updatePosition() {
    const left = Math.max(window.innerWidth - ModalWidth - OffsetRight, 0);
    if (left < parseInt(styles.left)) {
      styles.left = `${left}px`;
    }
  }

  watch(
    dragEl,
    () => {
      if (dragEl.value) {
        dragEl.value.addEventListener('mousedown', onMousedown);
      }
    },
    { immediate: true },
  );

  watch(
    () => props.modelValue,
    (val) => {
      if (val) {
        styles.left = `${window.innerWidth - ModalWidth - OffsetRight}px`;
        styles.top = '56px';
      }
    },
  );

  watch(
    rootEl,
    () => {
      if (rootEl.value) {
        ModalWidth = rootEl.value.offsetWidth;
      }
    },
    { immediate: true },
  );

  window.addEventListener('resize', updatePosition);

  onBeforeUnmount(() => {
    dragEl.value?.removeEventListener('mousedown', onMousedown);
    window.removeEventListener('resize', updatePosition);
  });

  return { dragEl, rootEl, styles };
}
