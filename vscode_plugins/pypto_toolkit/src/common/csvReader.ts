import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync'; // 同步解析，简单场景可用
import { AccuracyToolData, SQLiteCache } from '../core/sqliteCache';
import * as readline from 'readline';
import { t } from 'i18next';

export async function readCsv(oriFilePath: string) {
    if (!oriFilePath || oriFilePath.length === 0 || !fs.existsSync(oriFilePath)) {
        return;
    } 

    try {
        const buffer = fs.readFileSync(oriFilePath);
        const content = buffer.toString('utf-8');
        
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            relax_column_count_less: true,
        }) as any[];
        
        const recordLength = records.length;
        vscode.window.showInformationMessage(t('pypto.accuracyCsvParseSucc', { recordLength }));

        // 使用循环而非 forEach，以便处理异步或错误捕获
        for (const row of records) {
            // 数据映射：将 CSV 的特殊键名映射到标准的驼峰命名接口
            const dataToSave: AccuracyToolData = {
                // --- 主键字段 ---
                filePath: oriFilePath,
                no: row['NO.'],
                phaseName: row['B>PHASE_NAME'],
                funcMagicName: row['PATH_FUNC:func_magicname'],
                rawMagic: row['B>:rawmagic'],

                // --- 结果与配置字段 ---
                result: row['AB>RESULT'],
                dataType: row[':datatype'],
                validShape: row[':validshape'],
                loopInfo: row['LOOP_INFO'],

                // --- 容差与计数 (包含斜杠 / 的字段) ---
                rtolAtol: row['AB>rtol/atol'],
                cntFailWarnTol: row['AB>fail_cnt/warn_cnt/tol_cnt'],
                cntTotalZeroInfnanCnt: row['AB>total_cnt/zero_cnt/infnan_cnt'],

                // --- MRE 相关指标 ---
                mre: row['AB>mre'],
                mreTop1permil: row['AB>mre_top1permil'],
                mreTop8: row['AB>mre_top8'],

                // --- MAE 相关指标 ---
                mae: row['AB>mae'],
                maeTop8: row['AB>mae_top8'],
                maeTop1permil: row['AB>mae_top1permil'],

                // --- A 组统计数据 ---
                aMax: row['A>max'],
                aMin: row['A>min'],
                aAvg: row['A>avg'],
                aAavg: row['A>aavg'],
                aZero: row['A>zero'],
                aInfnan: row['A>infnan'],

                // --- B 组统计数据 ---
                bMax: row['B>max'],
                bMin: row['B>min'],
                bAvg: row['B>avg'],
                bAavg: row['B>aavg'],
                bZero: row['B>zero'],
                bInfnan: row['B>infnan'],

                // --- 时间戳
                bTimestamp: row['B>TIMESTAMP']
            };

            // 4. 保存到数据库
            await SQLiteCache.getInstance().accuracyToolSet(dataToSave);
            await SQLiteCache.getInstance().save();
        }
        vscode.window.showInformationMessage(t('pypto.accuracyCsvParseRes', { recordLength }));

        return true;
    } catch (err) {
        vscode.window.showInformationMessage(t('pypto.accuracyCsvParseFail', { err }));
        return false;
    }
}

export async function getCsvData() {
    const filePath = "";
    const phaseName = "";
    const funcMagicName = "";
    const start = "";
    const end = "";
    const extractor = new SmartLogExtractor();
    const resultLog = extractor.extract(filePath, start, end).then(console.log);
    console.log('日志读取数据:', resultLog);
 
}

export class SmartLogExtractor {
    /**
     * 统一策略：流式读取 + 找到即停
     * 优势：
     * 1. 内存安全：无论文件多大，内存占用极低。
     * 2. 速度极快：一旦找到结束标记，立即停止磁盘 I/O（特别是大文件的尾部匹配）。
     * 3. 代码简洁：单一职责，易于维护。
     */
    public async extract(filePath: string, startKeyword: string, endKeyword: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const result: string[] = [];
            let isRecording = false;
            let isFinished = false;
    
            if (!fs.existsSync(filePath)) {
                reject(new Error(`文件不存在: ${filePath}`));
                return;
            }
    
            const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
            const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    
            rl.on('line', (line) => {
                if (isFinished) return;

                if (isRecording && line.startsWith(endKeyword)) {
                    isFinished = true;
                    stream.destroy(); 
                    rl.close();
                    return;
                }

                if (!isRecording && line.includes(startKeyword)) {
                    isRecording = true;
                    result.push(line);
                    return;
                }

                if (isRecording) {
                    result.push(line);
                }
            });
    
            rl.on('close', () => {
                resolve(result);
            });
    
            stream.on('error', (err) => {
                // 如果是主动 destroy() 导致的 error，可以忽略，或者直接 resolve
                if (isFinished) {
                    resolve(result);
                } else {
                    reject(err);
                }
            });
        });
    }
}

