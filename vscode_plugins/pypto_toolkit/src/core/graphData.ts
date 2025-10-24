import { createReadStream } from 'fs';
const { parser } = require('stream-json');
const { pick } = require('stream-json/filters/Pick');
const { streamValues } = require('stream-json/streamers/StreamValues');
import { SQLiteCache, getMTime } from './sqliteCache';
const DATA_LENGTH_LIMIT = 62000000;
import { t } from 'i18next';

interface readFileResult {
  isBigFile: boolean;
}

export interface AbstractGraphData {
  fsPath: string;
  funcHash?: string;
  isUsedDB: boolean;
  dataMap: Record<string, string>;
  funcHashMap: Record<string, any>;
  calleeOpMagic?: string;
  calleeOpSubgraphId?: string;
  calleeOpAttrMap: Record<string, string>;
  readFileAndSetCache(fsPath: string, panel: any): Promise<readFileResult>;
  getCompleteData(fsPath: string): Promise<any>;
}

export abstract class GraphData {
  fsPath: string;
  funcHash?: string;
  funcHashMap: Record<string, any> = {};
  dataMap: Record<string, string> = {};
  callHashArrMap: Record<string, string> = {};
  calleeOpAttrMap: Record<string, string> = {};
  isUsedDB = false;
  calleeOpMagic?: string;
  calleeOpSubgraphId?: string;
  /** 外部可 await 的“写入+提交”完成信号 */
  public writeDone!: Promise<void>;

  constructor(fsPath: string, funcHash: string | undefined, calleeOpMagic?: string, calleeOpSubgraphId?: string) {
    this.fsPath = fsPath;
    this.funcHash = funcHash;
    this.calleeOpMagic = calleeOpMagic;
    this.calleeOpSubgraphId = calleeOpSubgraphId;
  }

  // 读取json文件并存入缓存 并返回大小文件判断
  async readFileAndSetCache(fsPath: string, panel: any): Promise<readFileResult> {
    const fileStream = createReadStream(fsPath);
    const pipeline = fileStream.pipe(parser()).pipe(streamValues());
    const result: readFileResult = { isBigFile: false };

    return await new Promise((resolve, reject) => {
      pipeline
        .on('data', async (ele) => {
          // 处理数据
          const value = ele.value;
          if (!value.functions) return;
          await this.processFunctions(fsPath, value, result, panel);
        })
        .on('end', () => {
          resolve(result);
        })
        .on('error', (err) => {
          // 错误处理
          reject(err);
        });
    });
  }

  async getCompleteData(fsPath) {
    const fileStream = createReadStream(fsPath);
    const pipeline = fileStream.pipe(parser()).pipe(streamValues());
    let result: any;

    return await new Promise((resolve, reject) => {
      pipeline
        .on('data', async (ele) => {
          // 处理数据
          const value = ele.value;
          if (!value.functions) return;
          result = value;
        })
        .on('end', () => {
          resolve(result);
        })
        .on('error', (err) => {
          // 错误处理
          reject(err);
        });
    });
  }

  private async processFunctions(fsPath: string, value: any, result: readFileResult, panel: any): Promise<void> {
    try {
      const sqlJobs: (() => Promise<void>)[] = [];
      /* 1. 汇总 funcHashMap */
      for (const funcItem of value.functions) {
        const hash = String(funcItem.hash);
        this.funcHashMap[hash] = {
          functype: funcItem.functype || null,
          func_magicname: funcItem.func_magicname || null,
        };
      }
      if (this.isUsedDB) {
        sqlJobs.push(() => SQLiteCache.getInstance().comGraphFileHashMapSet(fsPath, JSON.stringify(this.funcHashMap)));
      }

      /* 2. 构造插入任务数组 */
      const tasks: (() => Promise<void>)[] = [];
      const lastChangeTime = await getMTime(fsPath);

      for (const funcItem of value.functions) {
        const callHashArr: string[] = [];
        for (const op of funcItem.operations) {
          if (op.calleehash) {
            callHashArr.push(String(op.calleehash));
            if (Array.isArray(op.attr) && op.attr.length > 0) {
              op.attr[0] = op.calleehash;
            }
            op.functype = this.funcHashMap[op.calleehash]?.functype;
            op.func_magicname = this.funcHashMap[op.calleehash]?.func_magicname;
            if (op.opmagic.toString()) {
              if (this.isUsedDB) {
                const ioperands = [...new Set(op.ioperands)];
                sqlJobs.push(() =>
                  SQLiteCache.getInstance().comGraphFileCalleeOpAttrSet(
                    op.calleehash,
                    op.opmagic,
                    op.subgraphid.toString(),
                    JSON.stringify(op.attr),
                    JSON.stringify(ioperands),
                  ),
                );
              } else {
                this.calleeOpAttrMap[op.calleehash + '_' + op.opmagic + '_' + op.subgraphid] = op.attr.toString();
              }
            }
          }
        }

        const data = JSON.stringify(funcItem);
        if (!this.isUsedDB) {
          // 不用缓存数据库的情况
          this.dataMap[funcItem.hash] = data;
          this.callHashArrMap[funcItem.hash] = callHashArr.toString();
          return;
        }
        if (data.length >= DATA_LENGTH_LIMIT) {
          result.isBigFile = true;
          const bigPath = await SQLiteCache.getInstance().createBigDataFile(funcItem.hash, data);
          sqlJobs.push(() =>
            SQLiteCache.getInstance().comGraphFuncDataSet(
              fsPath,
              String(funcItem.hash),
              callHashArr.toString(),
              '',
              bigPath,
              lastChangeTime,
            ),
          );
        } else {
          sqlJobs.push(() =>
            SQLiteCache.getInstance().comGraphFuncDataSet(fsPath, String(funcItem.hash), callHashArr.toString(), data, '', lastChangeTime),
          );
        }
      }
      // 等所有 INSERT 真正进内存 DB
      if (sqlJobs.length) {
        await Promise.all(sqlJobs.map((fn) => fn()));
      }
      await SQLiteCache.getInstance().save();
    } catch (e) {
      console.warn('[DB] 数据库操作失败，自动降级 >>>', e);
      if (this.isUsedDB) {
        this.isUsedDB = false;
        // 立即重新走内存分支
        return await this.processFunctions(fsPath, value, result, panel);
      } else {
        panel.webview.postMessage({
          command: 'returnError',
          data: t('pypto.readFileDataErrorOnOpenComGraph'),
        });
      }
    }
  }

  static async getEntryHash(fsPath: string): Promise<string | undefined> {
    return new Promise((resolve, reject) => {
      const pipeline = createReadStream(fsPath).pipe(parser());
      const picked = pipeline.pipe(pick({ filter: 'entryhash' }));
      picked.on('data', (chunk: any) => {
        if (chunk.name === 'stringValue') {
          resolve(chunk.value);
          picked.destroy();
        }
      });
      picked.on('end', () => {
        resolve(undefined);
      });
    });
  }
}

export class SingleGraphData extends GraphData {
  // 目前没有任何额外字段/逻辑，只是“能实例化”
}

export class DiffGraphData extends GraphData {
  // 目前没有任何额外字段/逻辑，只是“能实例化”
}
