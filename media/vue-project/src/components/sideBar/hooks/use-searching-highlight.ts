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
