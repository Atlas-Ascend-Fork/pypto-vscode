<template>
  <div class="gm-memory-graph">
    <MemoryUsage
      :is-three-column="false"
      graphType="gmMemoryVisual"
    />
  </div>
</template>

<script setup lang="ts">
import MemoryUsage from '../memoryUsage/memoryUsage.vue';
</script>

<style scoped lang="scss">
.gm-memory-graph {
  width: 100%;
  height: 100%;
}
</style>