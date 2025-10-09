export function getTensorData(tensors: Array<Record<string, any>>, id: number) {
  if (Array.isArray(tensors)) {
    for (let i = 0; i < tensors.length; i++) {
      if (tensors[i].magic === id) {
        return tensors[i];
      }
    }
  }
}

export function getOperationData(operations: Array<Record<string, any>>, id: number) {
  return operations.find(op => op.opmagic == id);
}

export function toClipboard(text: string) {
  return new Promise((res, rej) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          res(true);
        })
        .catch(() => {
          rej(false);
        });
    } else {
      const textarea = document.createElement('textarea');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.top = '10px';
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy', true);
      document.body.removeChild(textarea);
      res(true);
    }
  });
}
