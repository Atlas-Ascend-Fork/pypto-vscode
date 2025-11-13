import { vscode } from './vscode';

/**
 * 增量更新state
 * @param newState 
 */
export function pushState(newState: object): void {
  const originalState = vscode.value.getState();
  vscode.value.setState({ ...originalState, ...newState });
}
