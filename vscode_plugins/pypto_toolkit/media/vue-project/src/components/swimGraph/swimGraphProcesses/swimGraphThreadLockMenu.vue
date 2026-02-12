<template>
  <div v-if="switchLockInformationFlag" class="lockMenu" :style="{top: topX + 'px', left: leftX + 'px'}">
    <div class="pathway-lockout-area" @click="pathwayLockoutClick">
      <div class="pathway-lockout"> {{ isPathLockStatus || isClickedPath? $t('pathwayLockout') :$t('displayPathwayLock') }} </div>
      <div class="pathway-lockout-key"> Ctrl+L </div> 
    </div>
  </div>
</template>


<script setup>
import { ref, inject, computed, watch, onMounted, provide } from 'vue';
import { useI18n } from 'vue-i18n';

const {
  switchLockInformationFlag,
  isPathLockStatus,
  topX,
  leftX,
  canvasclickedEvent,
  isClickedPath,
  pathLockedEvent
} = inject('swimGraphThreadState');

const {
  pathLockedMethod
} = inject('swimGraphThreadMethods');

const { t: $t } = useI18n();

const pathwayLockoutClick = () => {
  isPathLockStatus.value = true;
  pathLockedEvent.value = canvasclickedEvent.value;
  switchLockInformationFlag.value = false;
  isClickedPath.value = false;
  pathLockedMethod(canvasclickedEvent.value);
};

</script>

<style lang="scss">
@import url("../css/swimGraph/Processes/lockmenu.css");

</style>