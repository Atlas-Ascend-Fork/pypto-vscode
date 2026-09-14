<!--
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
 -->
<template>
  <div :class="['com-graph-error-node', node.showErrorIconOnly && 'only-show-error-icon']"
    v-for="node in displayList"
    :style="{
      top: node.y + 'px',
      left: node.x + 'px'
    }"
    v-show="node.show"
    @mouseleave="() => leave(node)"
  >
    <div class="error-info" :title="node.errorInfo">
      {{ node.errorInfo }}
    </div>
    <i class="icon-error-o" @mouseenter="onIconMouseenter(node)"></i>
    <d-popover :position="['top']" trigger="hover" :mouse-leave-delay="100" v-if="node.stackList?.length">
      <template #content>
        <div style="width: auto;font-size: 12px;" @mouseenter="onPopoverMouseenter" @mouseleave="() => onPopoverMouseleave(node)">
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
import { debounce } from 'lodash-es';
import { isNodeTraced } from '@/sprotty-graph/views';
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
let isEnterPopover: boolean = false;

const leave = debounce((node: Record<string, any>) => {
  if (!isEnterPopover) {
    node.showErrorIconOnly = currentZoom < 0.4;
  }
}, 100);

const onIconMouseenter = (node: Record<string, any>) => {
  node.showErrorIconOnly = false;
  (window as any).ascEventBus.emit('closeNodeTip');
}

const onPopoverMouseenter = () => {
  isEnterPopover = true;
}

const onPopoverMouseleave = (node: Record<string, any>) => {
  isEnterPopover = false;
  leave(node);
}

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
      node.show = false;
      return;
    }

    if (comGraphStore.data.unVisibleOtherNodes) {
      const traceResult = isNodeTraced(target.id, (window as any).trace);
      const incoming = traceResult.incoming;
      const outgoing = traceResult.outgoing;
      const isTraced = incoming || outgoing;

      if (!isTraced) {
        node.show = false;
        return;
      }
    }
    if (target.role === 'tensor') {
      node.type = 'tensor'
    }
    node.x = (target.position.x + target.size.width - scroll.x) * zoom + 4;
    node.y = (target.position.y - scroll.y) * zoom;
    node.showErrorIconOnly = zoom < 0.4;
    node.show = true;
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
@use 'devui-theme/styles-var/devui-var.scss' as *;
.com-graph-error-node {
  position: absolute;
  z-index: 2;
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
      z-index: 1;
  
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
    &:hover {
      text-decoration: underline;
    }
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