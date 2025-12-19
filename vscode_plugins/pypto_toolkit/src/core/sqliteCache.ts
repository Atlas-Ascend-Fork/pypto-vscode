import * as vscode from 'vscode';
import * as path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { unlinkSync, existsSync, promises as fs } from 'fs';
import { t } from 'i18next';

interface ComGraphLayoutRow {
  file_path: string;
  func_hash: string;
  layout_result: string;
  last_change_time: string;
}
interface ComGraphFinalResultRow {
  file_path: string;
  func_hash: string;
  final_result: string;
  last_change_time: string;
}
interface ComGraphFuncDataRow {
  file_path: string;
  func_hash: string;
  call_hash_arr: string;
  data: string;
  big_data_file_path: string;
  last_change_time: string;
}

interface SwimGraphProcessRow {
  file_path: string;
  last_change_time: string;
  pid: number;
  process_name: string;
  color_rendering: string;
}

interface SwimGraphThreadRow {
  file_path: string;
  tid: number;
  last_change_time: string;
  thread_name: string;
  arg_key: string;
  is_counter: number;
  is_fake_core: number;
  max_count: number;
  pid: number;
  thread_id: number;
}

interface SwimGraphEventRow {
  file_path: string;
  last_change_time: string;
  id: string;
  args: string;
  predecessors: string;
  successors: string;
  duration: number;
  end_time: number;
  pid: number;
  tid: number;
  line: number;
  is_counter: number;
  is_fake_core: number;
  name: string;
  uid: string;
  render_end_time: number;
  render_start_time: number;
  start_time: number;
  thread_name: string;
  ts: number;
  leaf_index: string;
  thread_id: number;
  event_type: string;
  seq_no: number;
  task_id: number;
  color: string;
}

interface SwimGraphPmuRow {
  file_path: string;
  last_change_time: string;
  uid: string;
  sub_task_id: string;
  seq_no: string;
  thread_id: string;
  task_id: string;
  core_id: string;
  total_cycle: string;
  vec_busy_cycles: string;
  cube_busy_cycles: string;
  scalar_busy_cycles: string;
  mte1_busy_cycles: string;
  mte2_busy_cycles: string;
  mte3_busy_cycles: string;
  icache_miss: string;
  icache_req: string;
  cube_ratio: string;
  vec_ratio: string;
  scalar_ratio: string;
  mte1_ratio: string;
  mte2_ratio: string;
  mte3_ratio: string;
  icache_hit: string;
}

interface SwimGraphLane2lineRow {
  file_path: string;
  last_change_time: string;
  name: string;
  value: number;
}

interface SwimGraphParsedInfoRow {
  file_path: string;
  last_change_time: string;
  dyn_topo_last_change_time: string;
  pmu_last_change_time: string;
  info: string;
}

export class SQLiteCache {
  private static _instance: SQLiteCache;
  private db: Database | undefined;
  private readonly dbFile: string;

  private constructor(context: vscode.ExtensionContext) {
    // 把缓存文件放到 globalStorage 目录，用户无感知
    this.dbFile = path.join(context.globalStorageUri.fsPath, 'cache.db');
  }

  /** 单例获取 */
  public static getInstance(): SQLiteCache {
    if (!SQLiteCache._instance) {
      throw new Error('SQLiteCache has not been initialized yet!');
    }
    return SQLiteCache._instance;
  }

  /** 在 extension.ts 的 activate() 里调用一次即可 */
  public static async init(context: vscode.ExtensionContext): Promise<SQLiteCache> {
    if (SQLiteCache._instance) {
      return SQLiteCache._instance;
    }
    console.log('初始化缓存数据库');
    SQLiteCache._instance = new SQLiteCache(context);
    await SQLiteCache._instance.open();
    return SQLiteCache._instance;
  }

  /** 真正的初始化逻辑 */
  private async open() {
    // 确保目录存在
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(this.dbFile)));

    const SQL = await initSqlJs({
      locateFile: () => path.join(__dirname, '..', 'node_modules', 'sql.js', 'sql-wasm.wasm'),
    });

    let buf: Uint8Array | undefined;
    try {
      buf = await vscode.workspace.fs.readFile(vscode.Uri.file(this.dbFile));
    } catch {
      // 文件不存在，首次创建
    }

    this.db = new SQL.Database(buf);

    /****************** 1️⃣  可建多个表：按需添加 ******************/
    this.db.run(`
            CREATE TABLE IF NOT EXISTS com_graph_layout (
              file_path        TEXT NOT NULL,
              func_hash        TEXT NOT NULL DEFAULT '',
              layout_result    TEXT,
              last_change_time TEXT,
              PRIMARY KEY (file_path, func_hash)
            );
        `);
    this.db.run(`
            CREATE TABLE IF NOT EXISTS com_graph_final_result (
              file_path        TEXT NOT NULL,
              func_hash        TEXT NOT NULL DEFAULT '',
              final_result    TEXT,
              last_change_time TEXT,
              PRIMARY KEY (file_path, func_hash)
            );
        `);
    this.db.run(`
            CREATE TABLE IF NOT EXISTS com_graph_func_data (
              file_path          TEXT NOT NULL,
              func_hash          TEXT NOT NULL DEFAULT '',
              call_hash_arr      TEXT,
              data               TEXT,
              big_data_file_path TEXT,
              last_change_time   TEXT,
              PRIMARY KEY (file_path, func_hash)
            );
        `);
    this.db.run(`
            CREATE TABLE IF NOT EXISTS com_graph_file_hash_map (
                file_path        TEXT NOT NULL,
                data    TEXT,
                PRIMARY KEY (file_path)
            );
        `);
    this.db.run(`
            CREATE TABLE IF NOT EXISTS com_graph_file_callee_op_attr (
              calleehash TEXT NOT NULL,
              op_magic TEXT NOT NULL,
              op_subgraphid TEXT NOT NULL,
              op_attr      TEXT,
              ioperands      TEXT,
              PRIMARY KEY (calleehash,op_magic,op_subgraphid)
            );
        `);
    // 需要添加表就继续 this.db.run();

    //swimGraph Table

    //parsed swimlane info for each file
    this.db.run(`
        CREATE TABLE IF NOT EXISTS swimgraph_parsed_info (
            file_path TEXT NOT NULL,
            last_change_time TEXT,
            dyn_topo_last_change_time TEXT,
            pmu_last_change_time TEXT,
            info TEXT,
            PRIMARY KEY (file_path,last_change_time)
        );
    `);
  }

  public async creatLane2Line() {
    //lane2line
    this.db!.run(`
        CREATE TABLE IF NOT EXISTS swimgraph_lane2line (
            file_path TEXT NOT NULL,
            last_change_time TEXT,
            name TEXT NOT NULL,
            value INTEGER,
            PRIMARY KEY (file_path,name,last_change_time)
        );
    `);
  }

  public async createPmu() {
    // pmu信息
    this.db!.run(`
      CREATE TABLE IF NOT EXISTS swimgraph_pmu (
        file_path TEXT NOT NULL,
        last_change_time TEXT,
        uid TEXT NOT NULL,  
        sub_task_id TEXT NOT NULL,
        seq_no TEXT NOT NULL,
        thread_id TEXT,
        task_id TEXT,
        core_id TEXT,
        total_cycle TEXT,
        vec_busy_cycles TEXT,
        cube_busy_cycles TEXT,
        scalar_busy_cycles TEXT,
        mte1_busy_cycles TEXT,
        mte2_busy_cycles TEXT,
        mte3_busy_cycles TEXT,
        icache_miss TEXT,
        icache_req TEXT,
        cube_ratio REAL,
        vec_ratio REAL,
        scalar_ratio REAL,
        mte1_ratio REAL,
        mte2_ratio REAL,
        mte3_ratio REAL,
        icache_hit REAL,
        PRIMARY KEY (file_path,uid,last_change_time)
        );
    `);
  }

  public async createEvent() {
    //event uid: args.seqNo-args.taskId
    this.db!.run(`
        CREATE TABLE IF NOT EXISTS swimgraph_event (
            file_path TEXT NOT NULL,  
            last_change_time TEXT,
            id TEXT NOT NULL,
            args TEXT,
            predecessors TEXT,
            successors TEXT,
            duration REAL,
            end_time REAL,
            pid INTEGER,
            tid INTEGER,
            line INTEGER,
            is_counter INTEGER,
            is_fake_core INTEGER,
            name TEXT,
            uid TEXT,
            render_end_time REAL,
            render_start_time REAL,
            start_time REAL,
            thread_name TEXT,
            ts REAL,
            leaf_index TEXT,
            thread_id INTEGER,
            event_type TEXT,
            seq_no INTEGER,
            task_id INTEGER,
            color TEXT,
            PRIMARY KEY (file_path,pid,thread_id,id,last_change_time)
        );
    `);
  }

  public async createThread() {
    //thread
    this.db!.run(`
        CREATE TABLE IF NOT EXISTS swimgraph_thread (
            file_path TEXT NOT NULL,  
            tid INTEGER NOT NULL,
            last_change_time TEXT,
            thread_name TEXT,
            arg_key TEXT,
            is_counter INTEGER,
            is_fake_core INTEGER,
            max_count INTEGER,
            pid INTEGER,
            thread_id INTEGER,
            PRIMARY KEY (file_path,thread_id,pid,last_change_time)
        );
    `);
  }

  public async createProcess() {
    //process
    this.db!.run(`
        CREATE TABLE IF NOT EXISTS swimgraph_process (
            file_path TEXT NOT NULL,
            last_change_time TEXT,
            pid INTEGER NOT NULL,
            process_name TEXT,
            color_rendering TEXT,
            PRIMARY KEY (file_path,pid,last_change_time)
        );
    `);
  }

  /****************** 2️⃣  数据表 ******************/
  /****************** com_graph_layout 表 ******************/
  public async comGraphLayoutSet(filePath: string, funcHash: string, layoutResult: string, lastChangeTime: string): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO com_graph_layout(file_path,func_hash,layout_result,last_change_time) VALUES(?,?,?,?)', [
      filePath,
      funcHash,
      layoutResult,
      lastChangeTime,
    ]);
  }
  public async comGraphLayoutGet(filePath: string, funcHash: string): Promise<ComGraphLayoutRow | undefined> {
    return await this.retryOperation(async () => {
      const stmt = this.db!.prepare(
        'SELECT file_path,layout_result,last_change_time FROM com_graph_layout WHERE file_path=? and func_hash=?',
      );
      stmt.bind([filePath, funcHash]);
      let row: ComGraphLayoutRow | undefined;
      if (stmt.step()) {
        row = stmt.getAsObject() as unknown as ComGraphLayoutRow;
      }
      stmt.free();
      return row;
    }, 1, 100, (result) => !result, "comGraphLayoutGet");
  }
  public async comGraphLayoutDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_layout WHERE file_path=?', [filePath]);
  }

  /****************** com_graph_final_result 表 (未同步到diskCache.ts)******************/
  public async comGraphFinalResultSet(filePath: string, funcHash: string, finalResult: string, lastChangeTime: string): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO com_graph_final_result(file_path,func_hash,final_result,last_change_time) VALUES(?,?,?,?)', [
      filePath,
      funcHash,
      finalResult,
      lastChangeTime,
    ]);
  }
  public async comGraphFinalResultGet(filePath: string, funcHash: string): Promise<ComGraphFinalResultRow | undefined> {
    return await this.retryOperation(async () => {
      const stmt = this.db!.prepare(
        'SELECT file_path,final_result,last_change_time FROM com_graph_final_result WHERE file_path=? and func_hash=?',
      );
      stmt.bind([filePath, funcHash]);
      let row: ComGraphFinalResultRow | undefined;
      if (stmt.step()) {
        row = stmt.getAsObject() as unknown as ComGraphFinalResultRow;
      }
      stmt.free();
      return row;
    }, 1, 100, (result) => !result, "comGraphFinalResultGet");
  }
  public async comGraphFinalResultDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_final_result WHERE file_path=?', [filePath]);
  }
  /****************** com_graph_func_data 表 ******************/
  public async comGraphFuncDataSet(
    filePath: string,
    funcHash: string,
    callHashArr: string,
    data: string,
    bigDataFilePath: string,
    lastChangeTime: string,
  ): Promise<void> {
    this.db!.run(
      'INSERT OR REPLACE INTO com_graph_func_data(file_path,func_hash,call_hash_arr,data,big_data_file_path,last_change_time) VALUES(?,?,?,?,?,?)',
      [filePath, funcHash, callHashArr, data, bigDataFilePath, lastChangeTime],
    );
  }
  public async comGraphFuncDataGetCount(filePath: string): Promise<number> {
    return await this.retryOperation(async () => {
      const stmt = this.db!.prepare('SELECT COUNT(*) as cnt FROM com_graph_func_data WHERE file_path=? ');
      stmt.bind([filePath]);
      let count = 0;
      if (stmt.step()) {
        const row = stmt.getAsObject() as { cnt: string | number };
        count = Number(row.cnt);
      }
      stmt.free();
      return count;
    }, 1, 100, (result) => !result, "comGraphFuncDataGetCount");
  }
  public async comGraphFuncDataGet(filePath: string, funcHash: string): Promise<ComGraphFuncDataRow | undefined> {
    return await this.retryOperation(async () => {
      const stmt = this.db!.prepare(
        'SELECT file_path,func_hash,call_hash_arr,data,big_data_file_path,last_change_time FROM com_graph_func_data WHERE file_path=? and func_hash=?',
      );
      stmt.bind([filePath, funcHash]);
      let row: ComGraphFuncDataRow | undefined;
      if (stmt.step()) {
        row = stmt.getAsObject() as unknown as ComGraphFuncDataRow;
      }
      stmt.free();
      return row;
    }, 5, 100, (result) => !result, "comGraphFuncDataGet");
  }
  public async comGraphFuncDataDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_func_data WHERE file_path=?', [filePath]);
  }
  /****************** com_graph_file_hash_map 表 ******************/
  public async comGraphFileHashMapSet(filePath: string, data: string): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO com_graph_file_hash_map(file_path,data) VALUES(?,?)', [filePath, data]);
  }
  public async comGraphFileHashMapGet(filePath: string): Promise<string> {
    return await this.retryOperation(async () => {
      const stmt = this.db!.prepare('SELECT data FROM com_graph_file_hash_map WHERE file_path=?');
      stmt.bind([filePath]);
      let data = '';
      if (stmt.step()) {
        const row = stmt.getAsObject() as { data: string };
        data = row.data ?? '';
      }
      stmt.free();
      return data;
    }, 5, 100, (result) => !result, "comGraphFileHashMapGet");
  }
  public async comGraphFileHashMapDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_file_hash_map WHERE file_path=?', [filePath]);
  }
  /****************** com_graph_file_callee_op_attr 表 ******************/
  public async comGraphFileCalleeOpAttrSet(
    calleehash: string,
    opMagic: string,
    opSubgraphid: string,
    opAttr: string,
    ioperands: string,
  ): Promise<void> {
    this.db!.run(
      'INSERT OR REPLACE INTO com_graph_file_callee_op_attr(calleehash,op_magic,op_subgraphid,op_attr,ioperands) VALUES(?,?,?,?,?)',
      [calleehash, opMagic, opSubgraphid, opAttr, ioperands],
    );
  }
  public async comGraphFileCalleeOpAttrGet(calleehash: string, opMagic: string, opSubgraphid: string): Promise<string[]> {
    return await this.retryOperation(async () => {
      const stmt = this.db!.prepare(
        'SELECT op_attr,ioperands FROM com_graph_file_callee_op_attr WHERE calleehash=? AND op_magic=? AND op_subgraphid=?',
      );
      stmt.bind([calleehash, opMagic, opSubgraphid]);
      let row;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
      return row;
    }, 5, 100, (result) => !result, "comGraphFileCalleeOpAttrGet");
  }

  /****************** swimgraph_parsed_info 表 ******************/
  public async swimGraphParsedInfoSet(
    filePath: string,
    lastChangeTime: string,
    dynTopoLastChangeTime: string,
    pmuLastChangeTime: string,
    info: string,
  ): Promise<void> {
    this.db!.run(
      'INSERT OR REPLACE INTO swimgraph_parsed_info(file_path,last_change_time,dyn_topo_last_change_time,pmu_last_change_time,info) VALUES(?,?,?,?,?)',
      [filePath, lastChangeTime, dynTopoLastChangeTime, pmuLastChangeTime, info],
    );
  }

  public async swimGraphParsedInfoGetAll(): Promise<SwimGraphParsedInfoRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_parsed_info');
    const rows: SwimGraphParsedInfoRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphParsedInfoRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphParsedInfoGetByFilePath(filePath: string): Promise<SwimGraphParsedInfoRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_parsed_info WHERE file_path = ?');
    stmt.bind([filePath]);
    const rows: SwimGraphParsedInfoRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphParsedInfoRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphParsedInfoDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM swimgraph_parsed_info WHERE file_path = ?', [filePath]);
  }

  public async swimGraphParsedInfoDelByFilePath(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM swimgraph_parsed_info WHERE file_path = ?', [filePath]);
  }

  /****************** swimgraph_process 表 ******************/

  public async swimGraphProcessSet(
    filePath: string,
    lastChangeTime: string,
    pid: number,
    processName: string,
    colorRendering: string,
  ): Promise<void> {
    this.db!.run(
      'INSERT OR REPLACE INTO swimgraph_process(file_path,last_change_time,pid,process_name,color_rendering) VALUES(?,?,?,?,?)',
      [filePath, lastChangeTime, pid, processName, colorRendering],
    );
  }

  public async swimGraphProcessGetAll(): Promise<SwimGraphProcessRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_process');
    const rows: SwimGraphProcessRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphProcessRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphProcessGetByFilePath(filePath: string): Promise<SwimGraphProcessRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_process WHERE file_path = ?');
    stmt.bind([filePath]);
    const rows: SwimGraphProcessRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphProcessRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphProcessDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM swimgraph_process WHERE file_path=?', [filePath]);
  }

  /****************** swimgraph_thread 表 ******************/

  public async swimGraphThreadSet(
    filePath: string,
    tid: number,
    lastChangeTime: string,
    threadName: string,
    argKey: string,
    isCounter: number,
    isFakeCore: number,
    maxCount: number,
    pid: number,
    threadId: number,
  ): Promise<void> {
    this.db!.run(
      'INSERT OR REPLACE INTO swimgraph_thread(file_path,tid,last_change_time,thread_name,arg_key,is_counter,is_fake_core,max_count,pid,thread_id) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [filePath, tid, lastChangeTime, threadName, argKey, isCounter, isFakeCore, maxCount, pid, threadId],
    );
  }

  public async swimGraphThreadGetAll(): Promise<SwimGraphThreadRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_thread');
    const rows: SwimGraphThreadRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphThreadRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphThreadGetByFilePath(filePath: string): Promise<SwimGraphThreadRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_thread WHERE file_path = ?');
    stmt.bind([filePath]);
    const rows: SwimGraphThreadRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphThreadRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphThreadGetByFilePathPid(filePath: string, pid: number): Promise<SwimGraphThreadRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_thread WHERE file_path = ? AND pid = ?');
    stmt.bind([filePath, pid]);
    const rows: SwimGraphThreadRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphThreadRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphThreadDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM swimgraph_thread WHERE file_path=?', [filePath]);
  }

  /****************** swimgraph_event 表 ******************/
  public async swimGraphEventSet(
    filePath: string,
    lastChangeTime: string,
    id: string,
    threadId: number,
    eventType: string,
    args?: string,
    predecessors?: string,
    successors?: string,
    duration?: number,
    endTime?: number,
    pid?: number,
    tid?: number,
    line?: number,
    isCounter?: number,
    isFakeCore?: number,
    name?: string,
    uid?: string,
    renderEndTime?: number,
    renderStartTime?: number,
    renderDuration?: number,
    startTime?: number,
    threadName?: string,
    ts?: number,
    leafIndex?: string,
    seqNo?: number,
    taskId?: number,
    color?: string,
  ): Promise<void> {
    const sql = `INSERT OR REPLACE INTO swimgraph_event(file_path,last_change_time,id,args,predecessors,
      successors,duration,end_time,pid,tid,line,is_counter,is_fake_core,name,
      uid,render_end_time,render_start_time,start_time,thread_name,ts,
      leaf_index,thread_id,event_type,seq_no,task_id,color) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

    const params = [
      filePath,
      lastChangeTime,
      id,
      args ?? '',
      predecessors ?? '',
      successors ?? '',
      duration ?? 0,
      endTime ?? 0,
      pid ?? 0,
      tid ?? 0,
      line ?? 0,
      isCounter ?? 0,
      isFakeCore ?? 0,
      name ?? '',
      uid ?? '',
      renderEndTime ?? 0,
      renderStartTime ?? 0,
      renderDuration ?? 0,
      startTime ?? 0,
      threadName ?? '',
      ts ?? 0,
      leafIndex ?? '',
      threadId,
      eventType,
      seqNo ?? 0,
      taskId ?? 0,
      color ?? '',
    ];

    this.db!.run(sql, params);
  }

  public async swimGraphEventGetAll(): Promise<SwimGraphEventRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_event');
    const rows: SwimGraphEventRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphEventRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphEventGetByFilePath(filePath: string): Promise<SwimGraphEventRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_event WHERE file_path = ?');
    stmt.bind([filePath]);
    const rows: SwimGraphEventRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphEventRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphEventGetByFilePathPidTid(filePath: string, pid: number, thread_id: number): Promise<SwimGraphEventRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_event WHERE file_path = ? AND pid = ? AND thread_id = ?');
    stmt.bind([filePath, pid, thread_id]);
    const rows: SwimGraphEventRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphEventRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphEventGetByFilePathPidTidOrderByTsAsc(
    filePath: string,
    pid: number,
    thread_id: number,
  ): Promise<SwimGraphEventRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_event WHERE file_path = ? AND pid = ? AND thread_id = ? ORDER BY ts ASC');
    stmt.bind([filePath, pid, thread_id]);
    const rows: SwimGraphEventRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphEventRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphEventDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM swimgraph_event WHERE file_path=?', [filePath]);
  }
  /****************** swimgraph_pmu 表 ******************/
  public async swimGraphPmuSet(
    filePath: string,
    lastChangeTime: string,
    uid: string,
    subTaskId: number,
    seqNo: number,
    threadId: number,
    taskId: number,
    coreId: number,
    totalCycle: number,
    vecBusyCycle: number,
    cubeBusyCycle: number,
    scalarBusyCycle: number,
    mte1BusyCycle: number,
    mte2BusyCycle: number,
    mte3BusyCycle: number,
    icacheMiss: number,
    icacheReq: number,
    cubeRatio: number,
    vecRatio: number,
    scalarRatio: number,
    mte1Ratio: number,
    mte2Ratio: number,
    mte3Ratio: number,
    icacheHit: number,
  ): Promise<void> {
    const sql = `INSERT OR REPLACE INTO swimgraph_pmu(file_path,last_change_time,uid,sub_task_id,
        seq_no,thread_id,task_id,core_id,total_cycle,vec_busy_cycles,cube_busy_cycles,scalar_busy_cycles,
        mte1_busy_cycles,mte2_busy_cycles,mte3_busy_cycles,icache_miss,icache_req,cube_ratio,vec_ratio,
        scalar_ratio,mte1_ratio,mte2_ratio,mte3_ratio,
        icache_hit) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    this.db!.run(sql, [
      filePath,
      lastChangeTime,
      uid,
      subTaskId,
      seqNo,
      threadId,
      taskId,
      coreId,
      totalCycle,
      vecBusyCycle,
      cubeBusyCycle,
      scalarBusyCycle,
      mte1BusyCycle,
      mte2BusyCycle,
      mte3BusyCycle,
      icacheMiss,
      icacheReq,
      cubeRatio,
      vecRatio,
      scalarRatio,
      mte1Ratio,
      mte2Ratio,
      mte3Ratio,
      icacheHit,
    ]);
  }

  public async swimGraphPmuGetAll(): Promise<SwimGraphPmuRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_pmu');
    const rows: SwimGraphPmuRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphPmuRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphPmuGetByFilePath(filePath: string): Promise<SwimGraphPmuRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_pmu WHERE file_path = ?');
    stmt.bind([filePath]);
    const rows: SwimGraphPmuRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphPmuRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphPmuDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM swimgraph_pmu WHERE file_path=?', [filePath]);
  }

  /****************** swimgraph_lane2line 表 ******************/
  public async swimGraphLane2lineSet(filePath: string, lastChangeTime: string, name: string, value: number): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO swimgraph_lane2line(file_path,last_change_time,name,value) VALUES(?,?,?,?)', [
      filePath,
      lastChangeTime,
      name,
      value,
    ]);
  }

  public async swimGraphLane2lineGetAll(): Promise<SwimGraphLane2lineRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_lane2line');
    const rows: SwimGraphLane2lineRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphLane2lineRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphLane2lineGetByFilePath(filePath: string): Promise<SwimGraphLane2lineRow[]> {
    const stmt = this.db!.prepare('SELECT * FROM swimgraph_lane2line WHERE file_path = ?');
    stmt.bind([filePath]);
    const rows: SwimGraphLane2lineRow[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as SwimGraphLane2lineRow);
    }
    stmt.free();
    return rows;
  }

  public async swimGraphLane2lineDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM swimgraph_lane2line WHERE file_path=?', [filePath]);
  }


  /** 重试机制 **/
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 5,
    delayMs: number = 100,
    shouldRetryCondition?: (result: T) => boolean,
    operationName?: string
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await operation();

        // 如果提供了条件函数且结果不符合条件，则继续重试
        if (shouldRetryCondition && shouldRetryCondition(result)) {
          // `${operationName}操作返回空结果，重试第 ${i + 1} 次`
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
        }

        if (i == maxRetries - 1 && !result) {
          // `${operationName} 重试了 ${i + 1} 次，取值仍为空`
        }
        return result;
      } catch (error) {
        lastError = error;
        console.debug(`${operationName}操作失败，重试第 ${i + 1} 次，错误:`, error);

        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
    throw new Error('重试次数已达上限');
  }
  /****************** 4️⃣  生命周期 ******************/
  public async comGraphDataDelete(fsPath: string) {
    this.comGraphLayoutDel(fsPath);
    this.comGraphFinalResultDel(fsPath);
    this.comGraphFuncDataDel(fsPath);
    this.comGraphFileHashMapDel(fsPath);
  }

  /** 把内存中的数据持久化到磁盘，在 deactivate() 里调用 **/
  public async save() {
    if (!this.db) {
      return;
    }
    const data = this.db.export();
    await vscode.workspace.fs.writeFile(vscode.Uri.file(this.dbFile), data);
  }

  /** 彻底清空缓存（内存 + 磁盘 + 大文件） */
  public async clearCache(): Promise<void> {
    // 1. 先关闭并释放当前内存数据库
    this.dispose();

    // 2. 删除所有外置大文件
    const bigDataDir = path.join(path.dirname(this.dbFile), 'bigData');
    await vscode.workspace.fs.delete(vscode.Uri.file(bigDataDir), { recursive: true, useTrash: false });

    // 3. 删除数据库文件
    if (existsSync(this.dbFile)) {
      await vscode.workspace.fs.delete(vscode.Uri.file(this.dbFile));
    }

    // 4. 重新打开一个空数据库（可选）
    await this.open();
  }

  public async deleteForCommand() {
    await this.clearCache();
  }

  public async createBigDataFile(hash: string, data: string): Promise<string> {
    // 1. 拼文件名：YYYYMMDD_hash.json
    const dateStr = new Date().toISOString().slice(0, 12).replace(/-/g, '');
    const fileName = `${dateStr}_${hash}.json`;

    // 2. 统一放到 globalStorage/bigData 子目录
    const bigDataDir = path.join(path.dirname(this.dbFile), 'bigData');
    const bigDataFilePath = path.join(bigDataDir, fileName);

    // 3. 确保目录存在
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(bigDataDir));
    // 4. 写文件（异步，不落盘就抛错）
    await vscode.workspace.fs.writeFile(vscode.Uri.file(bigDataFilePath), Buffer.from(data, 'utf8'));
    return bigDataFilePath;
  }
  public async readJsonFile(path: string): Promise<string> {
    return await fs.readFile(path, 'utf8'); // 直接返回字符串
  }
  /** 关闭数据库 **/
  public dispose() {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }
}

export async function getMTime(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath); // 或 vscode.workspace.fs.stat(vscode.Uri.file(filePath))
  return stat.mtime.toString();
}
