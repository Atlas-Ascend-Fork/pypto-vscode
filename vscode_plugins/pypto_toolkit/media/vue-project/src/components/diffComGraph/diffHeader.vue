<template>
  <div class="diff-header">
    <div class="file-name" :title="fileName">{{ fileName }}</div>
    <d-icon class="change-icon" v-if="isChangeable" name="icon-sequence-new" size="16px"></d-icon>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  fileName: String,
  isChangeable: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped lang="scss">
.diff-header {
  display: flex;
  align-items: center;
  position: absolute;
  top: 0;
  z-index: 10;
  width: 100%;
  height: 52px;
  line-height: 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--devui-primary-text);
  padding: 16px;
  box-sizing: border-box;
  background: var(--devui-header-gradient-bg);
  user-select: none;
  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .change-icon {
    cursor: pointer;
  }
}
</style>
