/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
