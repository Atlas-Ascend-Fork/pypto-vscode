import type { IBlockToGraphMap, GraphType } from './types';

export function findKeyByValue(obj: IBlockToGraphMap, value: GraphType) {
  return Object.keys(obj).find((key) => obj[key] === value);
}
