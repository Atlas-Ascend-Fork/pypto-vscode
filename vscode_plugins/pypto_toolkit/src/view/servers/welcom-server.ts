import path from 'node:path';

import * as vscode from 'vscode';

import { viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';

type Apis = never;
type Refs = { skipAll: boolean };

@viewRefs(['skipAll'])
export class WelcomeViewServer extends ViewServer<Apis, Refs> {
  static skipGuide: () => void;
  private fileUri: vscode.Uri;
  public override created(ctx: ViewServerContext): void {
    WelcomeViewServer.skipGuide = () => {
      this.setRef('skipAll', true);
    };
  }
}
