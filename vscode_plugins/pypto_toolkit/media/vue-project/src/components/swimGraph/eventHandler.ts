export const globalKeyEvent = (e, globalMousePosition, layout, eventType) => {
  const activeElement = document.activeElement;
  if (activeElement.nodeName === 'INPUT') {
    return;
  }

  const mouseX = globalMousePosition.x;
  const isMouseInSwimlane = mouseX >= layout.processLabelWidth;
  
  if (isMouseInSwimlane) {
    const firstProcessCanvas = document.querySelector('.events-canvas');
    if (firstProcessCanvas) {
      const targetRect = firstProcessCanvas.getBoundingClientRect();
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: mouseX,
        clientY: 10 + targetRect.top,
        bubbles: true,
        cancelable: true
      });
      firstProcessCanvas.dispatchEvent(mouseMoveEvent);
      const newEvent = new KeyboardEvent(eventType, {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        bubbles: true,
        cancelable: true
      });
      firstProcessCanvas.dispatchEvent(newEvent);
      if (eventType === 'keyup') {
          const mouseLeaveEvent = new MouseEvent('mouseleave', {
          bubbles: true,
          cancelable: true
        });
        
        firstProcessCanvas.dispatchEvent(mouseLeaveEvent);
      }
    }
  }
}

