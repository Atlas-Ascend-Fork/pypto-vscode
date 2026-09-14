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
export function useDragging(handleUpdate: (isEnd: boolean, offset: number) => void) {
  let startPosition = 0;
  let draggingAnimationId: number | null = null;

  function startDragging(event: MouseEvent) {
    const { clientY } = event;
    startPosition = clientY;

    window.addEventListener('mousemove', handleDragging);
    window.addEventListener('mouseup', stopDragging);
  }

  function stopDragging(event: MouseEvent) {
    // 停止未执行动画
    if (draggingAnimationId) {
      cancelAnimationFrame(draggingAnimationId);
    }

    window.removeEventListener('mousemove', handleDragging);
    window.removeEventListener('mouseup', stopDragging);
    const offsetY = getDraggingOffset(event.clientY);
    handleUpdate(true, offsetY);
  }

  function handleDragging(event: MouseEvent) {
    // 停止未执行动画
    if (draggingAnimationId) {
      cancelAnimationFrame(draggingAnimationId);
    }

    draggingAnimationId = requestAnimationFrame(() => {
      const offsetY = getDraggingOffset(event.clientY);
      handleUpdate(false, offsetY);
      draggingAnimationId = null;
    });
  }

  function getDraggingOffset(clientY: number): number {
    return clientY - startPosition;
  }

  return { startDragging };
}
