import * as vscode from 'vscode';

const startedServices = new Set<string>();

export abstract class BasicService extends vscode.Disposable {
  /** 服务名称，全局唯一 */
  public abstract name: string;

  constructor(callOnDispose: () => any) {
    super(callOnDispose);
    if (this.isStartedService()) {
      this.multiInstantiateError();
    }
    this.recordStartedService();
  }

  private isStartedService(): boolean {
    return startedServices.has(this.name);
  }

  private multiInstantiateError() {
    throw new Error(`进程中只允许实例化一次service，${this.name} 已存在`);
  }

  private recordStartedService() {
    startedServices.add(this.name);
  }
}
