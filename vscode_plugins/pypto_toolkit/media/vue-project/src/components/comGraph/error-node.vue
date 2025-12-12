<template>
  <div class="com-graph-error-node"
    v-for="node in displayList"
    :style="{
      top: node.y + 'px',
      left: node.x + 'px'
    }"
    v-show="node.show"
  >
    <div class="error-info" :title="node.errorInfo">
      {{ node.errorInfo }}
    </div>
    <i class="icon-error-o"></i>
    <d-popover :position="['top']" trigger="hover" :mouse-leave-delay="100" v-if="node.stackList?.length">
      <template #content>
        <div style="width: auto;font-size: 12px;">
          <p v-for="stack in node.stackList">
            <a class="error-jump" @click="jumpTo(stack)">{{stack}}</a>
          </p>
        </div>
        
      </template>
      <div class="error-stack">
        查看调用栈 →
      </div>
    </d-popover>
  </div>
</template>

<script setup lang="ts">
import { useViewServer } from '@/core/use-view-server';
import { comGraphStore } from '@/service/com-graph-store';
import { IComViewServer } from 'ext:/view/servers/view-server-interface';
import { onMounted, ref } from 'vue';

const props = defineProps({
  nodeErrorList: {
    type: Array<any>,
    default: []
  },
  jsonContent: {
    type: Object,
    default: {}
  }
});

const model = ref();

const { server } = useViewServer<IComViewServer>();
const displayList = ref([{
  x: 100,
  y: 100,
  magic: 1200,
  show: true,
  errorInfo: 'someError 12312312312',
  stackList: [
    '/src/components/swimGraph/swimGraphUtils.ts: 100',
    '/src/components/swimGraph/swimGraphUtils.ts: 100',
    '/src/components/swimGraph/swimGraphUtils.ts: 100'
  ]
}]);

const jumpTo = (stack) => {
  const [file,  line] = stack.split(':');
  server.jumpToCodeLine({paramObj: {file, line}});
}

const updateLocation = (data) => {
  if (data.model) {
    model.value = data.model;
  }
  const {zoom, scroll} = data;
  
  displayList.value.forEach(node => {
    const target = model.value.children.find(t => t.magic === node.magic);
    node.x = (target.position.x + target.size.width - scroll.x) * zoom + 4;
    node.y = (target.position.y - scroll.y) * zoom
  })

}

const calculateLocation = () => {

}

const closeNode = (node) => {
  node.show = false;
}

const initNodeList = () => {
  displayList.value = props.nodeErrorList.map(node => {
    const magic = node.magic;
    const errInfo = node.error;
    let target = props.jsonContent.operations.find(op => op.opmagic == magic);
    if(!target) {
      target = props.jsonContent.tensors.find(tensor => tensor.magic == magic);
    }
    const list = target?.backtrace?.split('\n') || [];
    return {
      x: -200,
      y: -200,
      magic: String(magic),
      show: true,
      errorInfo: errInfo,
      stackList: list
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
}

.icon-error-o {
  position: absolute;
  color: $devui-danger;
  left: 4px;
  top: 10px;
  font-size: 14px;
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