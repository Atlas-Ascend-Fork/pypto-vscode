// src\core\sqliteCache.ts
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
    console.log('OYXT 添加com_graph_layout缓存 filePath：' + filePath + ' funcHash:' + funcHash);
  }
  public async comGraphLayoutGet(filePath: string, funcHash: string): Promise<ComGraphLayoutRow | undefined> {
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
  }
  public async comGraphLayoutDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_layout WHERE file_path=?', [filePath]);
    console.log('OYXT 删除com_graph_layout缓存：' + filePath);
  }

  /****************** com_graph_final_result 表 (未同步到diskCache.ts)******************/
  public async comGraphFinalResultSet(filePath: string, funcHash: string, finalResult: string, lastChangeTime: string): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO com_graph_final_result(file_path,func_hash,final_result,last_change_time) VALUES(?,?,?,?)', [
      filePath,
      funcHash,
      finalResult,
      lastChangeTime,
    ]);
    console.log('OYXT 添加com_graph_final_result缓存 filePath：' + filePath + ' funcHash:' + funcHash);
  }
  public async comGraphFinalResultGet(filePath: string, funcHash: string): Promise<ComGraphFinalResultRow | undefined> {
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
  }
  public async comGraphFinalResultDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_final_result WHERE file_path=?', [filePath]);
    console.log('OYXT 删除com_graph_final_result缓存：' + filePath);
  }
  /****************** com_graph_func_data 表 ******************/
  public async comGraphFuncDataSet(filePath: string, funcHash: string, callHashArr: string, data: string, bigDataFilePath: string, lastChangeTime: string): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO com_graph_func_data(file_path,func_hash,call_hash_arr,data,big_data_file_path,last_change_time) VALUES(?,?,?,?,?,?)', [
      filePath,
      funcHash,
      callHashArr,
      data,
      bigDataFilePath,
      lastChangeTime,
    ]);
    console.log(
      'OYXT 添加com_graph_func_data缓存 【filePath】：' + filePath + ' 【funcHash】:' + funcHash + ' 【callHashArr】:' + callHashArr,
    );
  }
  public async comGraphFuncDataGetCount(filePath: string): Promise<number> {
    const stmt = this.db!.prepare(
      'SELECT COUNT(*) as cnt FROM com_graph_func_data WHERE file_path=? ',
    );
    stmt.bind([filePath]);
    let count = 0;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { cnt: string | number };
      count = Number(row.cnt);
    }
    stmt.free();
    return count;
  }
  public async comGraphFuncDataGet(filePath: string, funcHash: string): Promise<ComGraphFuncDataRow | undefined> {
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
  }
  public async comGraphFuncDataDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_func_data WHERE file_path=?', [filePath]);
    console.log('OYXT 删除com_graph_func_data缓存：' + filePath);
  }
  /****************** com_graph_file_hash_map 表 ******************/
  public async comGraphFileHashMapSet(filePath: string, data: string): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO com_graph_file_hash_map(file_path,data) VALUES(?,?)', [
      filePath,
      data
    ]);
    console.log(
      'OYXT 添加com_graph_file_hash_map缓存 【filePath】：' + filePath + ' 【data】:' + data,
    );
  }
  public async comGraphFileHashMapGet(filePath: string): Promise<string> {
    const stmt = this.db!.prepare(
      'SELECT data FROM com_graph_file_hash_map WHERE file_path=?',
    );
    stmt.bind([filePath]);
    let data = '';
    if (stmt.step()) {
      const row = stmt.getAsObject() as { data: string };
      data = row.data ?? '';
    }
    stmt.free();
    return data;
  }
  public async comGraphFileHashMapDel(filePath: string): Promise<void> {
    this.db!.run('DELETE FROM com_graph_file_hash_map WHERE file_path=?', [filePath]);
    console.log('OYXT 删除com_graph_file_hash_map缓存：' + filePath);
  }
  /****************** com_graph_file_callee_op_attr 表 ******************/
  public async comGraphFileCalleeOpAttrSet(calleehash: string, opMagic: string, opSubgraphid: string, opAttr: string, ioperands: string): Promise<void> {
    this.db!.run('INSERT OR REPLACE INTO com_graph_file_callee_op_attr(calleehash,op_magic,op_subgraphid,op_attr,ioperands) VALUES(?,?,?,?,?)', [
      calleehash, opMagic, opSubgraphid, opAttr, ioperands
    ]);
  }
  public async comGraphFileCalleeOpAttrGet(calleehash: string, opMagic: string, opSubgraphid: string): Promise<string[]> {
    const stmt = this.db!.prepare(
      'SELECT op_attr,ioperands FROM com_graph_file_callee_op_attr WHERE calleehash=? AND op_magic=? AND op_subgraphid=?',
    );
    stmt.bind([calleehash, opMagic, opSubgraphid]);
    let row ;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.free();
    return row;
  }
  /****************** 4️⃣  生命周期 ******************/
  /** 把内存中的数据持久化到磁盘，在 deactivate() 里调用 **/
  public async save() {
    if (!this.db) {
      return;
    }
    const data = this.db.export();
    await vscode.workspace.fs.writeFile(vscode.Uri.file(this.dbFile), data);
    console.log('OYXT 缓存数据持久化到磁盘：' + this.dbFile);
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
    console.log('OYXT 缓存已完全清空');
  }

  public async deleteForCommand() {
    const yes = 'Clear';
    const pick = await vscode.window.showWarningMessage(
      t('pypto.clearAllCache'),
      { modal: true },
      yes
    );
    if (pick !== yes) return;
    await this.clearCache();
    vscode.window.showInformationMessage(t('pypto.cacheAlreadyCleared'));
  }

  public async createBigDataFile(hash: string,data: string): Promise<string> {
    // 1. 拼文件名：YYYYMMDD_hash.json
    const dateStr = new Date().toISOString().slice(0, 12).replace(/-/g, '');
    const fileName = `${dateStr}_${hash}.json`;

    // 2. 统一放到 globalStorage/bigData 子目录
    const bigDataDir = path.join(path.dirname(this.dbFile), 'bigData');
    const bigDataFilePath = path.join(bigDataDir, fileName);

    // 3. 确保目录存在
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(bigDataDir));
    console.log('OYXT writeBigDataFile 文件写入开始');
    // 4. 写文件（异步，不落盘就抛错）
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(bigDataFilePath),
      Buffer.from(data, 'utf8')
    );
    console.log('OYXT writeBigDataFile 文件写入完成');
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

