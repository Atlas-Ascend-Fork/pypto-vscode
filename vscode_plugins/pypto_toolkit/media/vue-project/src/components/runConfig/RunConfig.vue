<template>
  <div class="config-containt">
    <div class="header-panel">
      <div class="header-panel__left">
        <div class="header-panel__title">{{ filename }}</div>
        <div class="header-panel__file-path">{{ `${$t('runConfig.filepathLabel')}${filepath}` }}</div>
      </div>
      <div class="header-panel__right">
        <PtoButton type="text" @click="handleViewSourceFile">{{ $t('runConfig.viewSourceFile') }}</PtoButton>
        <PtoButton @click="handleCancel">{{ $t('public.cancel') }}</PtoButton>
        <PtoButton type="primary" @click="handleSave">{{ $t('public.save') }}</PtoButton>
      </div>
    </div>
    <d-form layout="vertical" size="sm" :data="configData">
      <d-tabs class="custom-tabs" v-model="activeTab">
        <template v-for="tab in tabs" :key="tab.index">
          <!-- 页签 -->
          <d-tab class="sub-form" :id="tab.index" :title="getLocalLabel(tab.label)">
            <template v-for="attribute in schema[tab.index].attributes" :key="attribute.key">
              <!-- 表单项 -->
              <d-form-item class="config-form-item" :field="attribute.key" :label="getLocalLabel(attribute.label)">
                <RunConfigController
                  :attribute="attribute"
                  :model-value="getValue(attribute)"
                  @update:model-value="updateValue(attribute, $event)"
                />
              </d-form-item>
            </template>
          </d-tab>
        </template>
      </d-tabs>
    </d-form>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { ConfigsForRevise, RunConfigAttribute } from 'ext:/types/config-schema';
import { RunConfigSchema, RunConfigViewServer } from 'ext:/view/servers/run-config-view-server';

import PtoButton from '@/components/ui/PtoButton.vue';
import { useViewServer } from '@/core/use-view-server';

import RunConfigController from './RunConfigController.vue';

type Label = { zh: string; en: string };

const { locale } = useI18n();
function getLocalLabel(label: Label): string {
  return locale.value === 'zh' ? label.zh : label.en;
}

const { server } = useViewServer<RunConfigViewServer>();
const { filename, filepath } = server;

const schema = ref<RunConfigSchema>({});
const configData = ref<Partial<ConfigsForRevise>>({});

onMounted(async () => {
  schema.value = await server.getSchema();
  initializeTabs();
  configData.value = await server.getConfigData();
});

type UpdateTabValue = <T extends RunConfigAttribute<any>>(attribute: T, value: T['defaultValue']) => void;
type Tab = { index: string; label: Label };

const tabs = ref<Tab[]>();
const activeTab = ref<string>();
function initializeTabs() {
  tabs.value = Object.keys(schema.value).map((tabKey) => {
    return { index: tabKey, label: schema.value[tabKey].label };
  });
  activeTab.value = tabs.value[0].index;
}

function getValue<T extends RunConfigAttribute<any>>(attribute: T): T['defaultValue'] {
  const keyPath = attribute.key.split('.');
  return keyPath.reduce((res, subKey) => res?.[subKey], configData.value) ?? attribute.defaultValue;
}

function updateValue<T extends RunConfigAttribute<any>>(attribute: T, value: T['defaultValue']): void {
  const keyPath = attribute.key.split('.');
  let parentObject = configData.value;
  keyPath.slice(0, -1).forEach((subKey) => {
    if (!Reflect.has(parentObject, subKey)) {
      Reflect.set(parentObject, subKey, {});
    }
    parentObject = Reflect.get(parentObject, subKey);
  });
  Reflect.set(parentObject, keyPath.at(-1), value);
}

async function handleSave() {
  const success = await server.saveConfigData(configData.value);
  if (success) {
    // TODO: 提示保存成功
  } else {
    // TODO: 提示保存失败
  }
}

function handleCancel() {
  server.close();
}

function handleViewSourceFile() {
  server.viewSourceFile();
}
</script>

<style scoped lang="less">
.config-containt {
  width: 100vw;
  height: 100vh;
  color: var(--pto-font-color-title);
  box-sizing: border-box;
  padding: 16px;

  // 颜色等高保真统一适配主题
  .header-panel {
    width: 100%;
    height: 58px;
    display: flex;
    justify-content: space-between;

    &__title {
      height: 26px;
      line-height: 26px;
      font-size: 18px;
      font-weight: 700;
    }

    &__file-path {
      margin-top: 8px;
      font-size: 12px;
      color: var(--pto-font-color-sub);
    }
  }

  .custom-tabs {
    :deep(.devui-tabs__nav--tabs) {
      li {
        margin-left: 24px;

        &:first-child {
          margin-left: 0;
        }

        &.active,
        &:hover:not(.disabled) {
          a {
            color: var(--pto-font-color-title);
          }

          &::after {
            background-color: var(--pto-font-color-title);
          }
        }
      }
    }
  }

  .sub-form {
    padding: 8px;
  }
}
</style>
