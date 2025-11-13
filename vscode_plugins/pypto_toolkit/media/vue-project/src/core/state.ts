import { vscode } from './vscode';

/**
 * 增量更新state
 * @deprecated 尽量避免使用state缓存，容易导致全局冲突
 * @param newState 
 */
export function pushState(newState: object): void {
  const originalState = vscode.value.getState();
  vscode.value.setState({ ...originalState, ...newState });
}
