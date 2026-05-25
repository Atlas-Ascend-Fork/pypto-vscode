import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { ViewServerContext } from '../../core/view/view-server-context';
import { MemoryTraceHandler } from '../../handler/memoryTraceHandler';


/**
 * MemoryTraceServer - 内存追踪视图服务
 */
@viewRefs(['Metadata', 'Timeline', 'BufferState', 'ErrorMessage', 'InitMemoryTraceFlag', 'ClockList', 'EventsAtClock'])
export class MemoryTraceServer extends ViewServer<import('./view-server-interface').IMemoryTraceApis, import('./view-server-interface').IMemoryTraceRefs> {
  viewType?: string;
  query?: any;

  public override created(ctx: ViewServerContext): void {
    console.log('[MemoryTrace] Step 1: Server created, viewType:', ctx.viewType);
    this.viewType = ctx.viewType;
    this.query =
      typeof ctx.fileUri?.query === 'string' ? this.safeParse(ctx.fileUri?.query) : ctx.fileUri?.query ?? {};
    this.getInitialData();
  }

  @viewApi()
  public getInitialData = async () => {
    let fsPath = this.query._path;
    if (!/_OoO_Memory_Trace\.json$/.test(fsPath)) {
      fsPath = fsPath.replace(/\.json$/, '_OoO_Memory_Trace.json');
    }
    if (fsPath) {
      console.log('[MemoryTrace] Step 2: Loading file:', fsPath);
      await MemoryTraceHandler.parse(fsPath);
      const metadata = await MemoryTraceHandler.getMetadata(this.query._path);
      this.setRef('Metadata', metadata);
      console.log('[MemoryTrace] Step 3: Data loaded');
    }
    this.setRef('InitMemoryTraceFlag', 'true');
  };

  @viewApi()
  public getMetadata = async () => {
    const metadata = await MemoryTraceHandler.getMetadata(this.query._path);
    this.setRef('Metadata', metadata);
  };


  // 按clock分好事件
  @viewApi()
  public getTimelineEvents = async () => {
    const events = await MemoryTraceHandler.getTimelineEvents(this.query._path);
    this.setRef('Timeline', events);
  };


  safeParse(str: string) {
    try {
      return JSON.parse(str);
    } catch {
      return {};
    }
  }
}
