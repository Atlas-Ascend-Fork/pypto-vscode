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
