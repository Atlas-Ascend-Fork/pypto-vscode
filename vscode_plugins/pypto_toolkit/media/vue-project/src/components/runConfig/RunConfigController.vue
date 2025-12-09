<script setup lang="ts" generic="T extends RunConfigAttribute<any>">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { RunConfigAttribute, RunConfigAttributeType } from 'ext:/types/config-schema';

const props = defineProps<{
  attribute: T;
}>();
const modelValue = defineModel<T['defaultValue']>();

const { locale } = useI18n();
function getLocalLabel(label: { zh: string; en: string }): string {
  return locale.value === 'zh' ? label.zh : label.en;
}

const stringArrayModel = computed<string>({
  get: () => (modelValue.value instanceof Array ? modelValue.value.join('\n') : ''),
  set: (newValue: String) => (modelValue.value = newValue.split('\n')),
});

function isType<T extends RunConfigAttributeType>(attribute: RunConfigAttribute<any>, type: T): attribute is RunConfigAttribute<T> {
  return attribute.type === type;
}
</script>

<template>
  <!-- 开关 boolean -->
  <d-switch v-if="isType(attribute, 'boolean')" v-model="modelValue" />
  <!-- 输入框 string -->
  <d-input v-else-if="isType(attribute, 'string')" :placeholder="$t('public.inputPlaceholder')" v-model="modelValue"></d-input>
  <!-- 单选 enum -->
  <d-radio-group v-else-if="isType(attribute, 'enum')" direction="row" v-model="modelValue">
    <template v-for="option in attribute.options">
      <d-radio :value="option.value">{{ getLocalLabel(option.label) }}</d-radio>
    </template>
  </d-radio-group>
  <!-- 数字输入框 int -->
  <d-input-number v-else-if="isType(attribute, 'int')" v-model="modelValue"></d-input-number>
  <!-- 文本域 array:string -->
  <d-textarea v-else-if="isType(attribute, 'array:string')" v-model="stringArrayModel"></d-textarea>
  <!-- 未知类型 -->
  <span v-else>{{ $t('runConfig.unknownDataType') }}</span>
</template>

<style lang="less" scoped>
.devui-input {
  width: 500px;
}

:deep(.devui-textarea) {
  width: 500px;
}
</style>
