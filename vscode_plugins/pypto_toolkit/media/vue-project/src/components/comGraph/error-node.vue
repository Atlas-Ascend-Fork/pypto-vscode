<template>
  <div class="com-graph-error-node"
    v-for="node in errorNodeList"
    :style="{
      top: node.y + 'px',
      left: node.x + 'px'
    }"
    v-show="node.show"
  >
    <div class="error-info">
      {{ node.errorInfo }}
    </div>
    <i class="icon-error-o" @click="closeNode(node)"></i>
    <d-popover :position="['top']" trigger="hover" :mouse-leave-delay="100">
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

const { server } = useViewServer<IComViewServer>();
const errorNodeList = ref([{
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

const updateLocation = () => {

}

const calculateLocation= () => {

}

const closeNode = (node) => {
  node.show = false;
}

onMounted(() => {
  console.log(comGraphStore.data);
  (window as any).ascEventBus.on('viewer_update', updateLocation);
})

</script>

<style lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';
.com-graph-error-node {
  position: absolute;
  width: 160px;
  height: auto;
  max-height: 300px;
  background-color: rgba(255,255,255,0.1);
  backdrop-filter: blur(20px);
  border-radius: 4px;
  padding: 6px 8px 6px 24px;
  word-break: break-all;

  .error-info {
    font-size: 14px;
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
  cursor: pointer;
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