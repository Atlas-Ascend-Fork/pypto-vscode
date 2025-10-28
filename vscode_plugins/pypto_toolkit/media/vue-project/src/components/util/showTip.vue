<template>
    <div class="node-rect" v-if="showNodeTip" :style="nodeTipStyle">
      <div class="title-rect" :style="{backgroundColor: titleRectColor, height: titleRectHeight + 'px'}">
        <div class="label-title" >{{ currentLabels[0] }} </div>
        <div class="sub-title">{{ currentLabels[1] }} </div>
        <div class="label-magic">{{ tipNodeMagic }} </div>
      </div>
      <div
        v-for="(lbl, idx) in currentLabels.slice(2)"
        :key="idx"
        class="label-line"
        >
        <span class="key">{{ lbl.split(':')[0] }}:</span>
        <span class="val">{{ lbl.split(':').slice(1).join(':') }}</span>
      </div>
    </div>
</template>

<script setup lang="ts">

import { onMounted, ref, computed } from 'vue';
import { debounce } from 'lodash-es';


const showNodeTip = ref(false);
const nodeTipWidth = ref(0);
const nodeTipHeight = ref(0);
const nodeTipLeft = ref(0);
const nodeTipTop = ref(0);
const tipColor = ref('');
const currentLabels = ref<string[]>([]);
const tipNodeMagic = ref('0');
const titleRectColor = ref('');
const titleRectHeight = ref(48);

const nodeTipStyle = computed(() => ({
  left: `${nodeTipLeft.value}px`,
  top: `${nodeTipTop.value}px`,
  width: `${nodeTipWidth.value}px`,
  height: `${nodeTipHeight.value}px`,
  backgroundColor: tipColor.value,
}));

onMounted(() => {
    
    (window as any).ascEventBus.on('closeNodeTip', (flag) => {
        showNodeTip.value = false;
    });
    (window as any).ascEventBus.on('showNodeTip', debounce((target) => {
        let initLeft = 0;
        let initTop = 0;
        if (target.parent.filePath) {
            if (target.parent.filePath == 'after') {
                const rect = document.querySelector('.diff-after-wrap')!.getBoundingClientRect();
                initLeft = rect?.left;
                initTop = rect?.top;
            }
            if (target.parent.filePath == 'before') {
                const rect = document.querySelector('.diff-before-wrap')!.getBoundingClientRect();
                initLeft = rect?.left;
                initTop = rect?.top;
            }
        }
        showNodeTip.value = true;
        nodeTipWidth.value = target.size.width;
        nodeTipHeight.value = target.size.height + 4;
        // left 定位到中间计算 positionX +  x / 2 - x * zoom / 2
        nodeTipLeft.value = -target.parent.scroll.x * target.parent.zoom + target.position.x * target.parent.zoom - ((target.size.width * (1 - target.parent.zoom)) / 2) + initLeft; 
        nodeTipTop.value = -target.parent.scroll.y * target.parent.zoom - target.size.height + target.position.y * target.parent.zoom - 32 * target.parent.zoom + initTop;
        tipNodeMagic.value = target.magic;
        const targetTitle = target.children?.[0].children?.[0];
        const targetLabel = target.children?.[0].children?.[1]?.children ?? [];
        currentLabels.value = [];
        currentLabels.value.push(targetTitle.text);
        if (target.size.height > 50) {
          titleRectHeight.value = 48;
        } else {
          titleRectHeight.value = 0;
        }
        if (target.role == 'input' || target.role == 'output') {
          const slotStr = `Slot ID:    ${JSON.stringify(targetTitle.slotId)}`;
          currentLabels.value.push(slotStr);
          tipColor.value = 'var(--devui-node-bg)';
          titleRectColor.value = 'var(--devui-node-bg)';
        } else {
          const subgraphidStr = `Subgraph ID:    ${JSON.stringify(targetTitle.subgraphId)}`;
          currentLabels.value.push(subgraphidStr);
          if (target.role == 'tensor') {
            tipColor.value = 'var(--devui-node-bg)';
          } else {
            tipColor.value = target.baseColor;
          }
          titleRectColor.value = target.baseColor;
        }
        for (const label of targetLabel) {
          currentLabels.value.push(label?.text);
        }
    }), 200);
});

</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';
.label-title {
  color: var(--devui-primary-text);
  display: flex;
  font-weight: 600;
  line-height: 15.67px;
  margin-bottom: 4px;
  font-size: 9.91px;
  padding-left: 10px;
  padding-top: 8px;
}

.sub-title {
  color: var(--devui-primary-text);
  font-weight: 400;
  line-height: 12.82px;
  margin-bottom: 12px;
  font-size: 8.55px;
  padding-left: 10px;
  white-space: pre;
}

.label-magic {
  position: absolute;
  color: var(--devui-text);
  right: 4px;
  top: 4px;
  font-size: 10px;
}

.label-line {
  position: relative;
  top: 0px;
  display: flex;
  align-items: center;
  font-size: 8.55px;
  white-space: nowrap;
  line-height: 12px;
  padding-top: 3px;
  padding-left: 10px;
}

.title-rect {
  width: 100%;
  height: 48px;
  border-radius: 8px 8px  0 0;
  top: 0;
  position: relative;
}

.node-rect {
  position: absolute;
  left: 100px;
  top: 100px;
  width: 100px;
  height: 100px;
  background-color: var(--devui-node-bg);
  border-radius: 8px;
}

.key {
  color: var(--devui-text);
  fill-opacity: 0.6;
  min-width: 7em;
  text-align: left;
  padding-right: 4px;
}

.val {
  color: var(--devui-primary-text);
  padding-left: 4px;
  font-weight: 400;
}

</style>