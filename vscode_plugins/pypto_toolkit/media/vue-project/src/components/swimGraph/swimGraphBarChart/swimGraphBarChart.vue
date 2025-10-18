<template>
  <div ref="chartDiv" class="occupy-rate-container">
    <div class="occupy-rate-title">{{ chartTitle }}</div>
    <div class="row-coord">
      <div class="row-coord-num" 
        v-for="(coordIt, index) in rowCoordList" 
        :key="index"
        :style="{ left: rowCoordLoc[index]}">
        {{rowCoordList[index]}}
      </div>
    </div>
    <div class="occupy-rate-chart-container" ref="barChartContainerDiv">
      <div class="occupy-rate-chart-col-coord-container" ref="colCoordContainerDiv">
        <div class="occupy-rate-chart-col-coord" 
          v-for="(colCoordIt, index) in colCoordList"
          :key="index">
          {{colCoordIt}}
        </div>
      </div>
      <div class="occupy-rate-bar-container"
        :style="{ height: pmuRowCoordList.length * 36 + 4 + 'px'}">
        <div class="occupy-rate-bar-line"
          v-for="(lineLoc, index) in backLineLoc"
          :key="index"
          :style="{ left: lineLoc}"> 
        </div>

        <div class="occupy-rate-backbar"
          v-for="(dataLeft, index) in chartDataLeft"
          :key="index"
          :style="{ top: 8 + 36 * index + 'px'}">
          <div class="occupy-rate-bar" 
            :style="{ width: barWidthList[index] + 'px', background: pmuBarColorList[index]}"></div>
          <div class="occupy-rate-cycle">{{ dataLeft }}</div>
          <div class="occupy-rate-percentage">{{ charDataRight[index] }}%</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, provide, inject} from 'vue';
import { useI18n } from 'vue-i18n';

const {pmuRowCoordList, pmuColCoordList, pmuRowCoordLoc, pmuBarColorList, pmuChartDataLeft, pmuChartDataRight, reportTitle, pmuBackLineLoc, isDarkTheme} = inject('swimGraphPmuBarChartInfo');

const chartDiv = ref(null);
const rowCoordList = ref([]);
const rowCoordLoc = ref([]);
const colCoordList = ref([]);
const chartTitle = ref('');
const chartDataLeft = ref([]);
const charDataRight = ref([]);
const barColorList = ref([]);
const backLineLoc = ref([]);
const barWidthList = ref([]);

let chartDivWidth = 470;
if (chartDiv.value) {
  chartDivWidth = chartDiv.value.offsetWidth;
}

const barChartContainerDivWidth = 340;

rowCoordList.value = pmuRowCoordList.value;
rowCoordLoc.value = pmuRowCoordLoc.value;
colCoordList.value = pmuColCoordList.value;
chartTitle.value = reportTitle.value;
chartDataLeft.value = pmuChartDataLeft.value;
charDataRight.value = pmuChartDataRight.value;
backLineLoc.value = pmuBackLineLoc.value;

for (const percent of pmuChartDataRight.value) {
  barWidthList.value.push(barChartContainerDivWidth * percent / 100);
}

</script>

<style scoped>
.occupy-rate-container {
  width: 470;
}

.occupy-rate-title {
  height: 20px;
  margin-left: 20px;
  margin-top: 16px;
  font-size: 12px;
  font-weight: 700;
  color: var(--vscode-badge-foreground);
}

.row-coord {
  margin-left: 121px;
  margin-top: 8px;
  height: 18px;
  width: 350px;
  display: flex;
  flex-direction: row;
  position: relative;
}

.row-coord-num {
  width: 23px;
  height: 18px;
  color: rgba(153, 153, 153, 1);
  font-size: 12px;
  font-weight: 400;
  position: absolute;
}

.occupy-rate-chart-container {
  margin-left: 20px;
  display: flex;
  flex-direction: row;
  width: 440px;
  height: 220px;
}

.occupy-rate-chart-col-coord-container {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.occupy-rate-chart-col-coord {
  width: 90px;
  height: 20px;
  color: rgba(153, 153, 153, 1);
  font-size: 14px;
  font-weight: 400;
}

.occupy-rate-bar-container {
  margin-left: 10px;
  position: relative;
  width: 340px;
  height: 220px;
}

.occupy-rate-bar-line {
  z-index: 1;
  width: 1px;
  height: 220px;
  border-left: 1px dashed var(--devui-slider-bar);
  opacity: 0.1;
  position: absolute;
  bottom: 0;
  top: 0;
}

.occupy-rate-backbar {
  z-index: 0;
  width: 340px;
  height: 24px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  backdrop-filter: blur(10px);
  position: absolute;
  bottom: 0;
  left: 0;
}

.occupy-rate-bar {
  height: 24px;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  z-index: 2;
  position: absolute;
  left: 0;
  top: 0;
}

.occupy-rate-cycle {
  height: 12px;
  font-size: 12px;
  font-weight: 400;
  color: var(--vscode-badge-foreground);
  position: absolute;
  left: 8px;
  top: 4px;
  z-index: 3;
}

.occupy-rate-percentage {
  height: 12px;
  font-size: 12px;
  font-weight: 400;
  position: absolute;
  color: var(--vscode-badge-foreground);
  right: 8px;
  top: 4px;
  z-index: 3;
}
</style>