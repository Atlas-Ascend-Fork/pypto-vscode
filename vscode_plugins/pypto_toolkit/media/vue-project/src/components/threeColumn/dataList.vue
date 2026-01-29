<template>
  <div class="selected-history">
    <div :class="['selected-history-title', isOpen && 'is-open']" @click="openChooseList()">
      <span :title="baseChoose || t('pleaseSelectResult')">{{ baseChoose || t('pleaseSelectResult') }}</span>
      <i class="icon-chevron-down-2"></i>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, inject, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { baseChoose, runDataVisible, isHeaderEnter } = inject('runDataList');

const isOpen = ref(false);

const openChooseList = () => {
  isOpen.value = !isOpen.value;
  runDataVisible.value = true;
  isHeaderEnter.value = true;
};


</script>

<style scoped lang="scss">
@import 'devui-theme/styles-var/devui-var.scss';

.selected-history {
  min-width: 170px;

  .selected-history-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 400;
    line-height: 20px;
    color: var(--devui-primary-text);
    pointer-events: all;
    transition: color $devui-animation-duration-base $devui-animation-ease-in-out-smooth;

    &:hover {
      color: var(--devui-operation-text-hover);
    }

    span {
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }

    i {
      font-size: 16px;
      font-weight: bold;
      color: var(--devui-placeholder-text);
      transition: transform $devui-animation-duration-base $devui-animation-ease-in-out-smooth;
    }

    &.is-open {
      i {
        transform: rotate(180deg);
      }
    }
  }
}
</style>