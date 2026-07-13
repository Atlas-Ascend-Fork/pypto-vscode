/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { ref } from 'vue';

export function useSearchingHighlight() {
  const keyword = ref('');

  function updateKeyword(newKeyWord: string): void {
    keyword.value = newKeyWord;
  }

  function textToHighlightHtml(text: string): string {
    if (!keyword.value) {
      return text;
    }
    console.log('textToHighlightHtml', text, text.replace(new RegExp(`${keyword}`, 'ig'), generateHighlightSpan));
    return text.replace(new RegExp(`${keyword.value}`, 'i'), generateHighlightSpan);
  }

  return { updateKeyword, textToHighlightHtml };
}

function generateHighlightSpan(text: string): string {
  return `<span style="background-color: var(--devui-yellow-60); color: var(--vscode-menu-background); border-radius: 4px;">${text}</span>`;
}
