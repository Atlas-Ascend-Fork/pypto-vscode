/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
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
