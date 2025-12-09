<template>
  <d-modal
    v-model="visible"
    :title="title"
    :escapable="false"
    :draggable="false"
    :close-on-click-overlay="false"
    class="diff-modal-container"
  >
    <d-code-review :diff="diff" :allow-comment="false" :expand-loader="codeLoader" output-format="side-by-side"> </d-code-review>
  </d-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, PropType, ref } from 'vue';
import { createTwoFilesPatch } from 'diff';

const props = defineProps({ diffDetail: Array as PropType<Record<'new' | 'old', any>[]> });

const visible = ref(false);
const title = ref('');
const diff = ref(``);
let allStr = [];

const codeLoader = ([lStart, lEnd, rStart, rEnd], update) => {
  if (lStart >= allStr.length) {
    return update('');
  }
  let sliceStart = lStart - 1;
  let sliceEnd = lEnd - 1;
  const content =
    '--- old.json\n+++ new.json\n@@ -' +
    Math.min(lStart, lEnd) +
    ',' +
    Math.abs(lStart - lEnd - 1) +
    ' +' +
    Math.min(rStart, rEnd) +
    ',' +
    Math.abs(rStart - rEnd - 1) +
    ' @@\n ' +
    allStr.slice(sliceStart, sliceEnd).join(' ');
  update(content);
  if (sliceEnd >= allStr.length) {
    update('');
  }
};

function getCompareTypeNode(node) {
  if (node) {
    if (node.compareType) {
      return node;
    } else {
      return getCompareTypeNode(node.parent);
    }
  }
}

function getNodeDetail(node) {
  return props.diffDetail?.find(
    (item) =>
      item.new?.magic === Number(node.magic) ||
      item.new?.opmagic === Number(node.magic) ||
      item.old?.magic === Number(node.magic) ||
      item.old?.opmagic === Number(node.magic),
  );
}

function onViewMouseUp(node) {
  if (node.id.endsWith('label-main')) {
    const compareType = getCompareTypeNode(node)?.compareType;
    if (compareType && compareType !== 'normal') {
      visible.value = true;
      title.value = node.text;
      const nodeDetail = getNodeDetail(node);
      if (nodeDetail.old) {
        allStr = JSON.stringify(nodeDetail.old, null, 2)
          .split('\n')
          .map((item) => `${item}\n`);
      } else if (nodeDetail.new) {
        allStr = JSON.stringify(nodeDetail.new, null, 2)
          .split('\n')
          .map((item) => `${item}\n`);
      }
      diff.value = createTwoFilesPatch(
        'old.json',
        'new.json',
        nodeDetail.old ? JSON.stringify(nodeDetail.old, null, 2) : '',
        nodeDetail.new ? JSON.stringify(nodeDetail.new, null, 2) : '',
      );
    }
  }
}

onMounted(() => {
  (window as any).ascEventBus.on('view_mouseup', onViewMouseUp);
});

onBeforeUnmount(() => {
  (window as any).ascEventBus.remove('view_mouseup', onViewMouseUp);
});
</script>

<style lang="scss">
.diff-modal-container.devui-modal {
  width: 820px;
  border-radius: 16px;
  box-shadow: var(--devui-modal-shadow);
  background-color: var(--devui-select-bg);

  .btn-close {
    svg g {
      fill: var(--devui-node-edge-active);
    }
  }

  .devui-modal__body {
    max-height: calc(80vh - 46px);
    overflow: auto;

    .devui-code-review {
      box-shadow: unset;

      .hljs-attr,
      .hljs-number,
      .hljs-keyword,
      .hljs-literal,
      .hljs-string {
        color: unset;
      }

      .devui-code-review__header {
        display: none;
      }
    }

    .d2h-info {
      background-color: var(--devui-input-active-bg);
      &.expand-icon-wrapper {
        background-color: var(--devui-input-active-bg-4);

        svg {
          path,
          polygon {
            fill: var(--devui-primary-text);
          }
        }
      }
      &.d-code-right {
        background-color: var(--devui-input-active-bg);
      }

      .d2h-code-side-line {
        color: var(--devui-secondary-text);
      }
    }

    .d2h-cntx {
      .d2h-code-line-ctn {
        color: var(--devui-primary-text) !important;
      }
      &.d2h-emptyplaceholder {
        background-color: transparent;

        .d2h-code-side-emptyplaceholder {
          background-color: transparent;
        }
      }
    }

    .d2h-del {
      background-color: rgba(231, 67, 74, 0.2);
      &.d2h-code-side-linenumber {
        background-color: rgba(231, 67, 74, 0.4);
      }
      .d2h-code-side-line {
        del {
          border: 1px solid var(--devui-status-error);
          border-radius: 4px;
          background-color: unset;
        }
      }
      .d2h-code-line-ctn {
        color: var(--devui-primary-text);
      }
    }

    .d2h-ins {
      background-color: rgba(135, 200, 89, 0.2);
      &.d2h-code-side-linenumber {
        background-color: rgba(135, 200, 89, 0.4);
      }
      .d2h-code-side-line {
        ins {
          border: 1px solid #87c859;
          border-radius: 4px;
          background-color: unset;
        }
      }
      .d2h-code-line-ctn {
        color: var(--devui-primary-text);
      }
    }

    .d2h-code-side-linenumber {
      width: 36px;
      color: var(--devui-secondary-text);
      background-color: transparent;
    }

    .devui-code-review__content.side-by-side tr td:nth-of-type(3) {
      border-left-color: var(--devui-split-line);
    }
  }
}
</style>
