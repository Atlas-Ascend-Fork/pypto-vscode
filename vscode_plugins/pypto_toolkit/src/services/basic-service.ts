import * as vscode from 'vscode';

const startedServices = new Set<string>();

export class BasicService extends vscode.Disposable {
  protected _disposables: vscode.Disposable[] = [];

  constructor(public name: string) {
    super(() =>
      this._disposables.forEach((item) => {
        return item.dispose();
      }),
    );
    if (this.isStartedService()) {
      this.multiInstantiateError();
    }
    this.recordStartedService();
  }

  protected isStartedService(): boolean {
    return startedServices.has(this.name);
  }

  private multiInstantiateError() {
    throw new Error(`进程中只允许实例化一次service，${this.name} 已存在`);
  }

  private recordStartedService() {
    startedServices.add(this.name);
  }
}
