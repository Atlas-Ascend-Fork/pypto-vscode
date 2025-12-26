/**
 * 异步解析列表
 * @param targetList 目标列表
 * @param listItemHandler 解析列表元素
 * @returns 解析器
 */
export function asyncResolvingList<T>(targetList: T[], listItemHandler: AsyncListItemHandler<T, unknown>): AsyncListResolver<T, unknown> {
  const asyncListResolver = new AsyncListResolverImpl<T, unknown>(listItemHandler);
  asyncListResolver.start(targetList);
  return asyncListResolver;
}

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

class AsyncListResolverImpl<T, R> implements AsyncListResolver<T, R> {
  /** 执行中的解析任务 */
  private _resolvingTask: Promise<R[]> | null = null;

  /** 已解析列表 */
  private _resolvedList: R[] = [];

  /** 等待一定数量解析完成（waitFor） */
  private _partialResolvers: Map<number, ((list: R[]) => void)[]> = new Map();

  /** 等待取消解析 */
  private _cancelResolver: (() => void) | null = null;

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
    this._resolvingTask = new Promise(async (resolve) => {
      for (const listItem of targetList) {
        const { skip, data } = await this.listItemHandler(listItem);
        if (skip) {
          continue;
        }
        this._resolvedList.push(data);

        this.triggerPartialResolvers(this._resolvedList.length);
        if (this._cancelResolver) {
          break;
        }
      }
      this.triggerAllPartialResolvers();
      this._resolvingTask = null;
      resolve(this._resolvedList);
    });
    return this._resolvingTask;
  }

  public async waitFor(length: number): Promise<R[]> {
    if (!this._resolvingTask || this._resolvedList.length >= length) {
      return this._resolvedList.slice(0, length);
    }
    return new Promise<R[]>((resolve) => {
      this.setPartialResolver(length, resolve);
    });
  }

  public stop(): Promise<R[]> {
    if (!this._resolvingTask) {
      return Promise.resolve(this._resolvedList);
    }
    return new Promise((resolve) => {
      this._cancelResolver = () => {
        this._cancelResolver = null;
        resolve(this._resolvedList);
      };
    });
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
