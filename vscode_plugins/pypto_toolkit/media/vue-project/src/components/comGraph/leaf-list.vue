<template>
  <d-dropdown trigger="manually" :visible="isVisible" :position="['bottom-start']" :offset="-4" @toggle="(val) => (isVisible = val)">
    <span @click="expandList" class="layer-cur">{{ funcMap[curPath[curPath.length - 1]]?.func_magicname }} </span>
    <template #menu>
      <div class="layer-list">
        <div
          v-for="(it, index) in curList"
          :key="index"
          class="layer-item"
          :class="{ active: it == curPath[curPath.length - 1] }"
          @click="onJump(it)"
        >
          {{ funcMap[it]?.func_magicname }}
        </div>
      </div>
    </template>
  </d-dropdown>
</template>

<script setup lang="ts">
import { PropType, ref } from 'vue';

const props = defineProps({
  showLeafList: { type: Boolean, default: false },
  funcMap: { type: Object, default: () => ({}) },
  curList: { type: Array as PropType<string[]>, default: () => [] },
  curPath: { type: Array, default: () => [] },
});
const emits = defineEmits(['change']);

const isVisible = ref(false);
function expandList() {
  if (props.showLeafList) {
    isVisible.value = true;
  }
}

const onJump = (it) => {
  const newPath = [...props.curPath];
  newPath.pop();
  newPath.push(it);
  emits('change', it, props.funcMap[it].func_magicname, JSON.stringify(newPath));
};
</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.layer-cur {
  font-weight: bold;
  pointer-events: all;

  &:hover {
    cursor: pointer;
  }
}

.layer-list {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 4px;

  .layer-item {
    padding: 4px;

    &:hover {
      background: $devui-list-item-active-hover-bg;
      cursor: pointer;
    }

    &.active {
      background: $devui-list-item-active-bg;
    }
  }
}
</style>
