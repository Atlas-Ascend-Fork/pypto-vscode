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
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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

function handleDragOver(
  el: HTMLElement,
  sourceElement: HTMLElement,
  getCurrentTarget: (event: DragEvent) => number,
  event: DragEvent,
): { currentIndex: number; toIndex: number; targetIndex: number } {
  const currentIndex = Array.from(el.children).indexOf(sourceElement);
  const toIndex = getCurrentTarget(event);
  let targetIndex = -1;

  if (currentIndex === -1 || toIndex === -1) {
    return { currentIndex, toIndex, targetIndex };
  }

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

  return { currentIndex, toIndex, targetIndex };
}

function handleDragEnd(
  el: HTMLElement,
  sourceElement: HTMLElement,
  sourceIndex: number,
  targetIndex: number,
  isDrop: boolean,
): void {
  if (isDrop) {
    return;
  }

  if (sourceIndex === -1 || targetIndex === -1) {
    return;
  }

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

interface SortableState {
  sourceElement?: HTMLElement;
  sourceIndex: number;
  targetIndex: number;
  mouseoverElement?: HTMLElement;
  isDrop: boolean;
}

function canDrag(el: HTMLElement, mouseoverElement: HTMLElement | undefined, handle: string): boolean {
  if (!handle) {
    return true;
  }
  let element = mouseoverElement;
  while (element !== el) {
    if (matches(element, handle)) {
      return true;
    }
    element = element.parentNode as HTMLElement;
  }
  return false;
}

function getCurrentTargetIndex(el: HTMLElement, event: DragEvent): number {
  let index = -1;
  let element: any = event.target;
  while (element !== el) {
    if (element.parentNode === el) {
      index = Array.from(el.children).indexOf(element);
    }
    element = element.parentNode;
  }
  return index;
}

function initDrag(el: HTMLElement, handle: string, state: SortableState): void {
  Array.from(el.children).forEach((element: any) => {
    const dragDom = element;
    dragDom.setAttribute('draggable', 'true');
    dragDom.addEventListener('dragstart', (event: DragEvent) => {
      if (canDrag(el, state.mouseoverElement, handle)) {
        state.isDrop = false;
        state.sourceElement = element;
        state.sourceIndex = Array.from(el.children).indexOf(state.sourceElement);
      } else {
        event.preventDefault();
        event.stopPropagation();
      }
    });
  });
}

function bindSortEvents(el: HTMLElement, drop: (e: any) => void, state: SortableState): void {
  el.addEventListener('mouseover', (event: MouseEvent) => {
    state.mouseoverElement = event.target as HTMLElement;
  });

  el.addEventListener('dragover', (event: DragEvent) => {
    const result = handleDragOver(el, state.sourceElement, (e) => getCurrentTargetIndex(el, e), event);
    state.targetIndex = result.targetIndex;
    event.preventDefault();
  });

  el.addEventListener('drop', () => {
    state.isDrop = true;
    if (state.targetIndex !== -1) {
      drop({ targetIndex: state.targetIndex, sourceIndex: state.sourceIndex });
    }
  });

  el.addEventListener('dragend', () => {
    handleDragEnd(el, state.sourceElement, state.sourceIndex, state.targetIndex, state.isDrop);
    state.sourceIndex = -1;
    state.targetIndex = -1;
  });
}

export default {
  mounted(el: HTMLElement, binding: DirectiveBinding<SortableProps>): void {
    const { list, handle, drop } = binding.value;
    const sliceList = computed(() => list.slice());
    const state: SortableState = {
      sourceIndex: -1,
      targetIndex: -1,
      isDrop: false,
    };

    watch(
      sliceList,
      () => {
        nextTick(() => initDrag(el, handle, state));
      },
      { immediate: true },
    );

    bindSortEvents(el, drop, state);
  },
};
