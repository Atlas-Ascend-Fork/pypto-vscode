<template>
  <div class="abnormal-detail-wrap">
    <div class="detail-magic-id">
      <i class="icon icon-chevron-left-2" @click="() => emits('back')"></i>
      <span>Magic ID: {{ magicId }}</span>
    </div>
    <OverviewCard :data="typeShapeThresholdInfo" />
    <OverviewCard :data="tolInfo" />
    <d-tabs v-model="activeTab" type="pills" :show-content="false" class="com-graph-report-tabs">
      <d-tab id="overview" :title="t('precisionOverview')"></d-tab>
      <d-tab id="detail" :title="t('precisionDetail')"></d-tab>
    </d-tabs>
    <template v-if="activeTab === 'overview'">
      <AbnormalOverview />
    </template>
    <template v-if="activeTab === 'detail'">
      <AbnormalCompare />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import OverviewCard from './overviewCard.vue';
import AbnormalOverview from './abnormalOverview.vue';
import AbnormalCompare from './abnormalCompare.vue';

defineProps({
  magicId: String,
});
const emits = defineEmits(['back']);
const { t } = useI18n();

const activeTab = ref<'overview' | 'detail'>('overview');
const typeShapeThresholdInfo = ref([
  { label: 'Dtype', value: 'FP16' },
  { label: 'Shape', value: '[16,512]' },
]);
const tolInfo = ref([
  { label: 'rtol', value: '0.001' },
  { label: 'atol', value: '0.001' },
]);
</script>

<style lang="scss">
.abnormal-detail-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  .detail-magic-id {
    display: flex;
    align-items: center;
    gap: 8px;

    i {
      font-size: 16px;
      cursor: pointer;
    }

    span {
      font-size: 16px;
      color: var(--devui-title-text);
      line-height: 16px;
    }
  }

  .com-graph-report-tabs {
    margin-top: 4px;
    padding: 0;
  }
}
</style>
