<template>
  <div class="diff-header">{{ fileName }}</div>
</template>

<script setup lang="ts">
const props = defineProps({
  fileName: String,
});
</script>

<style scoped lang="scss">
.diff-header {
  position: absolute;
  top: 0;
  z-index: 10;
  width: 100%;
  height: 160px;
  font-size: 14px;
  font-weight: 600;
  color: var(--devui-primary-text);
  padding: 16px;
  box-sizing: border-box;
  background: var(--devui-header-gradient-bg);
  user-select: none;
}
</style>
