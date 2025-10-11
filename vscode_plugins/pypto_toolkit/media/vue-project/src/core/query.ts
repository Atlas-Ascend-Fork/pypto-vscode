import type { ViewQuery } from '../../../../src/core/viewQuery';

import { ExtensionConnector } from './connector';
import { vscode } from './vscode';

let resolveQuery: (value: ViewQuery) => void;
let thenableQuery: Promise<ViewQuery> = new Promise((resolve) => {
  resolveQuery = resolve;
});

/**
 * 初始化，向extension端通知页面已加载完成，并记录返回query
 */
export function initExtensionQuery() {
  const queryConnector = new ExtensionConnector<null, ViewQuery>('viewQuery');

  // 推送消息通知webview已加载
  queryConnector.send(null);

  queryConnector.receive((query) => {
    vscode.value.setState({ query });
    resolveQuery(query);
  });
}

/**
 * 获取query
 */
export function getQuery(): Promise<ViewQuery> {
  return thenableQuery;
}
