import { Hct } from '@material/material-color-utilities';

function hctToHex(hue, chroma, tone) {
  // 创建Hct对象并设置参数（库会自动处理色域外值）
  const hctColor = Hct.from(hue, chroma, tone);

  // 转换为ARGB整数（0xAARRGGBB格式）
  const argb = hctColor.toInt();

  // 提取RGB分量并转换为HEX
  const red = (argb >> 16) & 0xff;
  const green = (argb >> 8) & 0xff;
  const blue = argb & 0xff;

  return `#${red.toString(16).padStart(2, '0')}` +
    `${green.toString(16).padStart(2, '0')}` +
    `${blue.toString(16).padStart(2, '0')}`;
}


function hexToHct(hex) {
  const argb = hexToArgb(hex);
  const hct = Hct.fromInt(argb);
  
  return {
    hue: hct.hue,
    chroma: hct.chroma,
    tone: hct.tone
  };
}

function hexToArgb(hex) {
  let cleanHex = hex.replace('#', '');
  
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map(c => c + c)
      .join('');
  }
  cleanHex = 'FF' + cleanHex;
  
  return parseInt(cleanHex, 16);
}

export function getLighterColorByHex(color: string) {
  const hctColor = hexToHct(color);
  return hctToHex(hctColor.hue, hctColor.chroma, hctColor.tone + 20 > 100 ? 100 : hctColor.tone + 20);
}

export function generateColorList(count: number, isDark = true) {
  const baseColor = isDark ? [268, 47, 43] : [268, 67, 85];
  const baseLightColor = isDark ? [268, 47, 80] : [268, 67, 43];
  const originBaseColorList: string[] = [];
  const originLightColorList: string[] = [];
  const interval = Math.floor(360 / count) + 40;
  for (let index = 0; index < count; index ++) {
    originBaseColorList.push(hctToHex((baseColor[0] + interval * index) % 360, baseColor[1], baseColor[2]));
    originLightColorList.push(hctToHex((baseLightColor[0] + interval * index) % 360, baseLightColor[1], baseLightColor[2]));
  }
  return {
    baseColorList: originBaseColorList,
    lightColorList: originLightColorList
  }
}