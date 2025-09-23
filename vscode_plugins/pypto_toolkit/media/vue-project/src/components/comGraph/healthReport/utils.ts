import type { ItemData } from './types';

export function formatData(data) {
  return Array.isArray(data) ? data.length : data;
}

export function formateNum(num: number) {
  if (num === 0) {
    return num;
  } else {
    return num.toFixed(1) + '%';
  }
}

export function arrChange(arr: number[], len: number) {
  const newArr: ItemData[][] = [];
  while (arr.length > 0) {
    newArr.push(arr.splice(0, len).map((item) => ({ label: item })));
  }
  return newArr;
}
