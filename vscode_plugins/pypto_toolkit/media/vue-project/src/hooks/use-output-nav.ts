import { Ref, ref, watchEffect } from 'vue';

import type { OutputDetail } from 'ext:/types/workspace';

export function useOutputNav(output: Ref<OutputDetail>) {
  const sourceCodeFile = ref<string | null>(null);
  const controlFlowFile = ref<string | null>(null);
  const swimlaneFile = ref<string | null>(null);

  watchEffect(() => {
    if (!output.value) {
      return;
    }

    getOutputNavFromApi(output.value);
  });

  function getOutputNavFromApi(outputDetail: OutputDetail): void {
    for (const childDirectory of outputDetail.directoryTree.children ?? []) {
      if (childDirectory.type === 'file' && childDirectory.fileType === 'controlFlow') {
        controlFlowFile.value = childDirectory.absolutePath;
      }
      if (childDirectory.type === 'file' && childDirectory.fileType === 'swimlaneGraph') {
        swimlaneFile.value = childDirectory.absolutePath;
      }
    }
  }

  return { sourceCodeFile, controlFlowFile, swimlaneFile };
}
