import * as vscode from 'vscode';

import { viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';

type Apis = never;
type Refs = {};

@viewRefs([])
export class ControlFlowViewServer extends ViewServer<Apis, Refs> {}
