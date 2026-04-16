<template>
  <div :class="['statistic-card', type, { active: activeType === type,clickable: clickable }]" @click="handleCard">
    <div class="text-wrap">
      <div class="title">
        {{ type }}
        <span style="color:rgba(128,128,128,1)">{{ t(`controlFlows.accuracyVerificationResultsTips.${type}`) }}</span>
      </div>
      <div :class="['count', type]">{{ count }}</div>
    </div>
    <div class="icon-wrap">
      <div v-if="type === 'FAIL'" class="fail-icon-wrap">
        <i class="icon icon-error"></i>
      </div>
      <div v-if="type === 'PASS'" class="pass-icon-wrap">
        <i class="icon icon-right"></i>
      </div>
      <div v-if="type === 'SKIP'" class="skip-icon-wrap">
        <i class="icon icon-forbidding"></i>
      </div>
      <div v-if="type === 'EXCEPTION'" class="warning-icon-wrap">
        <svg width="32" height="32" viewBox="-8 -8 48 48">
          <polygon stroke-linejoin="round" points="16,0 0,32 32,32"></polygon>
        </svg>
        <i class="icon icon-warning"></i>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const props = defineProps({
  type: String,
  count: Number,
  activeType: String,
  clickable: {
    type: Boolean,
    default: true
  }
});

const emits = defineEmits(['handleCard'])
const handleCard = () => {
  emits('handleCard', props.type)
}
</script>

<style lang="scss" scoped>
.statistic-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 220px;
  height: 90px;
  padding: 16px;
  margin-bottom: 8px;
  border-radius: 12px;

  &.clickable {
    cursor: pointer;
  }

  &.active {
    border: 2px solid;
  }

  &.FAIL {
    background: linear-gradient(211.80deg, rgba(231, 67, 74, 0.05), rgba(231, 67, 74, 0) 100%),var(--control-flow-tab-bg);

    &.active {
      border-color: rgba(199, 91, 96, 1);
    }
  }

  &.SKIP {
    background: linear-gradient(206.57deg, rgba(179, 179, 179, 0.05), rgba(179, 179, 179, 0) 100%), var(--control-flow-tab-bg);

    &.active {
      border-color: rgba(179, 179, 179, 1);
    }
  }

  &.EXCEPTION {
    background: linear-gradient(206.57deg, rgba(246, 158, 57, 0.05), rgba(246, 158, 57, 0) 100%),var(--control-flow-tab-bg);

    &.active {
      border-color: rgba(246, 158, 57, 1);
    }
  }

  &.PASS {
    background: linear-gradient(206.57deg, rgba(135, 255, 54, 0.05), rgba(135, 200, 89, 0) 100%),var(--control-flow-tab-bg);

    &.active {
      border-color: rgba(135, 200, 89, 1);
    }
  }

  .text-wrap {
    display: flex;
    flex-direction: column;
    color: var(--devui-primary-text);
    height: 100%;
    justify-content: space-between;

    .title {
      width: 145px;
      font-size: 12px;
    }

    .count {
      font-size: 24px;
      height: 32px;
      line-height: 32px;

      &.FAIL {
        color: rgba(231, 67, 74, 1);
      }

      &.SKIP {
        color: rgba(179,179, 179, 1);
      }

      &.EXCEPTION {
        color: rgba(246, 158, 57, 1);
      }

      &.PASS {
        color: rgba(135, 200, 89, 1);
      }
    }
  }

  .icon-wrap {
    .fail-icon-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 32px;
      height: 32px;
      border-radius: 100%;
      background-color: rgba(231, 98, 93, 0.2);

      i {
        font-size: 20px;
        color: rgba(231, 98, 93, 1);
      }
    }

    .pass-icon-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 32px;
      height: 32px;
      border-radius: 100%;
      background-color: rgba(135, 200, 89, 0.2);

      i {
        font-size: 20px;
        color: rgba(135, 200, 89, 1);
      }
    }

    .skip-icon-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 32px;
      height: 32px;
      border-radius: 25%;
      background-color: rgba(179, 179, 179, 0.2);

      i {
        font-size: 20px;
        color: rgba(179, 179, 179, 1);
      }
    }

    .warning-icon-wrap {
      position: relative;

      svg {
        fill: rgba(247, 132, 31, 1);
        stroke: rgba(247, 132, 31, 1);
        stroke-width: 10;
        opacity: 0.2;
      }

      i {
        position: absolute;
        top: calc(50% - 7px);
        left: calc(50% - 10px);
        font-size: 20px;
        color: rgba(247, 132, 31, 1);
      }
    }
  }
}
</style>
