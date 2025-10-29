import * as vscode from 'vscode';
import { UriQuery } from '../view/view-query';

export const VIRTUAL_SCHEME = 'PyPTO';

/**
 * 生成虚拟uri
 * @param uri 原始文件uri
 * @param viewType 视图类型
 * @param subTitle 文件副标题
 * @param query 文件副标题
 * @returns 虚拟uri
 */
export function toVirtualUri(uri: vscode.Uri, viewType: string, subTitle: string, query?: Record<string, unknown>): vscode.Uri {
  const virtualPath = `${uri.path} - ${subTitle || viewType}`;
  const uriQuery: UriQuery = { ...query, _path: uri.fsPath, _viewType: viewType };
  return uri.with({ scheme: VIRTUAL_SCHEME, path: virtualPath, query: JSON.stringify(uriQuery) });
}

/**
 * 解析虚拟uri
 * @param virtualUri 虚拟uri
 * @returns 文件路径 && 视图类型
 */
export function fromVirtualUri(virtualUri: vscode.Uri): UriQuery {
  try {
    return JSON.parse(virtualUri.query);
  } catch {
    throw new Error('VirtualUri参数解析失败');
  }
}
