import { computed } from "vue";

export const vscode = computed(() => {
  return window.vscode ?? acquireVsCodeApi();
});
