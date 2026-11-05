/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * 异步解析列表
 */
export interface AsyncListResolver<T, R> {
  /** 是否正在解析 */
  isResolving: () => boolean;

  /** 开始解析 */
  start: (targetList: T[]) => Promise<R[]>;

  /** 等待指定数量的单元解析完成 */
  waitFor: (length: number) => Promise<R[]>;

  /** 停止解析 */
  stop: () => Promise<R[]>;
}

type AsyncListItemHandler<T, R> = (row: T) => Promise<{ skip?: boolean; data: R } | { skip: true; data?: R }>;

export class AsyncListResolverImpl<T, R> implements AsyncListResolver<T, R> {
  /** 执行中的解析任务 */
  private _resolvingTask: Promise<R[]> | null = null;

  /** 已解析列表 */
  private _resolvedList: R[] = [];

  /** 等待一定数量解析完成（waitFor） */
  private _partialResolvers: Map<number, ((list: R[]) => void)[]> = new Map();

  /** 当前解析任务是否收到停止请求 */
  private _cancelRequested = false;

  /**
   * @param listItemHandler 解析元素
   */
  constructor(private listItemHandler: AsyncListItemHandler<T, R>) {}

  public isResolving(): boolean {
    return Boolean(this._resolvingTask);
  }

  public start(targetList: T[]): Promise<R[]> {
    if (this._resolvingTask) {
      return this._resolvingTask;
    }
    this._resolvedList = [];
    this._cancelRequested = false;
    this._resolvingTask = Promise.resolve().then(async () => {
      for (const listItem of targetList) {
        const { skip, data } = await this.listItemHandler(listItem);
        if (!skip) {
          this._resolvedList.push(data);
          this.triggerPartialResolvers(this._resolvedList.length);
        }
        if (this._cancelRequested) {
          break;
        }
      }
      return this._resolvedList;
    }).then((res) => {
      // 异步执行，避免targetList为空时，_resolvingTask赋值顺序错误
      this._resolvingTask = null;
      this.triggerAllPartialResolvers();
      return res;
    });
    return this._resolvingTask;
  }

  public waitFor(length: number): Promise<R[]> {
    return new Promise<R[]>((resolve) => {
      if (!this._resolvingTask || this._resolvedList.length >= length) {
        resolve(this._resolvedList.slice(0, length));
        return;
      }
      this.setPartialResolver(length, resolve);
    });
  }

  public stop(): Promise<R[]> {
    if (!this._resolvingTask) {
      return Promise.resolve(this._resolvedList);
    }
    this._cancelRequested = true;
    return this._resolvingTask;
  }

  /**
   * 设置waitFor
   * @param length
   * @param resolve
   */
  private setPartialResolver(length: number, resolve: (list: R[]) => void): void {
    if (!this._partialResolvers.has(length)) {
      this._partialResolvers.set(length, []);
    }
    this._partialResolvers.get(length)?.push(resolve);
  }

  /**
   * 触发waitFor
   */
  private triggerPartialResolvers(length: number): void {
    const resolvers = this._partialResolvers.get(length);
    if (!resolvers) {
      return;
    }
    for (const resolver of resolvers) {
      resolver(this._resolvedList);
    }
    this._partialResolvers.delete(length);
  }

  /**
   * 触发所有waitFor
   */
  private triggerAllPartialResolvers(): void {
    for (const resolvers of this._partialResolvers.values()) {
      for (const resolver of resolvers) {
        resolver(this._resolvedList);
      }
    }
    this._partialResolvers.clear();
  }
}
