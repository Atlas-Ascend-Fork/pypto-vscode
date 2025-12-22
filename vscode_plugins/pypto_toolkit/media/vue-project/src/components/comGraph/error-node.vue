<template>
  <div :class="['com-graph-error-node', node.showErrorIconOnly && 'only-show-error-icon']"
    v-for="node in displayList"
    :style="{
      top: node.y + 'px',
      left: node.x + 'px'
    }"
    v-show="node.show"
    @mouseleave="() => node.showErrorIconOnly = currentZoom < 0.4"
  >
    <div class="error-info" :title="node.errorInfo">
      {{ node.errorInfo }}
    </div>
    <i class="icon-error-o" @mouseenter="() => node.showErrorIconOnly = false"></i>
    <d-popover :position="['top']" trigger="hover" :mouse-leave-delay="100" v-if="node.stackList?.length">
      <template #content>
        <div style="width: auto;font-size: 12px;">
          <p v-for="stack in node.stackList">
            <a class="error-jump" @click="jumpTo(stack)">{{stack}}</a>
          </p>
        </div>
        
      </template>
      <div class="error-stack">
        {{ t('comGraph.viewErrorStack')}} →
      </div>
    </d-popover>
  </div>
</template>

<script setup lang="ts">
import { useViewServer } from '@/core/use-view-server';
import { comGraphStore } from '@/service/com-graph-store';
import { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { watch } from 'vue';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const props = defineProps({
  nodeErrorList: {
    type: Array<any>,
    default: []
  },
  jsonContent: {
    type: Object,
    default: {}
  },
  showType: {
    type: String,
    default: 'all'
  },
});

const model = ref();

const { server } = useViewServer<IComViewServer>();
const displayList = ref([]);
let currentZoom = 1;

const jumpTo = (stack) => {
  const list = stack.split(':');
  const line = list.pop();
  const file = list.join(':');
  server.jumpToCodeLine({paramObj: {file, line}});
}

const updateLocation = (data) => {
  if (data.model) {
    model.value = data.model;
  }
  const {zoom, scroll} = data;
  currentZoom = zoom;
  
  displayList.value.forEach(node => {
    const target = model.value?.children.find(t => t.magic === node.magic);
    if (!target) {
      return;
    }
    if (target.role === 'tensor') {
      node.type = 'tensor'
    }
    node.x = (target.position.x + target.size.width - scroll.x) * zoom + 4;
    node.y = (target.position.y - scroll.y) * zoom;
    node.showErrorIconOnly = zoom < 0.4;
  })
}

watch(() => comGraphStore.data.inFixedComGraphFlow, (value) => {
  if (value) {
    setTimeout(() => {
      const showMagicList = [
        ...comGraphStore.data.traceOperations[1],
        ...comGraphStore.data.traceTensors[1],
      ]
      displayList.value.forEach(node => {
        if (!showMagicList.includes(Number(node.magic))) {
          node.show = false;
        }
      })
    });
  } else {
    displayList.value.forEach(node => {
      node.show = true
    })
  }
})

watch(() => props.showType, (value) => {
  displayList.value.forEach(node => {
    if (node.type === 'tensor') {
      node.show = (value !== 'op');
    }
  })
})

const initNodeList = () => {
  displayList.value = props.nodeErrorList.map(node => {
    const magic = node.magic;
    const errInfo = node.error;
    let target = props.jsonContent.operations.find(op => op.opmagic == magic);
    if(!target) {
      target = props.jsonContent.tensors.find(tensor => tensor.magic == magic);
    }
    const list = target?.backtrace?.split('\n') || [];
    let isStackListValid = (Array.isArray(list) && list.some(elem => elem !== '')) ? true : false; 
    return {
      x: -200,
      y: -200,
      magic: String(magic),
      show: true,
      errorInfo: errInfo,
      stackList: isStackListValid ? list : undefined,
      showErrorIconOnly: false
    }
  })
}

onMounted(() => {
  (window as any).ascEventBus.on('viewer_update', updateLocation);
  initNodeList();
})

</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';
.com-graph-error-node {
  position: absolute;
  width: 160px;
  height: auto;
  max-height: 300px;
  background-color: rgba(231,67,74,0.2);
  backdrop-filter: blur(20px);
  border-radius: 8px;
  padding: 6px 8px 6px 24px;
  word-break: normal;

  &.only-show-error-icon {
      width: auto;
      padding: 0;
      background-color: unset;
      backdrop-filter: unset;
  
      .error-info,
      .error-stack {
        display: none;
      }

      .icon-error-o {
        left: 0;
        top: 0;
      }
    }

  .error-info {
    font-size: 14px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
  }

  .error-stack {
    margin-top: 6px;
  }

  .icon-error-o {
    position: absolute;
    color: $devui-danger;
    left: 4px;
    top: 10px;
    font-size: 14px;
  }
}

.error-jump {
  color: $devui-text;
  margin-bottom: 4px;

  &:hover {
    color: $devui-link;
    text-decoration: underline;
    cursor: pointer;
  }
}
</style>