import { type DirectiveBinding, computed, nextTick, watch } from 'vue';

interface SortableProps {
  list: Array<Record<string, any>>;
  handle: string;
  drop: (e: any) => void;
}

function matches(element: HTMLElement, selector: string): boolean {
  const proto: any = Element.prototype;

  const func =
    proto.matchesSelector ||
    proto.mozMatchesSelector ||
    proto.msMatchesSelector ||
    proto.oMatchesSelector ||
    proto.webkitMatchesSelector ||
    function (s: any) {
      const ctx: any = this;
      const matchesElements = (ctx.document || ctx.ownerDocument).querySelectorAll(s);
      let i = matchesElements.length;
      while (--i >= 0 && matchesElements.item(i) !== ctx) {}
      return i > -1;
    };

  return func.call(element, selector);
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding<SortableProps>): void {
    let sourceElement: HTMLElement;
    let sourceIndex: number;
    let targetIndex: number;
    let mouseoverElement: HTMLElement;
    let isDrop: boolean;
    const { list, handle, drop } = binding.value;
    const sliceList = computed(() => list.slice());

    const canDrag = (): boolean => {
      if (handle) {
        const handleSelector = handle;
        let element = mouseoverElement;
        while (element !== el) {
          if (matches(element, handleSelector)) {
            return true;
          }
          element = element.parentNode as HTMLElement;
        }
        return false;
      }
      return true;
    };

    const getCurrentTarget = (event: DragEvent): number => {
      let index = -1;
      let element: any = event.target;
      while (element !== el) {
        if (element.parentNode === el) {
          index = Array.from(el.children).indexOf(element);
        }
        element = element.parentNode;
      }
      return index;
    };

    const initDrag = () => {
      Array.from(el.children).forEach((element: any) => {
        let dragDom = null;
        dragDom = element;
        dragDom.setAttribute('draggable', 'true');
        dragDom.addEventListener('dragstart', (event: DragEvent) => {
          if (canDrag()) {
            isDrop = false;
            sourceElement = element;
            sourceIndex = Array.from(el.children).indexOf(sourceElement);
          } else {
            event.preventDefault();
            event.stopPropagation();
          }
        });
      });
    };

    watch(
      sliceList,
      () => {
        nextTick(initDrag);
      },
      { immediate: true },
    );

    el.addEventListener('mouseover', (event: MouseEvent) => {
      mouseoverElement = event.target as HTMLElement;
    });

    el.addEventListener('dragover', (event: DragEvent) => {
      const currentIndex = Array.from(el.children).indexOf(sourceElement);
      const toIndex = getCurrentTarget(event);

      if (currentIndex !== -1 && toIndex !== -1) {
        if (currentIndex > toIndex) {
          el.removeChild(sourceElement);
          el.insertBefore(sourceElement, el.children[toIndex]);
          targetIndex = toIndex;
        } else if (currentIndex < toIndex) {
          el.removeChild(sourceElement);
          if (el.children[toIndex]) {
            el.insertBefore(sourceElement, el.children[toIndex]);
            targetIndex = toIndex;
          } else {
            el.appendChild(sourceElement);
            targetIndex = el.children.length - 1;
          }
        }
      }
      event.preventDefault();
    });

    el.addEventListener('drop', () => {
      isDrop = true;
      if (targetIndex !== -1) {
        drop({ targetIndex, sourceIndex });
      }
    });

    el.addEventListener('dragend', () => {
      if (!isDrop) {
        if (sourceIndex !== -1 && targetIndex !== -1) {
          if (targetIndex > sourceIndex) {
            el.removeChild(sourceElement);
            el.insertBefore(sourceElement, el.children[sourceIndex]);
          } else if (sourceIndex > targetIndex) {
            el.removeChild(sourceElement);
            if (el.children[sourceIndex]) {
              el.insertBefore(sourceElement, el.children[sourceIndex]);
            } else {
              el.appendChild(sourceElement);
            }
          }
        }
      }
      sourceIndex = -1;
      targetIndex = -1;
    });
  },
};
