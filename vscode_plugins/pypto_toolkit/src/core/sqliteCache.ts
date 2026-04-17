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

  /**
 * 定义数据接口，对应 accuracy_tool 表的字段
 */
export interface AccuracyToolData {
  filePath: string;
  no?:string;
  phaseName: string;           // 对应 "B>PHASE_NAME"
  funcMagicName: string;       // 对应 "PATH_FUNC:func_magicname"
  rawMagic: string;            // 对应 "B>:rawmagic"
  result?: string;             // 对应 "AB>RESULT"
  dataType?: string;           // 对应 ":datatype"
  validShape?: string;         // 对应 ":validshape"
  loopInfo?: string;           // 对应 "LOOP_INFO"
  rtolAtol?: string;           // 对应 "AB>rtol/atol"
  cntFailWarnTol?: string;     // 对应 "AB>fail_cnt/warn_cnt/tol_cnt"
  cntTotalZeroInfnanCnt?: string;    // 对应 "AB>total_cnt/zero_cnt/infnan_cnt"
  mre?: string;
  mreTop1permil?: string;
  mreTop8?: string;
  mae?: string;
  maeTop8?: string;
  maeTop1permil?: string;
  aMax?: string;
  aMin?: string;
  aAvg?: string;
  aAavg?: string;
  aZero?: string;
  aInfnan?: string;
  bMax?: string;
  bMin?: string;
  bAvg?: string;
  bAavg?: string;
  bZero?: string;
  bInfnan?: string;
  bTimestamp?: string;
}

export interface PaginatedResult<T> {
  total: number;
  list: T[];
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
    this.db.run(`
      CREATE TABLE IF NOT EXISTS accuracy_tool (
        file_path TEXT NOT NULL,
        "NO." TEXT NOT NULL,
        "B>PHASE_NAME" TEXT NOT NULL,
        "PATH_FUNC:func_magicname" TEXT NOT NULL,
        "AB>RESULT" TEXT, 
        "B>:rawmagic" TEXT NOT NULL, 
        ":datatype" TEXT,
        ":validshape" TEXT,
        "LOOP_INFO" TEXT,
        "AB>rtol/atol" TEXT,
        "AB>fail_cnt/warn_cnt/tol_cnt" TEXT,
        "AB>total_cnt/zero_cnt/infnan_cnt" TEXT,
        -- 数值统计字段
        "AB>mre" TEXT,
        "AB>mre_top1permil" TEXT,
        "AB>mre_top8" TEXT,
        "AB>mae" TEXT,
        "AB>mae_top8" TEXT,
        "AB>mae_top1permil" TEXT,
        -- A/B 组统计数据
        "A>max" TEXT,
        "A>min" TEXT,
        "A>avg" TEXT,
        "A>aavg" TEXT,
        "A>zero" TEXT,
        "A>infnan" TEXT,
        "B>max" TEXT,
        "B>min" TEXT,
        "B>avg" TEXT,
        "B>aavg" TEXT,
        "B>zero" TEXT,
        "B>infnan" TEXT,
        -- 其他
        "B>TIMESTAMP" TEXT,
        -- 复合主键
        PRIMARY KEY (file_path, "NO.")
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
  /****************** accuracy_tool 表 ******************/
  /**
   * 插入或更新 accuracy_tool 表数据
   * 使用 INSERT OR REPLACE 语法，如果主键冲突则覆盖
   */
  public async accuracyToolSet(data: AccuracyToolData): Promise<void> {
    // 注意：字段名包含特殊字符，必须使用双引号 " 包裹
    const sql = `
      INSERT OR REPLACE INTO accuracy_tool (
        file_path, 
        "NO.",
        "B>PHASE_NAME", 
        "PATH_FUNC:func_magicname", 
        "B>:rawmagic",
        "AB>RESULT",
        ":datatype",
        ":validshape",
        "LOOP_INFO",
        "AB>rtol/atol",
        "AB>fail_cnt/warn_cnt/tol_cnt",
        "AB>total_cnt/zero_cnt/infnan_cnt",
        "AB>mre",
        "AB>mre_top1permil",
        "AB>mre_top8",
        "AB>mae",
        "AB>mae_top8",
        "AB>mae_top1permil",
        "A>max",
        "A>min",
        "A>avg",
        "A>aavg",
        "A>zero",
        "A>infnan",
        "B>max",
        "B>min",
        "B>avg",
        "B>aavg",
        "B>zero",
        "B>infnan",
        "B>TIMESTAMP"
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.filePath ?? '',
      data.no ?? '',
      data.phaseName ?? '',
      data.funcMagicName ?? '',
      data.rawMagic ?? '',
      data.result ?? '',
      data.dataType ?? '',
      data.validShape ?? '',
      data.loopInfo ?? '',
      data.rtolAtol ?? '',
      data.cntFailWarnTol ?? '',
      data.cntTotalZeroInfnanCnt ?? '',
      data.mre ?? '',
      data.mreTop1permil ?? '',
      data.mreTop8 ?? '',
      data.mae ?? '',
      data.maeTop8 ?? '',
      data.maeTop1permil ?? '',
      data.aMax ?? '',
      data.aMin ?? '',
      data.aAvg ?? '',
      data.aAavg ?? '',
      data.aZero ?? '',
      data.aInfnan ?? '',
      data.bMax ?? '',
      data.bMin ?? '',
      data.bAvg ?? '',
      data.bAavg ?? '',
      data.bZero ?? '',
      data.bInfnan ?? '',
      data.bTimestamp ?? '',
    ];
    this.db!.run(sql, params);
  }

    /**
   * 查询单条数据
   * @param filePath 文件路径 (主键之一)
   * @param phaseName 阶段名称 (主键之一)
   * @param funcMagicName 函数标识 (主键之一)
   * @param rawMagic 原始标识 (主键之一)
   * @returns 返回匹配的行对象，如果不存在则返回 undefined
   */
  public async accuracyToolGet(
    filePath: string, 
    phaseName: string, 
    funcMagicName: string, 
    rawMagic: string
  ): Promise<AccuracyToolData | undefined> {
    
    // 使用 AS 为包含特殊字符的字段起别名，这样取出来的数据属性名更干净（例如用 result 代替 "AB>RESULT"）
    const sql = `
      SELECT 
        file_path,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo,
        "AB>rtol/atol" AS rtolAtol,
        "AB>fail_cnt/warn_cnt/tol_cnt" AS cntFailWarnTol,
        "AB>total_cnt/zero_cnt/infnan_cnt" AS cntTotalZeroInfnanCnt,
        "AB>mre" AS mre,
        "AB>mre_top1permil" AS mreTop1permil,
        "AB>mre_top8" AS mreTop8,
        "AB>mae" AS mae,
        "AB>mae_top8" AS maeTop8,
        "AB>mae_top1permil" AS maeTop1permil,
        "A>max" AS aMax,
        "A>min" AS aMin,
        "A>avg" AS aAvg,
        "A>aavg" AS aAavg,
        "A>zero" AS aZero,
        "A>infnan" AS aInfnan,
        "B>max" AS bMax,
        "B>min" AS bMin,
        "B>avg" AS bAvg,
        "B>aavg" AS bAavg,
        "B>zero" AS bZero,
        "B>infnan" AS bInfnan,
      FROM accuracy_tool 
      WHERE 
        file_path = ? AND 
        "B>PHASE_NAME" = ? AND 
        "PATH_FUNC:func_magicname" = ? AND 
        "B>:rawmagic" = ?
    `;

    // 准备语句并绑定参数
    const stmt = this.db!.prepare(sql);
    stmt.bind([filePath, phaseName, funcMagicName, rawMagic]);

    // 获取单行结果
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      
      // 将获取到的扁平数据重新组装成 AccuracyToolData 对象
      // 注意：这里需要把 file_path 映射回 filePath
      return {
        filePath: row.file_path as string,
        phaseName: row.phaseName as string,
        funcMagicName: row.funcMagicName as string,
        rawMagic: row.rawMagic as string,
        result: row.result as string,
        dataType: row.dataType as string,
        validShape: row.validShape as string,
        loopInfo: row.loopInfo as string,
        rtolAtol: row.rtolAtol as string,
        cntFailWarnTol: row.cntFailWarnTol as string,
        cntTotalZeroInfnanCnt: row.cntTotalZeroInfnanCnt as string,
        mre: row.mre as string,
        mreTop1permil: row.mreTop1permil as string,
        mreTop8: row.mreTop8 as string,
        mae: row.mae as string,
        maeTop8: row.maeTop8 as string,
        maeTop1permil: row.maeTop1permil as string,
        aMax: row.aMax as string,
        aMin: row.aMin as string,
        aAvg: row.aAvg as string,
        aAavg: row.aAavg as string,
        aZero: row.aZero as string,
        aInfnan: row.aInfnan as string,
        bMax: row.bMax as string,
        bMin: row.bMin as string,
        bAvg: row.bAvg as string,
        bAavg: row.bAavg as string,
        bZero: row.bZero as string,
        bInfnan: row.bInfnan as string,
      };
    } else {
      stmt.free();
      return undefined;
    }
  }
    /**
   * 查询 accuracy_tool 表的所有数据
   * @returns 返回包含所有行的数组
   */
  public async accuracyToolGetAll(): Promise<AccuracyToolData[]> {
    const sql = `
      SELECT 
        file_path,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo,
        "AB>rtol/atol" AS rtolAtol,
        "AB>fail_cnt/warn_cnt/tol_cnt" AS cntFailWarnTol,
        "AB>total_cnt/zero_cnt/infnan_cnt" AS cntTotalZeroInfnanCnt,
        "AB>mre" AS mre,
        "AB>mre_top1permil" AS mreTop1permil,
        "AB>mre_top8" AS mreTop8,
        "AB>mae" AS mae,
        "AB>mae_top8" AS maeTop8,
        "AB>mae_top1permil" AS maeTop1permil,
        "A>max" AS aMax,
        "A>min" AS aMin,
        "A>avg" AS aAvg,
        "A>aavg" AS aAavg,
        "A>zero" AS aZero,
        "A>infnan" AS aInfnan,
        "B>max" AS bMax,
        "B>min" AS bMin,
        "B>avg" AS bAvg,
        "B>aavg" AS bAavg,
        "B>zero" AS bZero,
        "B>infnan" AS bInfnan,
        "B>TIMESTAMP" AS bTimestamp
      FROM accuracy_tool
    `;

    const stmt = this.db!.prepare(sql);
    const result: AccuracyToolData[] = [];

    try {
      // 遍历所有结果
      while (stmt.step()) {
        const row = stmt.getAsObject();
        
        // 手动组装对象，确保 file_path 映射为 filePath
        result.push({
          filePath: row.file_path as string,
          phaseName: row.phaseName as string,
          funcMagicName: row.funcMagicName as string,
          rawMagic: row.rawMagic as string,
          result: row.result as string,
          dataType: row.dataType as string,
          validShape: row.validShape as string,
          loopInfo: row.loopInfo as string,
          rtolAtol: row.rtolAtol as string,
          cntFailWarnTol: row.cntFailWarnTol as string,
          cntTotalZeroInfnanCnt: row.cntTotalZeroInfnanCnt as string,
          mre: row.mre as string,
          mreTop1permil: row.mreTop1permil as string,
          mreTop8: row.mreTop8 as string,
          mae: row.mae as string,
          maeTop8: row.maeTop8 as string,
          maeTop1permil: row.maeTop1permil as string,
          aMax: row.aMax as string,
          aMin: row.aMin as string,
          aAvg: row.aAvg as string,
          aAavg: row.aAavg as string,
          aZero: row.aZero as string,
          aInfnan: row.aInfnan as string,
          bMax: row.bMax as string,
          bMin: row.bMin as string,
          bAvg: row.bAvg as string,
          bAavg: row.bAavg as string,
          bZero: row.bZero as string,
          bInfnan: row.bInfnan as string,
          bTimestamp: row.bTimestamp as string
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

    /**
   * 根据文件路径统计不同结果的数据量
   * @param filePath 文件路径
   * @returns 返回一个对象，键为结果类型，值为数量。例如: { "PASS": 100, "FAIL": 5 }
   */
  public async getAccuracyStatsByFile(filePath: string): Promise<Record<string, number>> {
    const sql = `
      WITH PhaseStatus AS (
        SELECT 
          "B>PHASE_NAME",
          CASE 
            WHEN SUM(CASE WHEN "AB>RESULT" = 'FAIL' THEN 1 ELSE 0 END) > 0 THEN 'FAIL'
            WHEN SUM(CASE WHEN "AB>RESULT" = 'EXCEPTION' THEN 1 ELSE 0 END) > 0 THEN 'EXCEPTION'
            WHEN SUM(CASE WHEN "AB>RESULT" = 'PASS' THEN 1 ELSE 0 END) > 0 THEN 'PASS'
            ELSE 'SKIP'
          END AS finalResult
        FROM accuracy_tool
        WHERE 
          file_path = ? AND
          "B>PHASE_NAME" LIKE 'Pass_%'
        GROUP BY "B>PHASE_NAME"
      )
      SELECT finalResult, COUNT(*) as count
      FROM PhaseStatus
      GROUP BY finalResult
    `;

    const stmt = this.db!.prepare(sql);
    const stats: Record<string, number> = {};

    try {
      stmt.bind([filePath]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row.finalResult) {
          stats[row.finalResult as string] = row.count as number;
        }
      }
    } finally {
      stmt.free();
    }

    return stats;
  }

  /**
   * 获取指定文件、指定函数下，每个阶段的最终判定状态
   * 规则：
   * 1. 某阶段只要有 FAIL，状态即为 'FAIL'
   * 2. 否则，若有 EXCEPTION，状态即为 'EXCEPTION'
   * 3. 否则（即全为 PASS），状态为 'PASS'
   * 
   * @param filePath 文件路径
   * @param funcMagicName 函数标识
   * @returns 返回包含阶段名和最终状态的数组
   */
  public async getPhaseStatusListByFunc(
    filePath: string, 
    funcMagicName: string
  ): Promise<{ phaseName: string; status: string }[]> {
    const sql = `
      SELECT 
        "B>PHASE_NAME" AS phaseName,
        CASE 
          WHEN SUM(CASE WHEN "AB>RESULT" = 'FAIL' THEN 1 ELSE 0 END) > 0 THEN 'FAIL'
          WHEN SUM(CASE WHEN "AB>RESULT" = 'EXCEPTION' THEN 1 ELSE 0 END) > 0 THEN 'EXCEPTION'
          WHEN SUM(CASE WHEN "AB>RESULT" = 'PASS' THEN 1 ELSE 0 END) > 0 THEN 'PASS'
          ELSE 'SKIP'
        END AS status
      FROM accuracy_tool
      WHERE 
        file_path = ? AND 
        "PATH_FUNC:func_magicname" LIKE ?
      GROUP BY "B>PHASE_NAME"
      ORDER BY "B>PHASE_NAME"
    `;

    const stmt = this.db!.prepare(sql);
    const result: { phaseName: string; status: string }[] = [];

    try {
      stmt.bind([filePath, `%{funcMagicName}%`]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName as string,
          status: row.status as string
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

  public async getPhaseStatusListByFuncTest(
    filePath: string, 
    funcMagicName: string
  ): Promise<{ phaseName: string; status: string }[]> {
    const sql = `
      SELECT 
        "B>PHASE_NAME" AS phaseName,
        CASE 
          WHEN SUM(CASE WHEN "AB>RESULT" = 'FAIL' THEN 1 ELSE 0 END) > 0 THEN 'FAIL'
          WHEN SUM(CASE WHEN "AB>RESULT" = 'EXCEPTION' THEN 1 ELSE 0 END) > 0 THEN 'EXCEPTION'
          WHEN SUM(CASE WHEN "AB>RESULT" = 'PASS' THEN 1 ELSE 0 END) > 0 THEN 'PASS'
          ELSE 'SKIP'
        END AS status
      FROM accuracy_tool
      WHERE 
        file_path = ? AND 
        "PATH_FUNC:func_magicname" = ?
      GROUP BY "B>PHASE_NAME"
      ORDER BY "B>PHASE_NAME"
    `;

    const stmt = this.db!.prepare(sql);
    const result: { phaseName: string; status: string }[] = [];

    try {
      stmt.bind([filePath, funcMagicName]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName as string,
          status: row.status as string
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

  /**
   * 查询指定文件中所有不重复的阶段与结果组合
   * @param filePath 文件路径
   * @returns 返回去重后的数组，例如: [{ phaseName: 'Phase1', result: 'PASS' }, ...]
   */
  public async getDistinctPhaseResults(filePath: string): Promise<{ phaseName: string; result: string }[]> {
    const sql = `
      SELECT DISTINCT
        "B>PHASE_NAME" AS phaseName,
        "AB>RESULT" AS result
      FROM accuracy_tool
      WHERE file_path = ?
      ORDER BY "B>PHASE_NAME"
    `;

    const stmt = this.db!.prepare(sql);
    const result: { phaseName: string; result: string }[] = [];

    try {
      stmt.bind([filePath]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName as string,
          result: row.result as string
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

   /**
   * 查询  指定文件 + 某个阶段(B>PHASE_NAME) 的 所有失败(AB>RESULT='FAIL')数据，返回按时间戳升序排列
   * @param filePath 文件路径
   * @returns 返回包含阶段名和对应失败详情的数组
   */
  public async getFirstFailByPhaseOnTimestamp(filePath: string, phaseName: string): Promise<any[]> {
    const sql = `
      SELECT DISTINCT
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "AB>RESULT" AS result,
        "B>TIMESTAMP" AS bTimestamp
      FROM accuracy_tool
      WHERE file_path = ? 
        AND "B>PHASE_NAME" = ?
        AND "AB>RESULT" = 'FAIL'
        AND "B>TIMESTAMP" IN (
          SELECT MIN("B>TIMESTAMP") 
          FROM accuracy_tool
          WHERE file_path = ? 
            AND "B>PHASE_NAME" = ?
            AND "AB>RESULT" = 'FAIL'
          GROUP BY "PATH_FUNC:func_magicname"
        )
      ORDER BY "B>TIMESTAMP", "PATH_FUNC:func_magicname" ASC
    `;

    const stmt = this.db!.prepare(sql);
    const result: any[] = [];

    try {
      stmt.bind([filePath, phaseName, filePath, phaseName]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName,
          funcMagicName: row.funcMagicName,
          rawMagic: row.rawMagic,
          result: row.result,
          timestamp: row.bTimestamp
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

   /**
   * 查询指定文件下，每个阶段(B>PHASE_NAME)的第一条失败(AB>RESULT='FAIL')数据
   * @param filePath 文件路径
   * @returns 返回包含阶段名和对应失败详情的数组
   */
   public async getFirstFailByPhase(filePath: string): Promise<any[]> {
    const sql = `
      SELECT 
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "AB>RESULT" AS result
      FROM accuracy_tool
      WHERE rowid IN (
          SELECT MIN(rowid)
          FROM accuracy_tool
          WHERE file_path = ? AND "AB>RESULT" = 'FAIL'
          GROUP BY "B>PHASE_NAME"
      )
      ORDER BY "B>PHASE_NAME"
    `;

    const stmt = this.db!.prepare(sql);
    const result: any[] = [];

    try {
      stmt.bind([filePath]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          phaseName: row.phaseName,
          funcMagicName: row.funcMagicName,
          rawMagic: row.rawMagic,
          result: row.result
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

    /**
   * 统计指定文件、指定阶段和函数下的各结果数量
   * @param filePath 文件路径
   * @param phaseName 阶段名称 (对应 B>PHASE_NAME)
   * @param funcMagicName 函数标识 (对应 PATH_FUNC:func_magicname)
   * @returns 返回统计数组，例如: [{ result: 'PASS', count: 100 }, { result: 'FAIL', count: 5 }]
   */
  public async getAccuracyStatsByFunc(
    filePath: string, 
    phaseName: string, 
    funcMagicName: string
  ): Promise<Record<string, number>> {
    

    const sql = `
      SELECT 
        "AB>RESULT" AS resultType, 
        COUNT(*) AS count 
      FROM accuracy_tool 
      WHERE 
        file_path = ? AND 
        "B>PHASE_NAME" = ? AND 
        "PATH_FUNC:func_magicname" = ?
      GROUP BY "AB>RESULT"
    `;

    const stmt = this.db!.prepare(sql);
    const stats: Record<string, number> = {};

    try {
      stmt.bind([filePath, phaseName, funcMagicName]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (row.resultType) {
          stats[row.resultType as string] = row.count as number;
        }
      }
    } finally {
      stmt.free();
    }

    return stats;
  }

    /**
   * 查询指定文件、阶段和函数的所有失败或异常数据详情
   * @param filePath 文件路径
   * @param phaseName 阶段名称
   * @param funcMagicName 函数标识
   * @returns 返回按时间排序的异常数据列表
   */
  public async getErrorDetailsByFunc(
    filePath: string, 
    phaseName: string, 
    funcMagicName: string,
    rawMagic: string,
    loopInfo: string,
    pageSize: number,
    startOffset: number
  ): Promise<AccuracyToolData[]> {
    const sql = `
      SELECT 
        file_path,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "B>TIMESTAMP" AS bTimestamp,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo,
        "AB>rtol/atol" AS rtolAtol,
        "AB>fail_cnt/warn_cnt/tol_cnt" AS cntFailWarnTol,
        "AB>total_cnt/zero_cnt/infnan_cnt" AS cntTotalZeroInfnanCnt,
        "AB>mre" AS mre,
        "AB>mre_top1permil" AS mreTop1permil,
        "AB>mre_top8" AS mreTop8,
        "AB>mae" AS mae,
        "AB>mae_top8" AS maeTop8,
        "AB>mae_top1permil" AS maeTop1permil,
        "A>max" AS aMax,
        "A>min" AS aMin,
        "A>avg" AS aAvg,
        "A>aavg" AS aAavg,
        "A>zero" AS aZero,
        "A>infnan" AS aInfnan,
        "B>max" AS bMax,
        "B>min" AS bMin,
        "B>avg" AS bAvg,
        "B>aavg" AS bAavg,
        "B>zero" AS bZero,
        "B>infnan" AS bInfnan
      FROM accuracy_tool
      WHERE 
        file_path = ? AND 
        "B>PHASE_NAME" = ? AND 
        "PATH_FUNC:func_magicname" = ? AND 
        "B>:rawmagic" = ? AND 
        "LOOP_INFO" = ? AND 
        "AB>RESULT" IN ('FAIL', 'EXCEPTION')
      ORDER BY "B>TIMESTAMP" ASC
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db!.prepare(sql);
    const result: AccuracyToolData[] = [];

    try {
      stmt.bind([filePath, phaseName, funcMagicName, rawMagic, loopInfo, pageSize, startOffset]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          filePath: row.file_path as string,
          phaseName: row.phaseName as string,
          funcMagicName: row.funcMagicName as string,
          rawMagic: row.rawMagic as string,
          bTimestamp: row.bTimestamp as string, // 新增字段映射
          result: row.result as string,
          dataType: row.dataType as string,
          validShape: row.validShape as string,
          loopInfo: row.loopInfo as string,
          rtolAtol: row.rtolAtol as string,
          cntFailWarnTol: row.cntFailWarnTol as string,
          cntTotalZeroInfnanCnt: row.cntTotalZeroInfnanCnt as string,
          mre: row.mre as string,
          mreTop1permil: row.mreTop1permil as string,
          mreTop8: row.mreTop8 as string,
          mae: row.mae as string,
          maeTop8: row.maeTop8 as string,
          maeTop1permil: row.maeTop1permil as string,
          aMax: row.aMax as string,
          aMin: row.aMin as string,
          aAvg: row.aAvg as string,
          aAavg: row.aAavg as string,
          aZero: row.aZero as string,
          aInfnan: row.aInfnan as string,
          bMax: row.bMax as string,
          bMin: row.bMin as string,
          bAvg: row.bAvg as string,
          bAavg: row.bAavg as string,
          bZero: row.bZero as string,
          bInfnan: row.bInfnan as string
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

  public async getErrorDetailsOfGraphByFunc(
    filePath: string, 
    phaseName: string, 
    funcMagicName: string, 
    pageSize: number,
    startOffset: number
  ): Promise<AccuracyToolData[]> {
    const sql = `
      SELECT 
        file_path,
        "NO." AS no,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "B>TIMESTAMP" AS bTimestamp,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo
      FROM accuracy_tool
      WHERE 
        file_path = ? AND 
        "B>PHASE_NAME" = ? AND 
        "PATH_FUNC:func_magicname" = ? AND 
        "AB>RESULT" IN ('FAIL', 'EXCEPTION')
      ORDER BY "B>TIMESTAMP" ASC, "NO." DESC
      LIMIT ? OFFSET ?
    `;

    const stmt = this.db!.prepare(sql);
    const result: AccuracyToolData[] = [];

    try {
      stmt.bind([filePath, phaseName, funcMagicName, pageSize, startOffset]);

      while (stmt.step()) {
        const row = stmt.getAsObject();
        result.push({
          filePath: row.file_path as string,
          no: row.no as string,
          phaseName: row.phaseName as string,
          funcMagicName: row.funcMagicName as string,
          rawMagic: row.rawMagic as string,
          bTimestamp: row.bTimestamp as string,
          result: row.result as string,
          dataType: row.dataType as string,
          validShape: row.validShape as string,
          loopInfo: row.loopInfo as string
        });
      }
    } finally {
      stmt.free();
    }

    return result;
  }

  public async getErrorListByPage(
    filePath: string, 
    phaseName: string, 
    funcMagicName: string,
    keyWord: string,
    pageSize: number,
    startOffset: number,
  ): Promise<PaginatedResult<AccuracyToolData>> {
    const countSql = `
      SELECT COUNT(*) AS total
      FROM accuracy_tool
      WHERE 
        file_path = ? AND 
        "B>PHASE_NAME" = ? AND 
        "PATH_FUNC:func_magicname" = ? AND 
        "LOOP_INFO" LIKE ? AND 
        "AB>RESULT" IN ('FAIL', 'EXCEPTION')
    `;
    const dataSql = `
      SELECT 
        file_path,
        "NO." AS no,
        "B>PHASE_NAME" AS phaseName,
        "PATH_FUNC:func_magicname" AS funcMagicName,
        "B>:rawmagic" AS rawMagic,
        "B>TIMESTAMP" AS bTimestamp,
        "AB>RESULT" AS result,
        ":datatype" AS dataType,
        ":validshape" AS validShape,
        "LOOP_INFO" AS loopInfo
      FROM accuracy_tool
      WHERE 
        file_path = ? AND 
        "B>PHASE_NAME" = ? AND 
        "PATH_FUNC:func_magicname" = ? AND 
        "LOOP_INFO" LIKE ? AND 
        "AB>RESULT" IN ('FAIL', 'EXCEPTION')
      ORDER BY "B>TIMESTAMP" ASC
      LIMIT ? OFFSET ?
    `;

    const bindParams = [filePath, phaseName, funcMagicName, `%${keyWord}%`];

    let total = 0;
    const countStmt = this.db!.prepare(countSql);
    try {
      countStmt.bind(bindParams);
      if (countStmt.step()) {
        const row = countStmt.getAsObject();
        total = row.total as number;
      }
    } finally {
      countStmt.free();
    }

    const dataStmt = this.db!.prepare(dataSql);
    const list: AccuracyToolData[] = [];

    try {
      dataStmt.bind([...bindParams, pageSize, startOffset]);

      while (dataStmt.step()) {
        const row = dataStmt.getAsObject();
        list.push({
          filePath: row.file_path as string,
          no: row.no as string,
          phaseName: row.phaseName as string,
          funcMagicName: row.funcMagicName as string,
          rawMagic: row.rawMagic as string,
          bTimestamp: row.bTimestamp as string,
          result: row.result as string,
          dataType: row.dataType as string,
          validShape: row.validShape as string,
          loopInfo: row.loopInfo as string
        });
      }
    } finally {
      dataStmt.free();
    }

    return { total, list };
  }

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
  public async comGraphFuncDataGet(filePath: string, funcHash: string, maxRetries?: number, delayMs?: number): Promise<ComGraphFuncDataRow | undefined> {
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
    }, maxRetries, delayMs, (result) => !result, "comGraphFuncDataGet");
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
