<script setup lang="ts" generic="T extends RunConfigAttribute<any>">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { RunConfigAttribute, RunConfigAttributeType } from 'ext:/types/config-schema';

const props = defineProps<{
  attribute: T;
}>();
const modelValue = defineModel<T['defaultValue']>();

const basicModel = computed<T['defaultValue']>({
  get: () => modelValue.value ?? props.attribute.defaultValue,
  set: (newValue) => (modelValue.value = newValue),
});

const stringArrayModel = computed<string>({
  get: () => (basicModel.value instanceof Array ? basicModel.value.join('\n') : ''),
  set: (newValue) => (modelValue.value = newValue.split('\n') as unknown as T['defaultValue']),
});

// 国际化
const { locale } = useI18n();
function getLocalLabel(label: { zh: string; en: string }): string {
  return locale.value === 'zh' ? label.zh : label.en;
}

/**
 * 判断字段类型
 */
function isType<R extends RunConfigAttributeType>(attribute: RunConfigAttribute<any>, type: R): attribute is RunConfigAttribute<R> {
  return attribute.type === type;
}
</script>

<template>
  <!-- 开关 boolean -->
  <d-switch v-if="isType(attribute, 'boolean')" v-model="basicModel" />
  <!-- 输入框 string -->
  <d-input v-else-if="isType(attribute, 'string')" v-model="basicModel" :placeholder="$t('public.inputPlaceholder')"></d-input>
  <!-- 单选 enum -->
  <d-radio-group v-else-if="isType(attribute, 'enum')" direction="row" v-model="basicModel">
    <template v-for="option in attribute.options">
      <d-radio :value="option.value">
        <span>{{ option.value }}</span>
        <span class="radio-desc">{{ option.label ? ` (${getLocalLabel(option.label)})` : '' }}</span>
      </d-radio>
    </template>
  </d-radio-group>
  <!-- 数字输入框 int -->
  <d-input-number
    v-else-if="isType(attribute, 'number')"
    v-model="basicModel"
    :placeholder="$t('public.inputPlaceholder')"
  ></d-input-number>
  <!-- 文本域 array:string -->
  <d-textarea
    v-else-if="isType(attribute, 'array:string')"
    v-model="stringArrayModel"
    :placeholder="$t('public.inputPlaceholder')"
    :rows="5"
  ></d-textarea>
  <!-- 未知类型 -->
  <span v-else>{{ $t('runConfig.unknownDataType') }}</span>
</template>

<style lang="less" scoped>
.devui-switch {
  height: 20px;
  :deep(.devui-switch__wrapper) {
    height: 100%;
  }
}

.devui-input {
  width: 500px;

  &.devui-input--md {
    height: 28px;
  }

  :deep(.devui-input__wrapper) {
    background-color: var(--pto-background);
    border-color: var(--devui-form-control-bg, #ffffff);

    &.devui-input--glow-style:not(.devui-input--error):not(.devui-input--disabled):not(.devui-input--focus):hover {
      border-color: var(--devui-form-control-bg, #ffffff);
    }

    &.devui-input--focus:not(.devui-input--error) {
      border-color: var(--devui-form-control-line-active, #5e7ce0);
    }
  }

  &:hover {
    :deep(.devui-input__wrapper) {
      border-color: var(--devui-form-control-bg, #ffffff);
    }
  }
}

.devui-input-number {
  width: 150px;

  :deep(.devui-input-number__input-box:not(.disabled)) {
    background-color: var(--pto-background);
  }
}

:deep(.devui-textarea) {
  width: 500px;
  background-color: var(--pto-background);
  border-color: var(--devui-form-control-bg, #ffffff);

  &:focus {
    outline: none;
  }

  &.devui-textarea--glow-style:not(.devui-textarea--error):not(.devui-textarea--disabled):not(.devui-textarea--focus):hover {
    border-color: var(--devui-form-control-bg, #ffffff);
  }

  &.devui-textarea--focus:not(.devui-textarea--error) {
    border-color: var(--devui-form-control-line-active, #5e7ce0);
  }
}

:deep(.devui-radio) {
  .devui-radio__material {
    border: 1px solid;
    border-color: var(--pto-radio-border);
  }

  .devui-radio__label {
    color: var(--pto-font-color-main);
  }

  &.active {
    .devui-radio__material {
      background-color: #ffffff;
    }
  }
}

.radio-desc {
  color: var(--pto-font-color-sub);
}
</style>
