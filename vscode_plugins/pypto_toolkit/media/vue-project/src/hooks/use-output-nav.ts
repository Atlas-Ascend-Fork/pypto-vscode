import { Ref, ref, watchEffect } from 'vue';

import type { OutputDetail } from 'ext:/types/workspace';

interface OutputNav {
  sourceCodeFile: string | null;
  controlFlowFile: string | null;
  swimlaneFile: string | null;
}

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
    const nav: OutputNav = { sourceCodeFile: null, controlFlowFile: null, swimlaneFile: null };
    for (const childDirectory of outputDetail.directoryTree.children ?? []) {
      if (childDirectory.type === 'file' && childDirectory.fileType === 'controlFlow') {
        nav.controlFlowFile = childDirectory.absolutePath;
        controlFlowFile.value = childDirectory.absolutePath;
      }
      if (childDirectory.type === 'file' && childDirectory.fileType === 'swimlaneGraph') {
        nav.swimlaneFile = childDirectory.absolutePath;
        swimlaneFile.value = childDirectory.absolutePath;
      }
    }
  }

  return { sourceCodeFile, controlFlowFile, swimlaneFile };
}
