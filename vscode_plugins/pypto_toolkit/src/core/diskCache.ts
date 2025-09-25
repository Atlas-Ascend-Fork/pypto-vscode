import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fs } from 'fs';
// import Database, { Statement } from 'better-sqlite3';// 调试时 不想用数据库就注释改行
// 调试时 不想用数据库就放开Database Statement的注释
class Database{
  [key:string]:any;
  constructor(file:any){}
}
class Statement{
  [key:string]:any;
}

interface ComGraphLayoutRow {
  file_path: string;
  func_hash: string;
  layout_result: string;
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

export class DiskCache {
  private static _instance: DiskCache;
  private db: Database | undefined;
  private readonly dbFile: string;

  /* 预编译语句缓存 */
  private stmtLayoutSet!: Statement;
  private stmtLayoutGet!: Statement;
  private stmtLayoutDel!: Statement;

  private stmtFuncDataSet!: Statement;
  private stmtFuncDataGet!: Statement;
  private stmtFuncDataDel!: Statement;
  private stmtFuncDataCount!: Statement;

  private stmtFileHashSet!: Statement;
  private stmtFileHashGet!: Statement;
  private stmtFileHashDel!: Statement;

  private stmtFileCalleeOpAttrSet!: Statement;
  private stmtFileCalleeOpAttrGet!: Statement;

  private constructor(context: vscode.ExtensionContext) {
    // 把缓存文件放到 globalStorage 目录，用户无感知
    this.dbFile = path.join(context.globalStorageUri.fsPath, 'better-sqlite3.db');
  }

  /** 单例获取 */
  public static getInstance(): DiskCache {
    if (!DiskCache._instance) {
      throw new Error('DiskCache has not been initialized yet!');
    }
    return DiskCache._instance;
  }

  /** 在 extension.ts 的 activate() 里调用一次即可 */
  public static async init(context: vscode.ExtensionContext): Promise<DiskCache> {
    if (DiskCache._instance) {
      return DiskCache._instance;
    }
    console.log('初始化缓存数据库');
    DiskCache._instance = new DiskCache(context);
    await DiskCache._instance.open();
    return DiskCache._instance;
  }

  /** 真正的初始化逻辑 */
  private async open() {
    try {
      // 确保目录存在
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(this.dbFile)));
      this.db = new Database(this.dbFile);
      // 教育实际读写权限 空表写入测试
      try {
        this.db.exec('CREATE TABLE IF NOT EXISTS _test(a);');
        this.db.exec('DROP TABLE _test;');
      } catch (err) {
        this.handleDatabaseError('open', err as Error);
      }

      // 性能与可靠性配置
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('cache_size = -65536'); // 8 MB 页缓存
      this.db.pragma('temp_store = file');
      /****************** 1️⃣  可建多个表：按需添加 ******************/
      this.createAllTables(); 
      /* 一次性 prepare */
      this.stmtLayoutSet = this.db.prepare(
        'INSERT OR REPLACE INTO com_graph_layout(file_path,func_hash,layout_result,last_change_time) VALUES(?,?,?,?)',
      );
      this.stmtLayoutGet = this.db.prepare(
        'SELECT file_path,func_hash,layout_result,last_change_time FROM com_graph_layout WHERE file_path=? AND func_hash=?',
      );
      this.stmtLayoutDel = this.db.prepare('DELETE FROM com_graph_layout WHERE file_path=?');

      this.stmtFuncDataSet = this.db.prepare(
        'INSERT OR REPLACE INTO com_graph_func_data(file_path,func_hash,call_hash_arr,data,big_data_file_path,last_change_time) VALUES(?,?,?,?,?,?)',
      );
      this.stmtFuncDataGet = this.db.prepare('SELECT * FROM com_graph_func_data WHERE file_path=? AND func_hash=?');
      this.stmtFuncDataDel = this.db.prepare('DELETE FROM com_graph_func_data WHERE file_path=?');
      this.stmtFuncDataCount = this.db.prepare('SELECT COUNT(*) AS cnt FROM com_graph_func_data WHERE file_path=?');

      this.stmtFileHashSet = this.db.prepare('INSERT OR REPLACE INTO com_graph_file_hash_map(file_path,data) VALUES(?,?)');
      this.stmtFileHashGet = this.db.prepare('SELECT data FROM com_graph_file_hash_map WHERE file_path=?');
      this.stmtFileHashDel = this.db.prepare('DELETE FROM com_graph_file_hash_map WHERE file_path=?');

      this.stmtFileCalleeOpAttrSet = this.db.prepare('INSERT OR REPLACE INTO com_graph_file_callee_op_attr(calleehash,op_magic,op_subgraphid,op_attr) VALUES(?,?,?,?)');
      this.stmtFileCalleeOpAttrGet = this.db.prepare('SELECT op_attr FROM com_graph_file_callee_op_attr WHERE calleehash=? AND op_magic=? AND op_subgraphid=? ');
    } catch (err) {
      this.handleDatabaseError('open', err as Error);
    }
  }

  private createAllTables(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS com_graph_layout (
        file_path        TEXT NOT NULL,
        func_hash        TEXT NOT NULL DEFAULT '',
        layout_result    TEXT,
        last_change_time TEXT,
        PRIMARY KEY (file_path, func_hash)
      ) WITHOUT ROWID;
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS com_graph_func_data (
        file_path          TEXT NOT NULL,
        func_hash          TEXT NOT NULL DEFAULT '',
        call_hash_arr      TEXT,
        data               TEXT,
        big_data_file_path TEXT,
        last_change_time   TEXT,
        PRIMARY KEY (file_path, func_hash)
      ) WITHOUT ROWID;
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS com_graph_file_hash_map (
        file_path TEXT NOT NULL,
        data      TEXT,
        PRIMARY KEY (file_path)
      ) WITHOUT ROWID;
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS com_graph_file_callee_op_attr (
        calleehash TEXT NOT NULL,
        op_magic TEXT NOT NULL,
        op_attr      TEXT,
        PRIMARY KEY (calleehash,op_magic)
      ) WITHOUT ROWID;
    `);
  }

  /****************** com_graph_layout 表 ******************/
  public async comGraphLayoutSet(filePath: string, funcHash: string, layoutResult: string, lastChangeTime: string): Promise<void> {
    try {
      if (this.db == undefined) return;
      await this.stmtLayoutSet.run(filePath, funcHash, layoutResult, lastChangeTime);
    } catch (err) {
      this.handleDatabaseError('comGraphLayoutSet', err as Error);
    }
  }
  public async  comGraphLayoutGet(filePath: string, funcHash: string): Promise<ComGraphLayoutRow | undefined> {
    try {
      if (this.db == undefined) return;
      const row = await this.stmtLayoutGet.get(filePath, funcHash);
      return row;
    } catch (err) {
      this.handleDatabaseError('comGraphLayoutGet', err as Error);
    }
  }
  public async comGraphLayoutDel(filePath: string): Promise<void> {
    try {
      if (this.db == undefined) return;
      await this.stmtLayoutDel.run(filePath);
    } catch (err) {
      this.handleDatabaseError('comGraphLayoutDel', err as Error);
    }
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
    try {
      if (this.db == undefined) return;
      await this.stmtFuncDataSet.run(filePath, funcHash, callHashArr, data, bigDataFilePath, lastChangeTime);
      console.log(
      );
    } catch (err) {
      this.handleDatabaseError('comGraphFuncDataSet', err as Error);
    }
  }
  public async comGraphFuncDataGetCount(filePath: string): Promise<number> {
    try {
      if (this.db == undefined) return 0;
      const row = await this.stmtFuncDataCount.get(filePath);
      return row?.cnt ?? 0;
    } catch (err) {
      this.handleDatabaseError('comGraphFuncDataGetCount', err as Error);
      return 0;
    }
  }
  public async comGraphFuncDataGet(filePath: string, funcHash: string): Promise<ComGraphFuncDataRow | undefined> {
    try {
      if (this.db == undefined) return;
      const row = await this.stmtFuncDataGet.get(filePath, funcHash);
      return row;
    } catch (err) {
      this.handleDatabaseError('comGraphFuncDataGet', err as Error);
    }
  }
  public async comGraphFuncDataDel(filePath: string): Promise<void> {
    try {
      if (this.db == undefined) return;
      await this.stmtFuncDataDel.run(filePath);
    } catch (err) {
      this.handleDatabaseError('comGraphFuncDataDel', err as Error);
    }
  }
  /****************** com_graph_file_hash_map 表 ******************/
  public async comGraphFileHashMapSet(filePath: string, data: string): Promise<void> {
    try {
      if (this.db == undefined) return;
      await this.stmtFileHashSet.run(filePath, data);
    } catch (err) {
      this.handleDatabaseError('comGraphFileHashMapSet', err as Error);
    }
  }
  public async comGraphFileHashMapGet(filePath: string): Promise<string> {
    try {
      if (this.db == undefined) return '';
      const row = await this.stmtFileHashGet.get(filePath);
      return row?.data ?? '';
    } catch (err) {
      this.handleDatabaseError('comGraphFileHashMapGet', err as Error);
      return '';
    }
  }
  public async comGraphFileHashMapDel(filePath: string): Promise<void> {
    try {
      if (this.db == undefined) return;
      await this.stmtFileHashDel.run(filePath);
    } catch (err) {
      this.handleDatabaseError('comGraphFileHashMapDel', err as Error);
    }
  }

  /****************** com_graph_file_callee_op_attr 表 ******************/
  public async comGraphFileCalleeOpAttrSet(calleehash: string, opMagic: string, opSubgraphid: string, opAttr: string): Promise<void> {
    try {
      if (this.db == undefined) return;
      await this.stmtFileCalleeOpAttrSet.run(calleehash, opMagic, opAttr, opSubgraphid);
    } catch (err) {
      this.handleDatabaseError('comGraphFileCalleeOpAttrSet', err as Error);
    }
  }
  public async comGraphFileCalleeOpAttrGet(calleehash: string, opMagic: string, opSubgraphid: string): Promise<string> {
    try {
      if (this.db == undefined) return '';
      const row = await this.stmtFileCalleeOpAttrGet.get(calleehash, opMagic, opSubgraphid);
      return row?.op_attr ?? '';
    } catch (err) {
      this.handleDatabaseError('comGraphFileCalleeOpAttrGet', err as Error);
      return '';
    }
  }
  
  /****************** 4️⃣  生命周期 ******************/
  private handleDatabaseError(methodName: string, error: Error) {
    console.error(`DiskCache Error [${methodName}]: ${error.message}`);
    // 可添加错误上报或恢复逻辑
    // 抛出错误供调用方处理
    throw new Error(`DiskCache operation failed: ${methodName}`, { cause: error });
  }

  public dropAllTables(): void {
    if (!this.db) return;
    try {
      // 先拿到除 sqlite_ 系统表外的所有表名
      const tables: { name: string }[] = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
        .all();

      // 开启一个事务，一次性 DROP
      this.db.transaction(() => {
        for (const { name } of tables) {
          this.db!.exec(`DROP TABLE IF EXISTS "${name}"`);
        }
      })();
      console.log('所有业务表已删除');
    } catch (err) {
      console.error('dropAllTables 失败', err);
    }
  }

  /** 彻底清空缓存（内存 + 磁盘 + 大文件） */
  public async clearCache(): Promise<void> {
    try {
      this.dropAllTables();
      this.createAllTables(); 
      const bigDataDir = path.join(path.dirname(this.dbFile), 'bigData');
      await vscode.workspace.fs.delete(
        vscode.Uri.file(bigDataDir),
        { recursive: true, useTrash: false }
      );
      // 清理WAL模式产生的残留文件
      const walFiles = [
        `${this.dbFile}-wal`,
        `${this.dbFile}-shm`
      ];
      for (const file of walFiles) {
        try {
          await vscode.workspace.fs.delete(vscode.Uri.file(file));
        } catch (e) {
          // 忽略删除失败的文件
        }
      }
    } catch (err) {
      // ---------- 关键判断 ----------
      const isCanceled =
        err instanceof vscode.FileSystemError &&
        (err as any).name === 'Canceled';   // VS Code 取消令牌触发

      if (isCanceled) {
        console.log('clearCache 被中断（用户取消或窗口关闭）');
        return;                              // 静默返回
      }
      console.error('clearCache', err as Error);
      vscode.window.showErrorMessage(`清空缓存失败：${(err as Error).message}`);
    }
  }

  public async deleteForCommand() {
    const yes = 'Clear';
    const pick = await vscode.window.showWarningMessage('确定要清空全部缓存吗？', { modal: true }, yes);
    if (pick !== yes) return;
    await this.clearCache();
    vscode.window.showInformationMessage('缓存已完全清空');
  }

  public async createBigDataFile(hash: string, data: string): Promise<string> {
    if (!/^[a-f0-9]{1,64}$/i.test(hash)) {
      throw new Error(`Invalid hash format: ${hash}`);
    }
    const dateStr = new Date().toISOString().slice(0, 12).replace(/-/g, ''); 
    const bigDataDir = path.join(path.dirname(this.dbFile), 'bigData');
    const safeHash = path.basename(hash);
    const dataFile = path.join(bigDataDir, `${safeHash}_${dateStr}.json`);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(dataFile), Buffer.from(data, 'utf8'));
    return dataFile;
  }

  public async readJsonFile(path: string): Promise<string> {
    return await fs.readFile(path, 'utf8'); // 直接返回字符串
  }

  public dispose() {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    this.stmtLayoutSet = undefined as any;
    this.stmtLayoutGet = undefined as any;
    this.stmtLayoutDel = undefined as any;

    this.stmtFuncDataSet = undefined as any;
    this.stmtFuncDataGet = undefined as any;
    this.stmtFuncDataDel = undefined as any;
    this.stmtFuncDataCount = undefined as any;

    this.stmtFileHashSet = undefined as any;
    this.stmtFileHashGet = undefined as any;
    this.stmtFileHashDel = undefined as any;
  }
}

export async function getMTime(filePath: string): Promise<string> {
  const stat = await fs.stat(filePath); 
  return stat.mtime.toString();
}
