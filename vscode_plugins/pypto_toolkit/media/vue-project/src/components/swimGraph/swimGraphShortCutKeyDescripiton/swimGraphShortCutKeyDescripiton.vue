<template>
  <div v-if="isShortcutKeyShow" class="shortCutKeyDescriptionEdit">
    <div class="shortCutKey-content">
      <div class="shortCutKey-head">
        <div class="shortCutKey-title"> {{ $t('ShortcutKeyDescription')}} </div>
        <div class="shortCutKey-close-button">
          <d-button icon="icon-close" style="width: 16px; font-size: 16px; border:none; background-color: transparent" @click="toggleShortcutKeyDescriptionModel"></d-button>
        </div>
      </div>
      <div v-if="isWarningNoteShow" class="shortCutKey-note">
        <div class="shortCutKey-note-content">
          <d-icon name="warning-triangle" size="16px" color="orange"></d-icon>
          <span class="warning-text">{{ generateWarningText() }}</span>
        </div>
      </div>
      <div class="shortCutKey-information">
        <div class="shortCutKey-mouse-key">
          <div class="shortCutKey-mouseContorl">
            <div class="mousecontorl"> {{ $t('MouseControl') }} </div>
            <div class="verticalmovement">
              <span class="verticalmovement-text">{{ $t('VerticalMovement') }}</span>
              <img class="verticalmovement-img" :src="mouse_scrollwheel_Imgpath" alt="verticalmovement-img"> 
            </div>
            <div class="singleandboxselection">
              <span class="singleandboxselection-text">{{ $t('Single/BoxSelection') }}</span>
              <img class="singleandboxselection-img" :src="mouse_leftclick_Imgpath" alt="verticalmovement-img"> 
            </div>
          </div>
          <div class="shortCutKey-composeContorl">
            <div class="combinedcontrol"> {{ $t('CombinedControl') }} </div>
            <div class="lateralmovement">
              <span class="lateralmovement-text">{{ $t('LateralMovement') }}</span>
              <img class="LateralMovement-img1" :src="mouse_leftclick_Imgpath" alt="verticalmovement-img1">
              <img class="LateralMovement-img2" :src="ctrl_key_Imgpath" alt="verticalmovement-img2">  
            </div>
            <div class="scaling">
              <span class="scaling-text">{{ $t('Scaling') }}</span>
              <img class="scaling-img1" :src="mouse_scrollwheel_Imgpath" alt="scaling-img1">
              <img class="scaling-img2" :src="ctrl_key_Imgpath" alt="scaling-img2">
            </div>
            <div class="timemeasurement">
              <span class="timemeasurement-text">{{ $t('TimeMeasurement') }}</span>
              <img class="timemeasurement-img1" :src="mouse_leftclick_Imgpath" alt="timemeasurement-img1">
              <img class="timemeasurement-img2" :src="alt_key_Imgpath" alt="timemeasurement-img2">
            </div>
          </div>
        </div>
        <div class="shortCutKey-key">
          <div class="shortCutKey-keyboardContorl">
            <div class="keyboardcontrol"> {{ $t('KeyboardControl') }} </div>
            <div class="zoomin">
              <span class="zoomin-text">{{ $t('zoomIn') }}</span>
              <img class="zoomin-img" :src="w_key_Imgpath" alt="zoomin-img">
            </div>
            <div class="zoomout">
              <span class="zoomout-text">{{ $t('zoomOut') }}</span>
              <img class="zoomout-img" :src="s_key_Imgpath" alt="zoomout-img">
            </div>
            <div class="leftshifting">
              <span class="leftshifting-text">{{ $t('LeftMove') }}</span>
              <img class="leftshifting-img" :src="a_key_Imgpath" alt="leftshifting-img">
            </div>
            <div class="rightshifting">
              <span class="rightshifting-text">{{ $t('RightMove') }}</span>
              <img class="rightshifting-img" :src="d_key_Imgpath" alt="rightshifting-img">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted, provide } from 'vue';
import { useI18n } from 'vue-i18n';

import { useViewServer } from '../../../core/use-view-server';

const { server } = useViewServer();

const { t: $t } = useI18n();
const {
  isShortcutKeyShow,
  isDarkTheme
} = inject('swimGraphState');

const {
} = inject('swimGraphMethods');

const mouse_leftclick_Imgpath = ref(`${window.staticPath}/static-assets/mouse-leftclick-dark.svg`);
const mouse_scrollwheel_Imgpath = ref(`${window.staticPath}/static-assets/mouse-scrollwheel-dark.svg`);
const ctrl_key_Imgpath = ref(`${window.staticPath}/static-assets/Ctrl-dark-key.svg`);
const alt_key_Imgpath = ref(`${window.staticPath}/static-assets/Alt-dark-key.svg`);

const w_key_Imgpath = ref(`${window.staticPath}/static-assets/W-dark-key.svg`);
const a_key_Imgpath = ref(`${window.staticPath}/static-assets/A-dark-key.svg`);
const s_key_Imgpath = ref(`${window.staticPath}/static-assets/S-dark-key.svg`);
const d_key_Imgpath = ref(`${window.staticPath}/static-assets/D-dark-key.svg`);

const isWarningNoteShow = ref(false);
const zoomInShortcutKey = ref('');
const zoomOutShortcutKey = ref('');
const leftmoveShortcutKey = ref('');
const rightmoveShortcutkey = ref('');
const newShortcutkey = ref(new Map());

const verticalmovementDistance = ref(window.ascLang === 'zh' ? 72 : 68);
const singleandboxselectionDistance = ref(window.ascLang === 'zh' ? 67 : 58);
const lateralmovementDistance = ref(window.ascLang === 'zh' ? 40 : 38);
const scalingDistance = ref(window.ascLang === 'zh' ? 68 : 106);
const timemeasurementDistance = ref(window.ascLang === 'zh' ? 40 : 31);
const zoomInDistance = ref(window.ascLang === 'zh' ? 40 : 60);
const zoomOutDistance = ref(window.ascLang === 'zh' ? 40 : 49);
const leftshiftingDistance = ref(window.ascLang === 'zh' ? 40 : 50);
const rightshiftingDistance = ref(window.ascLang === 'zh' ? 40 : 41);

const toggleShortcutKeyDescriptionModel = () => {
    if (isShortcutKeyShow.value) {
        isShortcutKeyShow.value = !isShortcutKeyShow.value;
    }
};

const judgmentShortcutKey = () => {
  newShortcutkey.value.clear();
  if (zoomInShortcutKey.value && zoomInShortcutKey.value.toLowerCase() !== 'w') {
    isWarningNoteShow.value = true;
    newShortcutkey.value.set('zoomInShortcutKey', zoomInShortcutKey.value);
  }
  if (zoomOutShortcutKey.value && zoomOutShortcutKey.value.toLowerCase() !== 's') {
    isWarningNoteShow.value = true;
    newShortcutkey.value.set('zoomOutShortcutKey', zoomOutShortcutKey.value);
  }
  if (leftmoveShortcutKey.value && leftmoveShortcutKey.value.toLowerCase() !== 'a') {
    isWarningNoteShow.value = true;
    newShortcutkey.value.set('leftmoveShortcutKey', leftmoveShortcutKey.value);
  }
  if (rightmoveShortcutkey.value && rightmoveShortcutkey.value.toLowerCase() !== 'd') {
    isWarningNoteShow.value = true;
    newShortcutkey.value.set('rightmoveShortcutkey', rightmoveShortcutkey.value);
  }
};

const generateWarningText = () => {
  if ( newShortcutkey.value.size === 0 ) {
    return $t('ShortcutKeyNote');
  }
  let warningText = `${$t('ShortcutKeyNote')}: `;
  newShortcutkey.value.forEach((value, key) => {
    switch (key) {
      case 'zoomInShortcutKey':
        warningText += `${$t('zoomIn')}: ${value}; `;
        break;
      case 'zoomOutShortcutKey':
        warningText += `${$t('zoomOut')}: ${value}; `;
        break;
      case 'leftmoveShortcutKey':
        warningText += `${$t('LeftMove')}: ${value}; `;
        break; 
      case 'rightmoveShortcutkey':
        warningText += `${$t('RightMove')}: ${value}; `;
        break;
      default:
        break;
    }
  });

  return warningText.trim().replace(/;+$/, '');
};

const distanceSet = () => {
  document.documentElement.style.setProperty('--verticalmovementDistance', `${verticalmovementDistance.value}px`);
  document.documentElement.style.setProperty('--singleandboxselectionDistance', `${singleandboxselectionDistance.value}px`);
  document.documentElement.style.setProperty('--lateralmovementDistance', `${lateralmovementDistance.value}px`);
  document.documentElement.style.setProperty('--scalingDistance', `${scalingDistance.value}px`);
  document.documentElement.style.setProperty('--timemeasurementDistance', `${timemeasurementDistance.value}px`);
  document.documentElement.style.setProperty('--zoomInDistance', `${zoomInDistance.value}px`);
  document.documentElement.style.setProperty('--zoomOutDistance', `${zoomOutDistance.value}px`);
  document.documentElement.style.setProperty('--leftshiftingDistance', `${leftshiftingDistance.value}px`);
  document.documentElement.style.setProperty('--rightshiftingDistance', `${rightshiftingDistance.value}px`);
};

watch(isDarkTheme, () => {
  updateTheme();
});

const updateTheme = () => {
  const theme = isDarkTheme.value ? 'dark' : 'white';
  mouse_leftclick_Imgpath.value = `${window.staticPath}/static-assets/mouse-leftclick-${theme}.svg`;
  mouse_scrollwheel_Imgpath.value = `${window.staticPath}/static-assets/mouse-scrollwheel-${theme}.svg`;
  ctrl_key_Imgpath.value = `${window.staticPath}/static-assets/Ctrl-${theme}-key.svg`;
  alt_key_Imgpath.value = `${window.staticPath}/static-assets/Alt-${theme}-key.svg`;
    
  w_key_Imgpath.value = `${window.staticPath}/static-assets/W-${theme}-key.svg`;
  a_key_Imgpath.value = `${window.staticPath}/static-assets/A-${theme}-key.svg`;
  s_key_Imgpath.value = `${window.staticPath}/static-assets/S-${theme}-key.svg`;
  d_key_Imgpath.value = `${window.staticPath}/static-assets/D-${theme}-key.svg`;
};

onMounted(() => {
  server.getSwimData().then((newValue) =>{
    zoomInShortcutKey.value = newValue.configration['ZoomInShortcut'];
    zoomOutShortcutKey.value = newValue.configration['ZoomOutShortcut'];
    leftmoveShortcutKey.value = newValue.configration['leftmoveShortcut'];
    rightmoveShortcutkey.value = newValue.configration['rightmoveShortcut'];
    judgmentShortcutKey();
    updateTheme();
  });
  distanceSet();
});

</script>

<style lang="scss">
@import url("../css/swimGraph/ShortCutKeyDescription/shortCutKeyDescriptions.css");

</style>