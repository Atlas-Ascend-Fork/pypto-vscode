<template>
  <div class="three-dot" >
    <div :style="{ backgroundColor: dotColor }"></div>
    <div :style="{ backgroundColor: dotColor }"></div>
    <div :style="{ backgroundColor: dotColor }"></div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  dotColor: {
    type: String,
    default: 'var(--devui-icon)',
  },
});
</script>

<style scoped lang="scss">
.three-dot {
  display: flex;
  align-items: center;
  gap: 2px;

  div {
    width: 2px;
    height: 2px;
    border-radius: 2px;
  }
}
</style>
