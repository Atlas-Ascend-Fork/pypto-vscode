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
