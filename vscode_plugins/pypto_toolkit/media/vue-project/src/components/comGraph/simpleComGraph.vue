<template>
  <div class="com-graph-container">
    <div
      :style="{
        backgroundImage: 'url(' + svgPath + ')',
        backgroundRepeat: 'repeat',
        height: '100%',
      }"
    >
      <div id="sprotty"></div>
    </div>
    <Loading v-if="isLoading" :loadingText="loadingText" :warningText="warningText" />
  </div>
</template>

<script setup lang="ts">
import { useSprottyLoad } from '../../sprotty-graph/main';
import { onMounted, watch, defineProps, ref, inject, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Loading from './loading.vue';
import { comGraphStore } from '../../service/com-graph-store';

const { t } = useI18n();
const props = defineProps({
  jsonContent: {
    type: Object,
    default: {},
  },
  loadingStep: {
    type: String,
    default: '',
  },
  openMode: {
    type: String,
    default: 'all',
  },
  nodeMagic: {
    type: Number,
    default: '-1',
  },
});

const { isDarkTheme } = inject('root');
const isLoading = ref(false);
const loadingText = ref('');
const warningText = ref('');
const svgPath = computed(() => `"${window.staticPath}/static-assets/spot${isDarkTheme.value ? '' : '-light'}.svg"`);

window.addEventListener('message', (event) => {
  if (event.data.type === 'postLayoutResult') {
    isLoading.value = false;
    loadingText.value = '';
  }
});

const LoadingStatusMap = {
  readJson: 'comGraph.readJson',
  convertData: 'comGraph.convertData',
  readJsonWarning: 'comGraph.readJsonWarning',
  rendering: 'comGraph.rendering',
};
watch(
  () => props.loadingStep,
  (val) => {
    if (val === 'rendering' || val === 'convertData') {
      isLoading.value = true;
    }
    if (val === 'readJsonWarning') {
      isLoading.value = true;
      loadingText.value = t(LoadingStatusMap['readJson']);
      warningText.value = t(LoadingStatusMap[val]);
    } else {
      loadingText.value = t(LoadingStatusMap[val]);
    }
  },
);

watch(
  [() => props.jsonContent, isDarkTheme],
  ([val]) => {
    if (Object.keys(val).length) {
      const jsonValue = JSON.parse(JSON.stringify(props.jsonContent));
      useSprottyLoad().initComDocText(jsonValue, isDarkTheme.value, props.openMode, props.nodeMagic);
      comGraphStore.setData('jsonData', jsonValue);
      comGraphStore.setData('isSimpleComGraph', true);
    }
  },
  { immediate: true },
);

onMounted(() => {
  (window as any).ascEventBus.on('layoutEnding', (args) => {
    isLoading.value = false;
    loadingText.value = '';
  });
  if (props.loadingStep === 'readJson' || props.loadingStep === 'convertData') {
    isLoading.value = true;
    loadingText.value = t(LoadingStatusMap[props.loadingStep]);
  }
});
</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.com-graph-container {
  width: 100%;
  height: 100%;
  position: relative;
  background-color: var(--devui-global-bg);

  #sprotty {
    height: 100%;
  }
}

.devui-loading {
  .devui-loading__area {
    display: flex;
    align-items: center;
  }
}
</style>
