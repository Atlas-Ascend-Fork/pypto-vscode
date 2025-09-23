import { generateColorList } from '../../../utils/color-list';

const darkThemeColors = generateColorList(360);
const lithtThemeColors = generateColorList(360, false);
const darkThemeBaseColors = darkThemeColors.baseColorList;
const darkThemeLightColors = darkThemeColors.lightColorList;
const lightThemeBaseColors = lithtThemeColors.baseColorList;
const lightThemeLightColors = lithtThemeColors.lightColorList;

const getSubGraphId = (event) => {
  let subGraphId;
  if (event.args && event.args['ascend-hint']) {
    const subGraphArr = event.args['ascend-hint'].split(',');
    const subGraphItem = subGraphArr.find(item => item.includes('subGraphId'));
    subGraphId = subGraphItem ? subGraphItem.split(':')[1] : null;
  }
  if (!subGraphId) {
    const nameParts = event.name.split('(')[0].split('-');
    subGraphId = nameParts[nameParts.length - 1].trim();
  }
  return Number(subGraphId) || 15;
};

export const getEventColor = (event) => {
  const subGraphId = getSubGraphId(event);
  let dBaseColor = darkThemeBaseColors[subGraphId];
  let dLightColor = darkThemeLightColors[subGraphId];
  let lBaseColor = lightThemeBaseColors[subGraphId];
  let lLightColor = lightThemeLightColors[subGraphId];

  if (subGraphId > 360 && !dBaseColor) {
    dBaseColor = darkThemeBaseColors[subGraphId % 360];
    dLightColor = darkThemeLightColors[subGraphId % 360];
    lBaseColor = lightThemeBaseColors[subGraphId % 360];
    lLightColor = lightThemeLightColors[subGraphId % 360];
  }

  if (!dBaseColor || !dLightColor || !lBaseColor || !lLightColor) {
    dBaseColor = '#666666';
    dLightColor = '#666666';
    lBaseColor = '#666666';
    lLightColor = '#666666';
  }
  return { dark: { base: dBaseColor, light: dLightColor }, light: { base: lBaseColor, light: lLightColor } };
};
