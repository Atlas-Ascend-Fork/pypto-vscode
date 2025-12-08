import { Uri, ViewColumn, commands, window, WebviewPanel, workspace, ConfigurationTarget } from 'vscode';
import { hismartliteEx } from '../hismarliteEx';
import { Util } from '../util';
import { dirname, join, extname, resolve } from 'path';
import { createReadStream, existsSync, readFileSync, readdirSync } from 'fs';
import { t } from 'i18next';
import { getIDETheme } from '../theme';
import Filter from 'stream-json/filters/Filter';
import { convertPmuInfo, parsePmuInfo, parseSwimLaneInfo, savePmuToDB, processTotalPmuCalc, saveParsedInfoToDB, saveLane2LineToDB, saveProcessesToDB, convertSwimInfo, convertLane2LineInfo, refreshSwimGraphDB } from '../process';
import fs from 'fs';
import { getMTime, SQLiteCache } from '../core/sqliteCache';
import { GraphView } from '../view/graphView';
import * as vscode from 'vscode';

export abstract class SwimGraphMsgHandler {
    static cachePath: string;

    public static readonly WHITE_COMMANDS = new Set([
        'getSwimData',
        'bindComGraphJson',
        'unbindComGraph',
        'jumpToComGraph',
        'openBoundComGraph',
        'jumpRawMagic',
        'showMessage',
        'saveRendingMode',
        'changeUserCfgConnection',
    ]);

    static async getInitialData(server: any) {
        server.setRef('returnSwim', { data: {} });
    }

    static async getSwimData(server: any) {
        const swimPath = server.swimDataPath;
        if (!existsSync(swimPath)) {
            server.setRef('noSwimFile', swimPath);
            return;
        }
        this.cachePath = Util.getCachePath();
        const cache = Util.readSwim2ComGraphMap(this.cachePath);
        const comGraphPath = cache[swimPath];
        const colorRendingMode = cache['colorRending'] ?? 'subGraph';
        const isThreeServer = server && server.constructor && server.constructor.name.includes('Three');
        const colorRending = isThreeServer ? 'label' : colorRendingMode;
        const textRending = cache['textRending']?.length === 0 ? ['taskName', 'taskLabel'] : cache['textRending'] ?? ['taskName', 'taskLabel'];
        const config = Util.getSwimGraphCustomCfg();
        config['colorRending'] = colorRending;
        config['textRending'] = textRending;
    
        const parsedInfoRow = await SQLiteCache.getInstance().swimGraphParsedInfoGetByFilePath(swimPath);
        let swimData: any = {};
        const swimLastChangeTime = await getMTime(swimPath);

        const pmuPath = resolve(dirname(swimPath), 'tilefwk_prof_pmu.csv');
        let pmuLastChangeTime = '';
        if (fs.existsSync(pmuPath)) {
          pmuLastChangeTime = await getMTime(pmuPath);
        }
        const dynTopoPath = join(dirname(swimPath), 'dyn_topo.txt');
        let dynTopoLastChangeTime = '';
        if (fs.existsSync(dynTopoPath)) {
          dynTopoLastChangeTime = await getMTime(dynTopoPath);
        }

        let fileChanged = false;
        if (parsedInfoRow.length > 0) {
          if (swimLastChangeTime != parsedInfoRow[0].last_change_time || 
              dynTopoLastChangeTime != parsedInfoRow[0].dyn_topo_last_change_time ||
              pmuLastChangeTime != parsedInfoRow[0].pmu_last_change_time) {
            fileChanged = true;
          }
        }
    
        if (parsedInfoRow.length > 0 && !fileChanged) {
          //数据库有数据且文件未修改，直接从数据库读取
          console.log(parsedInfoRow[0].info);
          const fileUri = vscode.Uri.file(parsedInfoRow[0].info);
          const fileData = await vscode.workspace.fs.readFile(fileUri);
          const content = new TextDecoder().decode(fileData);
          swimData = JSON.parse(content);
        } else {
          //解析数据
          //处理tilefwk_prof_pmu.csv
          let pmuInfo = {};
          let pmuExist = false;
          let pmuTotal:any = {};
          if (fs.existsSync(pmuPath)) {
            //tilefwk_prof_pmu.csv文件存在
            pmuExist = true;
            let pmuData = '';
              try {
                pmuData = readFileSync(pmuPath, 'utf8');
                console.log('读取pmu文件');
          
              } catch (err) {
                console.error('读取pmu文件时发生错误:', err);
              }
              if (pmuData != '') {
                pmuInfo = parsePmuInfo(pmuData);
              }
    
            //计算pmu Total
            pmuTotal = {
              'total cycle': 0n,
              vec_busy_cycles: 0n,
              cube_busy_cycles: 0n,
              scalar_busy_cycles: 0n,
              mte1_busy_cycles: 0n,
              mte2_busy_cycles: 0n,
              mte3_busy_cycles: 0n,
              icache_miss: 0n,
              icache_req: 0n
            };
            for (const uniqueKey in pmuInfo) {
              pmuTotal['total cycle'] += BigInt(pmuInfo[uniqueKey]['total cycle']);
              pmuTotal.cube_busy_cycles += BigInt(pmuInfo[uniqueKey].cube_busy_cycles);
              pmuTotal.vec_busy_cycles += BigInt(pmuInfo[uniqueKey].vec_busy_cycles);
              pmuTotal.scalar_busy_cycles += BigInt(pmuInfo[uniqueKey].scalar_busy_cycles);
              pmuTotal.mte1_busy_cycles += BigInt(pmuInfo[uniqueKey].mte1_busy_cycles);
              pmuTotal.mte2_busy_cycles += BigInt(pmuInfo[uniqueKey].mte2_busy_cycles);
              pmuTotal.mte3_busy_cycles += BigInt(pmuInfo[uniqueKey].mte3_busy_cycles);
              pmuTotal.icache_miss += BigInt(pmuInfo[uniqueKey].icache_miss);
              pmuTotal.icache_req += BigInt(pmuInfo[uniqueKey].icache_req);
            }
            processTotalPmuCalc(pmuTotal);
          }
          
          //处理merged_swimlane.json
          let swimStr = '';
    
          try {
            swimStr = readFileSync(swimPath, 'utf8');
            this.validateFile(server, swimStr);
            console.log('读取merged_swimlane.json文件');
    
          } catch (err) {
            console.error(`${swimPath}读取swimlane文件时发生错误:`, err);
          }
    
          //处理dyn_topo
          const task2topo = {};
          try {
            const dynTopoContent = readFileSync(dynTopoPath, 'utf-8');
            const dynTopoLines = dynTopoContent.split('\n').slice(1);
            for (const line of dynTopoLines) {
              const curLine = line.split(',');
              if (curLine.length >= 10) {
                const seqNo = curLine[0];
                const taskId = curLine[1];
                const leafIndex = curLine[5];
                const successors = curLine.slice(9)
                                          .map(item => item.trim())
                                          .filter(item => item !== '')
                                          .map(item => `${seqNo}-${item}`);
                task2topo[`${seqNo}-${taskId}`] = { leafIndex, successors };
              }
            } 
          } catch (error) {
            console.log('读取dyn_topo.txt发生错误',error);
          } 
    
          const swimDataObj = JSON.parse(swimStr);
          swimData = await parseSwimLaneInfo(swimDataObj, pmuInfo, task2topo, colorRending);
          swimData.lane2line = Object.fromEntries(swimData.lane2line);
          swimData.processes = Object.fromEntries(swimData.processes);
          swimData.processExpanded = Object.fromEntries(swimData.processExpanded);
          for (const key in swimData.processes) {
            swimData.processes[key].threads = Object.fromEntries(swimData.processes[key].threads);
          }
          
          if (pmuExist) {
            swimData.pmu_total = pmuTotal;
          }
    
          swimData.counterEvents = [];
          
          if (parsedInfoRow.length > 0 && swimLastChangeTime != parsedInfoRow[0].last_change_time) {
            //数据库有数据，但文件已被修改，删除数据
            await SQLiteCache.getInstance().swimGraphParsedInfoDelByFilePath(swimPath);
            await SQLiteCache.getInstance().save();
          }
          //插入数据
          saveParsedInfoToDB(swimPath, swimLastChangeTime, dynTopoLastChangeTime, pmuLastChangeTime ,JSON.stringify(swimData));
        }
        
        console.log('returnSwimData message send');

        return {
          data: swimData,
          configration: config,
          comGraphPath,
          swimPath,
        };
      }
    
    static async validateFile(server: any, content: string) {
        server.setRef('validateSwimFile', {
            content,
        });
    };

    // 绑定计算图文件
    static async bindComGraphJson(server: any) {
        const swimPath = server.swimDataPath;

        const uris = await window.showOpenDialog({
            canSelectMany: false,
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            },
            title: t('pypto.selectComGraph') || '',
        });
        if (!uris || uris.length === 0) {
            server.setRef('bindResult', {
                success: false,
                message: t('pypto.noFileSelect')
            });
            return;
        }

        const comGraphUri = uris[0];
        const comGraphPath = comGraphUri.fsPath;
        const cache: any = Util.readSwim2ComGraphMap(this.cachePath);
        cache[swimPath] = comGraphPath;
        Util.writeSwim2ComGraphMap(this.cachePath, cache);

        server.setRef('bindResult', {
            success: true,
            message: t('pypto.optSucc'),
            comGraphPath,
        });
        window.showInformationMessage(t('pypto.optSucc'));
        return comGraphPath;
    }

    // 解绑计算图路径
    static async unbindComGraph(server: any) {
        const swimPath = server.swimDataPath;

        const cache = Util.readSwim2ComGraphMap(this.cachePath);

        if (!cache[swimPath]) {
            server.setRef('unbindResult', {
                success: false,
                message: t('pypto.noBinding'),
            });
            return;
        }

        delete cache[swimPath];
        Util.writeSwim2ComGraphMap(this.cachePath, cache);

        server.setRef('unbindResult', {
            success: true,
            message: t('pypto.optSucc'),
        });

        window.showInformationMessage(t('pypto.optSucc'));
    }

    // 跳转至计算图
    static async jumpToComGraph(server: any, paramObj: { hash: string }) {
        const swimPath = server.swimDataPath;

        const cache = Util.readSwim2ComGraphMap(this.cachePath);
        let comGraphPath = cache[swimPath];
        if (!comGraphPath) {
            // 在用户未配置计算图时，优先找同级目录的计算图
            const swimDir = dirname(swimPath);
            const programPath = join(swimDir, 'program.json');
            if (existsSync(programPath)) {
                comGraphPath = programPath;
                cache[swimPath] = comGraphPath;
                Util.writeSwim2ComGraphMap(this.cachePath, cache);
                server.setRef('bindResult', {
                    success: true,
                    message: t('pypto.optSucc'),
                    comGraphPath,
                });
                window.showInformationMessage(t('pypto.optSucc'));
            } else {
                comGraphPath = await this.bindComGraphJson(server);
            }
        }
        if (!comGraphPath) {
            server.setRef('bindResult', {
                success: false,
            });
            window.showWarningMessage(t('pypto.noBinding'));
            return;
        }

        commands.executeCommand('PyPTO.OpenComGraphByFunchash', Uri.file(comGraphPath), paramObj.hash);
    }

    // 打开计算图文件
    static async openBoundComGraph(server: any) {
        const swimPath = server.swimDataPath;

        const cache = Util.readSwim2ComGraphMap(this.cachePath);
        const comGraphPath = cache[swimPath];

        if (!comGraphPath) {
            // 未绑定
            window.showWarningMessage(t('pypto.noBinding'));
            return;
        }

        if (!existsSync(comGraphPath)) {
            window.showErrorMessage(`${t('pypto.fileNodeExist')}: ${comGraphPath}`, t('unbind')).then((res: string | undefined) => {
                if (res === t('unbind')) {
                    this.unbindComGraph(server);
                }
            });
            return;
        }

        const comGraphUri = Uri.file(comGraphPath);
        commands.executeCommand('vscode.open', comGraphUri);
    }

    // 根据rawmagic跳转dump_tensor，ascendHint示例：Task:[10-54-18], rootIndex:1, psIdInStatic:0, func:xxx
    static async jumpRawMagic(server: any, paramObj: { rawmagic: number, ascendHint: string }) {
        const { rawmagic, ascendHint } = paramObj;
        const swimPath = server.swimDataPath;
        const swimDir = dirname(swimPath);

        const match = ascendHint.match(/Task:\[(\d+(?:-\d+)*)\]/);
        if (!match) {
            window.showErrorMessage(t('pypto.taskInvalid'));
            return;
        }

        const taskNo = match[1];
        const taskId = taskNo.split('-')[0];
        const seqDir = join(swimDir, 'dump_tensor', `seqNo-${taskId}`);
        if (!existsSync(seqDir)) {
            window.showWarningMessage(t('pypto.seqDirNotFound', { seqDir }), t('pypto.confirm'));
            return;
        }

        const rawmagicStr = rawmagic.toString();
        const exactFileName = `${taskNo}-${rawmagicStr}.txt`;
        const exactFilePath = join(seqDir, exactFileName);

        let targetFile: string | null = null;

        if (existsSync(exactFilePath)) {
            targetFile = exactFilePath;
        } else {
            try {
                const prefixPattern = `${taskNo}-${rawmagicStr}-`;
                const files = readdirSync(seqDir);

                for (const file of files) {
                    if (extname(file).toLowerCase() === '.txt' && file.startsWith(prefixPattern)) {
                        targetFile = join(seqDir, file);
                        break;
                    }
                }
            } catch (err) {
                window.showErrorMessage(t('pypto.readDirFailed', { seqDir, error: (err as Error).message }), t('pypto.confirm'));
                return;
            }
        }

        if (targetFile) {
            workspace.openTextDocument(targetFile)
                .then((doc: any) => {
                    window.showTextDocument(doc, { preview: false });
                })
        } else {
            window.showInformationMessage(t('pypto.fileNotFound', { seqDir, rawmagic, exactFileName, taskNo, rawmagicStr }), t('pypto.confirm'));
        }
    }

    // 提示信息
    static async showMessage(server: any, paramObj: { text: string }) {
        window.showInformationMessage(paramObj.text);
    }
    // 保存全局配置
    static async saveRendingMode(server: any, paramObj: string) {
        Util.writeSwimConfigMap(this.cachePath, paramObj);
    }
    static async changeUserCfgConnection(server: any, paramObj: { level: number }) {
        const config = workspace.getConfiguration('PyPTOToolkit');
        config.update('connectionLevel', paramObj.level, ConfigurationTarget.Global);
    }
}