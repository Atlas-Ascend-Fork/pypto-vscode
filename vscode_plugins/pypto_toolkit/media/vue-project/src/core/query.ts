import type { ViewQuery } from 'ext:/core/view/view-query';

import { pushState } from './state';

const { _viewType, _uri } = window.extensionQuery;
pushState({ _viewType, _uri });

/**
 * 获取query
 */
export function getQuery(): Promise<ViewQuery> {
  return Promise.resolve(structuredClone(window.extensionQuery));
}
