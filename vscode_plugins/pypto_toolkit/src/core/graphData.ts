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
  outputDirPath?: string;
  pathName?: string;
  calleeOpAttrMap: Record<string, string>;
  curPath?: string;
  magicName?: string;
  readFileAndSetCache(fsPath: string): Promise<readFileResult>;
  getCompleteData(fsPath: string): Promise<any>;
}

export abstract class GraphData {
  funcHashMap: Record<string, any> = {};
  dataMap: Record<string, string> = {};
  callHashArrMap: Record<string, string> = {};
  calleeOpAttrMap: Record<string, string> = {};
  isUsedDB = false;
  version?: string;

  /** 外部可 await 的“写入+提交”完成信号 */
  public writeDone!: Promise<void>;

  constructor(
    public fsPath: string,
    public funcHash: string | undefined,
    public calleeOpMagic?: string,
    public calleeOpSubgraphId?: string,
    public outputDirPath?: string,
    public pathName?: string,
    public curPath?: string,
    public magicName?: string,
    public parentInfo?: any,
  ) { }

  // 读取json文件并存入缓存 并返回大小文件判断
  async readFileAndSetCache(fsPath: string): Promise<readFileResult> {
    const fileStream = createReadStream(fsPath);
    const jsonParser = parser();
    const valuesStreamer = streamValues();
    const result: readFileResult = { isBigFile: false };

    return await new Promise((resolve, reject) => {
      fileStream.on('error', (err: any) => {
        // 文件读取错误（如文件不存在、权限问题）
        reject(Object.assign(err, { code: 'FILE_READ_ERROR' }));
      });

      jsonParser.on('error', (err: any) => {
        // JSON 解析错误（如格式无效）
        reject(Object.assign(err, { code: 'JSON_PARSE_ERROR' }));
      });

      valuesStreamer.on('error', (err: any) => {
        // StreamValues 错误（较少见，但保险起见）
        reject(Object.assign(err, { code: 'STREAM_PROCESSING_ERROR' }));
      });
      const pipeline = fileStream.pipe(jsonParser).pipe(valuesStreamer);
      pipeline
        .on('data', async (ele) => {
          // 处理数据
          const value = ele.value;
          if (!value.functions) return;
          try {
            await this.processFunctions(fsPath, value, result);
          } catch (error) {
            reject(error);
          }
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

  private async processFunctions(fsPath: string, value: any, result: readFileResult): Promise<void> {
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
          const bigFilePath = await SQLiteCache.getInstance().createBigDataFile(funcItem.hash, data);
          sqlJobs.push(() =>
            SQLiteCache.getInstance().comGraphFuncDataSet(
              fsPath,
              String(funcItem.hash),
              callHashArr.toString(),
              '',
              bigFilePath,
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
      if (this.isUsedDB) {
        console.warn('[DB] 数据库操作失败，自动降级 >>>', e);
        this.isUsedDB = false;
        // 立即重新走内存分支
        return await this.processFunctions(fsPath, value, result);
      } else {
        console.error('纯内存操作失败，数据可能有误', e);
        throw Object.assign(new Error(), { code: 'PURE_MEMORY' });
      }
    }
  }

  static async getEntryHashAndVersion(fsPath: string): Promise<EntryInfo> {
    const fileStream = createReadStream(fsPath);
    const jsonParser = parser();
    const valuesStreamer = streamValues();

    return new Promise((resolve, reject) => {
      fileStream.on('error', (err: any) => {
        // 文件读取错误（如文件不存在、权限问题）
        reject(Object.assign(err, { code: 'FILE_READ_ERROR' }));
      });

      jsonParser.on('error', (err: any) => {
        // JSON 解析错误（如格式无效）
        reject(Object.assign(err, { code: 'JSON_PARSE_ERROR' }));
      });

      valuesStreamer.on('error', (err: any) => {
        // StreamValues 错误（较少见，但保险起见）
        reject(Object.assign(err, { code: 'STREAM_PROCESSING_ERROR' }));
      });

      const pipeline = fileStream.pipe(jsonParser).pipe(valuesStreamer);
      // const pipeline = createReadStream(fsPath).pipe(parser()).pipe(streamValues());

      pipeline
        .on('data', (data: any) => {
          const obj = data.value;
          if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
            const result: EntryInfo = {
              entryhash: typeof obj.entryhash === 'string' ? obj.entryhash : undefined,
              version: typeof obj.version === 'string' ? obj.version : undefined,
            };
            pipeline.destroy();
            resolve(result);
          }
        })
        .on('end', () => resolve({}))
        .on('error', (err: any) => {
          // 错误处理
          reject(err);
        });
    });
  }
}

interface EntryInfo {
  entryhash?: string;
  version?: string;
}

export class SingleGraphData extends GraphData {
  // 目前没有任何额外字段/逻辑，只是“能实例化”
}

export class DiffGraphData extends GraphData {
  // 目前没有任何额外字段/逻辑，只是“能实例化”
}
