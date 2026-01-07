<template>
  <div class="config-containt">
    <div class="header-panel">
      <div class="header-panel__left">
        <div class="header-panel__title">{{ filename }}</div>
        <div class="header-panel__file-path">{{ `${$t('runConfig.filepathLabel')}${filepath}` }}</div>
      </div>
      <div class="header-panel__right">
        <PtoButton type="text" @click="handleViewSourceFile">{{ $t('runConfig.viewSourceFile') }}</PtoButton>
        <template v-if="schema">
          <PtoButton @click="handleCancel">{{ $t('public.cancel') }}</PtoButton>
          <PtoButton type="primary" @click="handleSave">{{ $t('public.save') }}</PtoButton>
        </template>
      </div>
    </div>
    <d-form v-if="schema" class="tab-form" layout="vertical" size="normal" :data="configData">
      <d-tabs class="custom-tabs" v-model="activeTab">
        <template v-for="tab in schema" :key="tab.key">
          <!-- 页签 -->
          <d-tab class="sub-form" :id="tab.key" :title="tab.label">
            <template v-for="attribute in tab.attributes" :key="attribute.key">
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
    <div v-else class="no-schema-tip">{{ $t('runConfig.noSchemaFound') }}</div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { RunConfigSchema, RunConfigAttribute } from 'ext:/types/config-schema';
import { RunConfigViewServer } from 'ext:/view/servers/run-config-view-server';

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

const schema = ref<RunConfigSchema | null>([]);
const configData = ref<object>({});

onMounted(async () => {
  schema.value = await server.getSchema();
  initializeTabs();
  configData.value = await server.getConfigData();
});

type Tab = { index: string; label: string };

const tabs = ref<Tab[]>();
const activeTab = ref<string>();
function initializeTabs() {
  tabs.value = schema.value.map(({ key, label }) => {
    return { index: key, label: label };
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

function handleSave() {
  server.saveConfigData(configData.value);
}

function handleCancel() {
  server.cancelEdit();
}

function handleViewSourceFile() {
  server.openSourceFile();
}
</script>

<style scoped lang="less">
.config-containt {
  width: 100vw;
  height: 100vh;
  color: var(--pto-font-color-title);
  box-sizing: border-box;
  padding: 16px;
}

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

.tab-form {
  height: calc(100% - 58px);

  .custom-tabs {
    height: 100%;

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

    .sub-form {
      height: calc(100% - 44px);
      padding: 8px;
      overflow-y: auto;
    }
  }
}

.no-schema-tip {
  font-size: 16px;
  padding: 8px;
}
</style>
