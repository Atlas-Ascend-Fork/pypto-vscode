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
