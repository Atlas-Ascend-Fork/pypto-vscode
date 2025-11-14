import { Ref, ref, watchEffect } from 'vue';

import { getOutputDetail } from '@/apis/workspace';

interface OutputNav {
  sourceCodeFile: string | null;
  controlFlowFile: string | null;
  swimlaneFile: string | null;
}

const outputNavCache = new Map<string, OutputNav>();

export function useOutputNav(outputPath: Ref<string>) {
  const sourceCodeFile = ref<string | null>(null);
  const controlFlowFile = ref<string | null>(null);
  const swimlaneFile = ref<string | null>(null);

  watchEffect(() => {
    if (!outputPath.value) {
      return;
    }
    if (outputNavCache.has(outputPath.value)) {
      getOutputNavFromCache(outputPath.value);
    } else {
      getOutputNavFromApi(outputPath.value);
    }
  });

  function getOutputNavFromCache(newPath: string): void {
    const cache = outputNavCache.get(newPath);
    sourceCodeFile.value = cache.sourceCodeFile;
    controlFlowFile.value = cache.controlFlowFile;
    swimlaneFile.value = cache.swimlaneFile;
  }

  function getOutputNavFromApi(newPath: string): void {
    getOutputDetail(newPath).then(({ data: { directoryTree } }) => {
      const nav: OutputNav = { sourceCodeFile: null, controlFlowFile: null, swimlaneFile: null };
      for (const childDirectory of directoryTree.children) {
        if (childDirectory.type === 'file' && childDirectory.fileType === 'controlFlow') {
          nav.controlFlowFile = childDirectory.absolutePath;
          controlFlowFile.value = childDirectory.absolutePath;
        }
        if (childDirectory.type === 'file' && childDirectory.fileType === 'swimlaneGraph') {
          nav.swimlaneFile = childDirectory.absolutePath;
          swimlaneFile.value = childDirectory.absolutePath;
        }
      }
      outputNavCache.set(newPath, nav);
    });
  }

  return { sourceCodeFile, controlFlowFile, swimlaneFile };
}
