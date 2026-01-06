<template>
  <div v-if="switchLockInformationFlag" class="lockMenu" :style="{top: topX + 'px', left: leftX + 'px'}">
    <div class="pathway-lockout-area" @click="pathwayLockoutClick">
      <div class="pathway-lockout"> {{ isPathLockStatus? $t('pathwayLockout') :$t('displayPathwayLock') }} </div>
      <div class="pathway-lockout-key"> Ctrl+L </div> 
    </div>
  </div>
</template>


<script setup>
import { ref, inject, computed, watch, onMounted, provide } from 'vue';
import { useI18n } from 'vue-i18n';

const switchLockInformationFlag = inject('switchLockInformationFlag');
const isPathLockStatus = inject('isPathLockStatus');
const topX = inject('topX');
const leftX = inject('leftX');
const { t: $t } = useI18n();

const pathwayLockoutClick = () => { 
    isPathLockStatus.value = true;
    switchLockInformationFlag.value = false;
};

</script>

<style lang="scss">
@import url("../css/swimGraph/Processes/lockmenu.css");

</style>