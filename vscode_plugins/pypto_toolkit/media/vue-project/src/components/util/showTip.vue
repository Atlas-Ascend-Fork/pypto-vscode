<template>
  <div class="node-rect" v-if="showNodeTip" :style="nodeTipStyle">
    <div class="title-rect" :style="{ backgroundColor: titleRectColor }">
      <div class="label-title">{{ titleLabels[0] }} </div>
      <div v-if="titleLabels[1]" class="sub-title">{{ titleLabels[1] }} </div>
      <div class="label-magic">{{ tipNodeMagic }} </div>
    </div>
    <div v-for="(lbl, idx) in currentLabels" :key="idx" class="label-line">
      <span class="key">{{ lbl.split(':')[0] }}:</span>
      <span class="val">{{ lbl.split(':').slice(1).join(':') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">

import { onMounted, ref, computed } from 'vue';
import { comGraphStore } from '../../service/com-graph-store';


const showNodeTip = ref(false);
const nodeTipWidth = ref(0);
const nodeTipHeight = ref(0);
const nodeTipLeft = ref(0);
const nodeTipTop = ref(0);
const tipColor = ref('');
const titleLabels = ref<string[]>([]);
const currentLabels = ref<string[]>([]);
const tipNodeMagic = ref('0');
const titleRectColor = ref('');
const scale = ref(1);
let timer;

const nodeTipStyle = computed(() => ({
  left: `${nodeTipLeft.value}px`,
  top: `${nodeTipTop.value}px`,
  width: `${nodeTipWidth.value}px`,
  height: `${nodeTipHeight.value}px`,
  backgroundColor: tipColor.value,
  transform: `scale(${scale.value})`,
}));

const showTip = (target) => {
  const screenZoom = window.devicePixelRatio;
  if (screenZoom < 1.25) {
    scale.value = 1.25 / screenZoom;
  }
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
  let tipLeft = -target.parent.scroll.x * target.parent.zoom +
    target.position.x * target.parent.zoom - ((target.size.width * (1 - target.parent.zoom)) / 2) + initLeft;
  let tipTop = -target.parent.scroll.y * target.parent.zoom - target.size.height +
    target.position.y * target.parent.zoom + initTop - 32 * target.parent.zoom - ((target.size.height) * (scale.value - 1) / 2);

  const containerEl = document.querySelector('.com-graph-container');
  if (containerEl) {
    const cRect = containerEl.getBoundingClientRect();
    const cLeft = cRect.left;
    const cRight = cRect.right;
    const cTop = cRect.top;
    const cBottom = cRect.bottom;

    const tipW = nodeTipWidth.value * scale.value;
    const tipH = nodeTipHeight.value * scale.value;

    /* 1. 顶部溢出 → 放目标下方 */
    if (tipTop < cTop) {
      const targetTop = -target.parent.scroll.y * target.parent.zoom
        + target.position.y * target.parent.zoom + initTop;
      const targetBottom = targetTop + target.size.height * target.parent.zoom;
      tipTop = targetBottom + target.size.height * target.parent.zoom / 2;
    }

    /* 2. 左侧溢出 → 放目标正右边 */
    if (tipLeft < cLeft) {
      const targetLeft = -target.parent.scroll.x * target.parent.zoom
        + target.position.x * target.parent.zoom + initLeft;
      const targetRight = targetLeft + target.size.width * target.parent.zoom;

      tipLeft = targetRight + target.size.width * target.parent.zoom / 2;
      const targetCenterY = -target.parent.scroll.y * target.parent.zoom
        + target.position.y * target.parent.zoom
        + initTop
        + (target.size.width * target.parent.zoom) / 2;
      tipTop = targetCenterY - tipH / 2;
    }

    /* 3. 右侧溢出 → 放目标正左边 */
    if (tipLeft + tipW > cRight) {
      const targetLeft = -target.parent.scroll.x * target.parent.zoom
        + target.position.x * target.parent.zoom + initLeft;
      tipLeft = targetLeft - tipW;

      const targetCenterY = -target.parent.scroll.y * target.parent.zoom
        + target.position.y * target.parent.zoom
        + initTop
        + (target.size.height * target.parent.zoom) / 2;
      tipTop = targetCenterY - tipH / 2;
    }
  }

  nodeTipLeft.value = tipLeft;
  nodeTipTop.value = tipTop;

  tipNodeMagic.value = target.magic;
  const targetTitle = target.children?.[0].children?.[0];
  const metaDataId = target.children?.[0].children?.[1]?.id ?? '';
  const targetLabelAll = target.children?.[0].children?.[1]?.children ?? [];
  const selSet = new Set(comGraphStore.data.selectCustom);

  const targetLabel = (!metaDataId.includes('metadata-compartment') || (!targetLabelAll.length) || (selSet.size === 0))
    ? targetLabelAll
    : targetLabelAll.filter((_, idx) => selSet.has(idx));
  titleLabels.value = [];
  currentLabels.value = [];
  titleLabels.value.push(targetTitle.text);
  if (target.role == 'input' || target.role == 'output') {
    tipColor.value = 'var(--devui-node-bg)';
    titleRectColor.value = 'var(--devui-node-bg)';
  } else {
    if (targetTitle.text.startsWith('CALL')) {
      const subgraphidStr = `Subgraph ID:    ${JSON.stringify(targetTitle.subgraphId)}`;
      titleLabels.value.push(subgraphidStr);
    }
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
}

onMounted(() => {
  (window as any).ascEventBus.on('closeNodeTip', (flag) => {
    clearTimeout(timer);
    showNodeTip.value = false;
  });
  (window as any).ascEventBus.on('showNodeTip', (target) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      showTip(target);
    }, 250);
  });
});

</script>

<style lang="scss">
@import '../../sprotty-graph/style/diagram.css';

.label-title {
  color: var(--devui-primary-text);
  display: flex;
  font-weight: 600;
  line-height: 15.67px;
  font-size: 9.91px;
  padding-left: 10px;
}

.sub-title {
  color: var(--devui-primary-text);
  font-weight: 400;
  line-height: 12.82px;
  margin-top: 4px;
  font-size: 8.55px;
  padding-left: 10px;
  white-space: pre;
}

.label-magic {
  position: absolute;
  color: var(--devui-text);
  right: 0px;
  top: 0px;
  font-size: 10px;
  padding: 4px;
  border-radius: 0 8px 0 8px;
  background-color: var(--devui-node-badge-bg);
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
  border-radius: 8px 8px 0 0;
  padding: 8px 0;
  position: relative;
}

.node-rect {
  position: absolute;
  left: 100px;
  top: 100px;
  z-index: 20;
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