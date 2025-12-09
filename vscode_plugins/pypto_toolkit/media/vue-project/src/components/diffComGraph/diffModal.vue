<template>
  <d-modal
    v-model="visible"
    :title="title"
    :escapable="false"
    :draggable="false"
    :close-on-click-overlay="false"
    class="diff-modal-container"
  >
    <d-code-review :diff="diff" :expand-threshold="8" :allow-comment="false" :expand-loader="codeLoader" output-format="side-by-side">
    </d-code-review>
  </d-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, PropType, ref } from 'vue';
import { createTwoFilesPatch } from 'diff';

const props = defineProps({ diffDetail: Array as PropType<Record<'new' | 'old', any>[]> });

const visible = ref(false);
const title = ref('');
const diff = ref(`--- a/src/diff2html.json
+++ b/src/diff2html.json
@@ -7,7 +7,7 @@
 
 (function() {
   var diffParser = require('./diff-parser.js').DiffParser;
-  var fileLister = require('./file-list-printer.js').FileListPrinter;
   var htmlPrinter = require('./html-printer.js').HtmlPrinter;
 
   function Diff2Html() {
 
     var fileList = '';
     if (configOrEmpty.showFiles === true) {
-      fileList = fileLister.generateFileList(diffJson, configOrEmpty);
+      fileList = htmlPrinter.generateFileListSummary(diffJson, configOrEmpty);
     }
 
     var diffOutput = '';
`);

const codeLoader = ([lStart, lEnd, rStart, rEnd], update) => {
  if (lStart >= 60) {
    return update('');
  }
  const code = [
    "var diffParser = require('./diff-parser.js').DiffParser;\n",
    "var htmlPrinter = require('./html-printer.js').HtmlPrinter;\n",
    "var diffParser = require('./diff-parser.js').DiffParser;\n",
    "var htmlPrinter = require('./html-printer.js').HtmlPrinter;\n",
    "var diffParser = require('./diff-parser.js').DiffParser;\n",
    "var htmlPrinter = require('./html-printer.js').HtmlPrinter;\n",
    "var diffParser = require('./diff-parser.js').DiffParser;\n",
    "var htmlPrinter = require('./html-printer.js').HtmlPrinter;\n",
  ];
  const content =
    '--- a/src/diff2html.js\n+++ b/src/diff2html.js\n@@ -' +
    Math.min(lStart, lEnd) +
    ',' +
    Math.abs(lStart - lEnd - 1) +
    ' +' +
    Math.min(rStart, rEnd) +
    ',' +
    Math.abs(rStart - rEnd - 1) +
    ' @@\n ' +
    code.slice(0, Math.min(Math.abs(lStart - lEnd - 1), 10)).join(' ');
  update(content);
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
  return props.diffDetail?.find((item) => item.new?.magic === Number(node.magic) || item.old?.magic === Number(node.magic));
}

function onViewMouseUp(node) {
  if (node.id.endsWith('label-main')) {
    const compareType = getCompareTypeNode(node)?.compareType;
    if (compareType && compareType !== 'normal') {
      visible.value = true;
      title.value = node.text;
      const nodeDetail = getNodeDetail(node);
      diff.value = createTwoFilesPatch(
        'a/src/diff2html.json',
        'b/src/diff2html.json',
        JSON.stringify(nodeDetail.old, null, 2),
        JSON.stringify(nodeDetail.new, null, 2),
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
      .hljs-literal {
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
