<template>
  <div class="config-containt">
    <div class="header-panel">
      <div class="header-panel__title">{{ t('schemaConfig.title') }}</div>
      <div class="header-panel__detail">{{ t('schemaConfig.detail') }}:</div>
      <div class="header-panel__tabs">
        <div v-for="(card, index) in 6" @click="handleTabsCard(card, index)">
          <div class="modle-card" :class="{ 'modle-card-actived': activeCardIndex === index }">
            <span class="card-default-icon"></span>
            <span class="card-name">{{ t('schemaConfig.defaultConfiguration') }}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="split-line"></div>
    <!-- todo:待高保真 -->
    <div class="main-panel">
      <d-textarea v-model="customConfigData" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="请输入" resize="both"></d-textarea>
      <button @click="updateFile">update</button>
      <d-form layout="vertical" :data="formModel">
        <d-row>
          <d-col v-for="(item, index) in defaultPassConfigs" :key="index">
            <d-form-item field="executionDay" :label="item.label">
              <d-checkbox-group v-model="formModel.executionDay">
                <d-checkbox v-model="item.value" />
              </d-checkbox-group>
            </d-form-item>
          </d-col>
        </d-row>
      </d-form>
    </div>
  </div>
</template>
<script setup lang="ts">
import { getSchemaData, getTileFwkConfigData, updateFwkConfigData } from '@/apis/schema-config';
import { getQuery } from '@/core/query';
import { DefaultPassConfigsVo } from 'ext:/types/config-schema/config-schema';
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const customConfigData = ref();
const schemaData = ref();
const configPath = ref();
const activeCardIndex = ref(0);

const formModel = reactive({
  name: '',
  select: 'Options2',
  multiSelect: ref([]),
  executionDay: [],
  radio: '0',
  switch: true,
});
interface ConfigCheckGroupModle {
  label: string;
  value: boolean;
}

const defaultPassConfigs = ref<ConfigCheckGroupModle[]>();

async function updateFile() {
  updateFwkConfigData({ data: JSON.parse(customConfigData.value), filePath: configPath.value });
}

function handleTabsCard(card, index) {
  activeCardIndex.value = index;
}

/**
 * 将 DefaultPassConfigs 对象转换为 ConfigCheckGroupModle 数组
 * @param configs - 原始配置对象
 * @returns 转换后的配置项数组
 */
function convertToConfigCheckGroup(configs: DefaultPassConfigsVo): ConfigCheckGroupModle[] {
  // 辅助函数：将大写下划线命名转换为自然标题（如 PRINT_FUNCTION → Print Function）
  const formatLabel = (key: string): string => {
    return key
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  return Object.entries(configs).map(([key, value]) => ({
    label: formatLabel(key),
    value: value,
  }));
}

onMounted(async () => {
  const res = await getQuery();
  configPath.value = res.url;
  const data = await getTileFwkConfigData(configPath.value);
  defaultPassConfigs.value = convertToConfigCheckGroup(data.pass_global_configs.default_pass_configs);
  customConfigData.value = JSON.stringify(data);
  schemaData.value = await getSchemaData();
});
</script>

<style scoped lang="less">
.config-containt {
  min-height: 100vh;
  width: 100%;
  height: 100%;
  background: var(--devui-card-bg);
  color: var(--control-flow-sidebar-search-icon);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  gap: 11px;
  padding: 18px 40px;
  // 颜色等高保真统一适配主题
  .header-panel {
    width: 100%;
    .header-panel__title {
      font-size: 18px;
      font-weight: 700;
      height: 60px;
      line-height: 40px;
    }
    .header-panel__detail {
      font-size: 12px;
      color: rgb(139, 139, 139);
    }

    .header-panel__tabs {
      width: 100%;
      display: flex;
      justify-content: start;
      padding: 8px 0;
      gap: 4px;

      .modle-card {
        height: 100px;
        width: 130px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 4px;
        background-color: rgb(49, 49, 49);
        border-radius: 16px;

        .card-default-icon {
          height: 30px;
          width: 30px;
          border-radius: 4px;
          background-color: rgb(70, 70, 70);
        }

        .card-name {
          display: flex;
          justify-content: center;
          height: 22px;
          line-height: 22px;
        }
      }
      .modle-card-actived {
        border: 1px solid;
        border-color: var(--devui-link-text);
        .card-default-icon {
          background-color: rgba(0, 89, 255, 0.5);
        }
        .card-name {
          color: var(--devui-link-text);
        }
      }
    }
  }
  .split-line {
    width: 80%;
    height: 1px;
    background-color: rgb(49, 49, 49);
  }
  .main-panel {
    flex: 1;
    display: block;
  }
}
</style>
