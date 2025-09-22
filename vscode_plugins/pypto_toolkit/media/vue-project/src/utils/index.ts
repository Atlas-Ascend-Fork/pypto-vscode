const OFFSET = 20;
const SCALE = 100;
const defaultWidthMapStr = `007LLmW'55;N0500LLLLLLLLLL00NNNLzWW\\\\WQb\\0FWLg\\bWb\\WQ\\WrWWQ000CL5LLFLL0LL**F*gLLLL5F0LF\\FFF5.5N`;

function getTextWidthMap(mapStr: string) {
  const map: Record<string, number> = {};
  if (typeof JSON === 'undefined') {
    return map;
  }
  for (let i = 0; i < mapStr.length; i++) {
    const char = String.fromCharCode(i + 32);
    const size = (mapStr.charCodeAt(i) - OFFSET) / SCALE;
    map[char] = size;
  }
  return map;
}

const DEFAULT_TEXT_WIDTH_MAP = getTextWidthMap(defaultWidthMapStr);

/* 返回指定字符串的宽度，默认按字体大小为12计算总宽度 */
export function getTextWidth(text: string, fontSize = 12) {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const preCalcWidth = DEFAULT_TEXT_WIDTH_MAP[text[i]];
    width += preCalcWidth == null ? fontSize : preCalcWidth * fontSize;
  }
  return width;
}
