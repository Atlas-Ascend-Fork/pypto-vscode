import { Uri, commands, window, workspace, ConfigurationTarget } from 'vscode';
import { Util } from '../util';
import { dirname, join, extname, resolve, basename } from 'path';
import { accessSync, constants, existsSync, readFileSync, readdirSync } from 'fs';
import { t } from 'i18next';
import { readCompressedFile, runCompress } from '@pypto/data-compress';
import { getIDETheme } from '../theme';
import Filter from 'stream-json/filters/Filter';
import { parsePmuInfo, parseSwimLaneInfo, processTotalPmuCalc, saveParsedInfoToDB, readSwimlaneFileStream, saveCompressedDataPathToDB, writeLargeObjectToFileThreadGranular, getSavedSwimDataFileStreamAll} from '../process';
import fs from 'fs/promises';
import { getMTime, SQLiteCache } from '../core/sqliteCache';
import * as vscode from 'vscode';
import { getBasenameWithoutExt } from '../command/registerCommand';
import { hismartliteEx } from '../hismarliteEx';
import { useService } from '../services';
import { getSwimGraphParsedInfoStore, swimGraphPasedInfoCache } from '../core/swimSqlInit';
import { FormatValidator, PerfSwimlaneConverter } from '../converter';
import { readFirstNLines } from '../utils/file-system';

const CACHE_LARGE_FILE_SIZE = 500;

export abstract class SwimGraphMsgHandler {
    static cachePath: string;
    static cacheCfgPath: string;

    public static readonly WHITE_COMMANDS = new Set([
        'getSwimData',
        'getData',
        'getOtherData',
        'getPerformanceInfo',
        'getCompressedData',
        'bindComGraphJson',
        'unbindComGraph',
        'jumpToComGraph',
        'openBoundComGraph',
        'jumpRawMagic',
        'showMessage',
        'saveRendingMode',
        'changeUserCfgConnection',
        'changeUserCfgPerformance',
        'changeUserCfgIsMixMode',
        'getShortCutKeyCfg',
    ]);

    static async getInitialData(server: any) {
        server.setRef('returnSwim', { data: {} });
    }

    static warnPerformance(server: any, size: any, swimPerformanceBase: any) {
      const baseSizes = Object.keys(swimPerformanceBase.vsOpen)
        .map(Number)
        .sort((a, b) => a - b);
      const keys = Object.keys(swimPerformanceBase.vsOpen).map(Number);
      const minKey = Math.min(...keys);
      const maxKey = Math.max(...keys);

      function getEstimatedTimeRange(fileSizeInMB) {
        for (let i = 0; i < baseSizes.length - 1; i++) {
          const lowerSize = baseSizes[i];
          const upperSize = baseSizes[i + 1];
      
          if (fileSizeInMB >= lowerSize && fileSizeInMB <= upperSize) {
            const lowerTime = swimPerformanceBase.vsOpen[lowerSize];
            const upperTime = swimPerformanceBase.vsHW[upperSize];
            return { type: 'range', lower: lowerTime, upper: upperTime };
          }
        }
      }
    
      const fileSizeInMB = Math.ceil(size / (1024 * 1024)); // 转为 MB 并向上取整
      if (fileSizeInMB <= minKey) {
        return;
      }
      if (fileSizeInMB >= maxKey) {
        server.setRef('performanceWarn', t('pypto.swimGraph.performance.tooLarge'));
        return;
      }
      const result = getEstimatedTimeRange(fileSizeInMB);
      if (result) {
        const lower = `${result.lower}s`;
        const upper = `${result.upper}s`;
        server.setRef('performanceWarn', t('pypto.swimGraph.performance.useTime', { lower, upper }));
      }
    }

    static async getOtherData(server: any) {
      const swimPath = server.swimDataPath;
      try {
        accessSync(swimPath, constants.R_OK);
      } catch (err: any) {
        server.setRef('noSwimFile', { errMsg: err.message });
        return;
      }
      this.cachePath = Util.getCachePath('swim2com.json');
      this.cacheCfgPath = Util.getCachePath('swimRenderingCfg.json');
      const swim2com = Util.readSwim2ComGraphMap(this.cachePath);
      const cfgCache = Util.readSwim2ComGraphMap(this.cacheCfgPath);
      const comGraphPath = swim2com[swimPath];
      const colorRendingMode = cfgCache['colorRending'] ?? 'subGraph';
      const isThreeServer = server && server.constructor && server.constructor.name.includes('Three');
      const colorRending = isThreeServer ? 'label' : colorRendingMode;
      const textRending = cfgCache['textRending']?.length === 0 ? ['taskName', 'taskLabel'] : cfgCache['textRending'] ?? ['taskName', 'taskLabel'];
      const aicpuColorRending = cfgCache['aicpuColorRending'] || 'name';
      const perfColorReding = cfgCache['perfColorReding'] || 'perfName';
      const hashOrderRending = cfgCache['hashOrderRending'] || 'cubeMergeHashOrder';
      const config = Util.getSwimGraphCustomCfg();
      config['kernelTextRending'] = textRending;
      config['aicpuColorRending'] = aicpuColorRending;
      config['perfColorReding'] = perfColorReding;
      config['kernelColorRending'] = colorRending;
      config['hashOrderRending'] = hashOrderRending;
      if (!server.query || server.query.isPerfSwim === undefined) {
        const content = ((await readFirstNLines(swimPath, 10)) as string[]).join('');
        server.query = {};
        server.query.isPerfSwim = !content.includes('traceEvents');
      }
      return {
        isDebug: hismartliteEx.isDebug,
        configuration: config,
        comGraphPath,
        swimPath,
        title: getBasenameWithoutExt(swimPath),
        isPerfSwim: server.query.isPerfSwim
      };
    }

    static async getPerformanceInfo(server: any) {
      return {
        startTime: hismartliteEx.startTime,
        transformStartTime: hismartliteEx.transformStartTime,
      };
    }

    static async splitJson(swimData: any) {
      let eventSize = 2000;
      let sendList: any[] = [];

      //发送整体信息
      let overAllpackage = structuredClone(swimData);
      for (const processId in overAllpackage.processes) {
        for (const threadId in overAllpackage.processes[processId].threads) {
          overAllpackage.processes[processId].threads[threadId].events = [];
        }
      }
      let firstPkacge: any = {};
      firstPkacge.data = overAllpackage;
      firstPkacge.type = 'first';
      sendList.push(firstPkacge);
      
      //发送event信息
      for (const processId in swimData.processes) {
        for (const threadId in swimData.processes[processId].threads) {
          const eventsList =  swimData.processes[processId].threads[threadId].events;
          for (let i = 0; i < eventsList.length; i += eventSize) {
            let eventPackage: any = {};
            eventPackage.processId = processId;
            eventPackage.threadId = threadId;
            eventPackage.data = eventsList.slice(i, i + eventSize);
            eventPackage.type = 'events';
            sendList.push(eventPackage);
          }
        }
      }
      if (hismartliteEx.isDebug) {
        console.timeEnd('[Performance] backend parse');
      }
      return sendList;
    }

    static async getSwimData(server: any, isThreeColumn: boolean = false) {
        const swimPath = server.swimDataPath;
        try {
          accessSync(swimPath, constants.R_OK);
        } catch (err: any) {
          server.setRef('noSwimFile', { errMsg: err.message });
          return;
        }

        const swimFileStat = await fs.stat(swimPath);
        const useCacheStream = swimFileStat.size < CACHE_LARGE_FILE_SIZE * 1024 * 1024;
        let savedParsedDataPath = '';
    
        const parsedInfoRow = await getSwimGraphParsedInfoStore().find({filePath: swimPath});
        let swimData: any = {};
        const swimLastChangeTime = await getMTime(swimPath);

        const pmuPath = resolve(dirname(swimPath), 'tilefwk_prof_pmu.csv');
        let pmuLastChangeTime = '';
        if (existsSync(pmuPath)) {
          pmuLastChangeTime = await getMTime(pmuPath);
        }
        const dynTopoPath = join(dirname(swimPath), 'dyn_topo.txt');
        let dynTopoLastChangeTime = '';
        if (existsSync(dynTopoPath)) {
          dynTopoLastChangeTime = await getMTime(dynTopoPath);
        }

        let fileChanged = false;
        if (parsedInfoRow) {
          if (swimLastChangeTime != parsedInfoRow.lastChangeTime || 
              dynTopoLastChangeTime != parsedInfoRow.dynTopoLastChangeTime ||
              pmuLastChangeTime != parsedInfoRow.pmuLastChangeTime) {
            fileChanged = true;
          }
        }
    
        if (parsedInfoRow && !fileChanged && useCacheStream) {
          //数据库有数据且文件未修改，直接从数据库读取
          console.log(parsedInfoRow.infoPath);
          savedParsedDataPath = parsedInfoRow.infoPath;
          
          this.warnPerformance(server, swimFileStat.size, hismartliteEx.swimPerformanceBase.useCache);
          const fileUri = vscode.Uri.file(parsedInfoRow.infoPath);
          const fileData = await vscode.workspace.fs.readFile(fileUri);
          const content = new TextDecoder().decode(fileData);
          swimData = JSON.parse(content);
          if (typeof swimData.processes != 'object' || typeof swimData.lane2line != 'object' || typeof swimData.pmu_total != 'object') {
            const title = t('pypto.swimGraph.validate.parseError');
            const msg = t('pypto.swimGraph.validate.savedData');
            server.setRef('dataError', { msg: title + msg});
            return; 
          }
        } else {
          //解析数据
          //处理tilefwk_prof_pmu.csv
          this.warnPerformance(server, swimFileStat.size, hismartliteEx.swimPerformanceBase.first);
          let pmuInfo = {};
          let pmuExist = false;
          let pmuTotal:any = {};
          if (existsSync(pmuPath)) {
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
          }
          
          //处理merged_swimlane.json 或 perf_swimlane.json
          let swimlaneData: any = {};
    
          try {
            console.log('读取swimlane文件');
            if (server.query.isPerfSwim) {
              console.log('使用 perf_swimlane.json 格式处理');
              const rawData = await readSwimlaneFileStream(swimPath, true);
              const validation = FormatValidator.validatePerfSwimlane(rawData);
              if (!validation.valid) {
                server.setRef('dataError', { msg: t('pypto.comGraph.errorMessage.jsonParse'), log: validation.error });
                console.error('perf_swimlane.json 验证失败:', validation.error);
                return [];
              }
              
              const converter = new PerfSwimlaneConverter();
              const convertedData = converter.convert(rawData);
              swimlaneData.traceEvents = convertedData.traceEvents;
              console.log('perf_swimlane.json 转换完成');
            } else {
              console.log('使用 merged_swimlane.json 格式处理');
              const rawData = await readSwimlaneFileStream(swimPath);
              swimlaneData.traceEvents = rawData;
            }
    
          } catch (err: any) {
            server.setRef('dataError', { msg: t('pypto.comGraph.errorMessage.jsonParse'), log: err.message} );
            console.error(`${swimPath}读取swimlane文件时发生错误:`, err);
            return [];
          }
    
          //处理dyn_topo
          const task2topo = {};
          try {
            const dynTopoContent = readFileSync(dynTopoPath, 'utf-8');
            const dynTopoLines = dynTopoContent.split('\n');
            const headers = dynTopoLines[0].split(',').map(h => h.trim());
            const headerMap = new Map();
            headers.forEach((name, index) => {
              headerMap.set(name, index);
            });
            for (const line of dynTopoLines.slice(1)) {
              const curLine = line.split(',');
              if (curLine.length >= 10) {
                const seqNo = curLine[headerMap.get('seqNo')];
                const taskId = curLine[headerMap.get('taskId')];
                const leafIndex = curLine[headerMap.get('leafIndex')];
                const successors = curLine.slice(headerMap.get('successors')) // 需要确保successors是最后一列，且前面的title和值都是一一对应的
                                          .map(item => item.trim())
                                          .filter(item => item !== '')
                                          .map(item => `${seqNo}-${item}`);
                task2topo[`${seqNo}-${taskId}`] = { leafIndex, successors };
              }
            } 
          } catch (error) {
            console.log('读取dyn_topo.txt发生错误',error);
          } 
    
          const swimDataObj = swimlaneData;
          const effectPmu = {};
          swimData = await parseSwimLaneInfo(swimDataObj, pmuInfo, task2topo, effectPmu);
          if (Object.keys(effectPmu).length > 0) {
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
            for (const uniqueKey in effectPmu) {
              pmuTotal['total cycle'] += BigInt(effectPmu[uniqueKey]['total cycle']);
              pmuTotal.cube_busy_cycles += BigInt(effectPmu[uniqueKey].cube_busy_cycles);
              pmuTotal.vec_busy_cycles += BigInt(effectPmu[uniqueKey].vec_busy_cycles);
              pmuTotal.scalar_busy_cycles += BigInt(effectPmu[uniqueKey].scalar_busy_cycles);
              pmuTotal.mte1_busy_cycles += BigInt(effectPmu[uniqueKey].mte1_busy_cycles);
              pmuTotal.mte2_busy_cycles += BigInt(effectPmu[uniqueKey].mte2_busy_cycles);
              pmuTotal.mte3_busy_cycles += BigInt(effectPmu[uniqueKey].mte3_busy_cycles);
              pmuTotal.icache_miss += BigInt(effectPmu[uniqueKey].icache_miss);
              pmuTotal.icache_req += BigInt(effectPmu[uniqueKey].icache_req);
            }
            processTotalPmuCalc(pmuTotal);
          }
          if ('errMsg' in swimData) {
            const title = t('pypto.swimGraph.validate.parseError');
            server.setRef('dataError', { msg: title + swimData.errMsg});
            console.log('data ERROR:', swimData.errMsg);
            return [];
          }

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
          
          if (parsedInfoRow  && fileChanged) {
            //数据库有数据，但文件已被修改，删除数据
            await getSwimGraphParsedInfoStore().delete({filePath: swimPath});
          }
          //插入数据
          saveParsedInfoToDB(useCacheStream, swimPath, swimLastChangeTime, dynTopoLastChangeTime, pmuLastChangeTime, swimData);
        }
        
        console.log('returnSwimData message send');

        return await this.splitJson(swimData);
      }



      static async getCompressedData(server: any) {       
        let swimInfo: any;
        const swimPath = server.swimDataPath;
        try {
          accessSync(swimPath, constants.R_OK);
        } catch (err: any) {
          server.setRef('noSwimFile', { errMsg: err.message });
          return;
        }

        const swimFileStat = await fs.stat(swimPath);

        this.cacheCfgPath = Util.getCachePath('swimRenderingCfg.json');
        const cache = Util.readSwim2ComGraphMap(this.cacheCfgPath);
        const colorRendingMode = cache['colorRending'] ?? 'subGraph';
        const isThreeServer = server && server.constructor && server.constructor.name.includes('Three');
        const colorRending = isThreeServer ? 'label' : colorRendingMode;
        const textRending = cache['textRending']?.length === 0 ? ['taskName', 'taskLabel'] : cache['textRending'] ?? ['taskName', 'taskLabel'];
        const config = Util.getSwimGraphCustomCfg();
        config['colorRending'] = colorRending;
        config['textRending'] = textRending;
        let savedCompressedDataPath = '';
    
        const parsedInfoRow = await getSwimGraphParsedInfoStore().find({filePath: swimPath});
        let swimData: any = {};
        const swimLastChangeTime = await getMTime(swimPath);

        const pmuPath = resolve(dirname(swimPath), 'tilefwk_prof_pmu.csv');
        let pmuLastChangeTime = '';
        if (existsSync(pmuPath)) {
          pmuLastChangeTime = await getMTime(pmuPath);
        }
        const dynTopoPath = join(dirname(swimPath), 'dyn_topo.txt');
        let dynTopoLastChangeTime = '';
        if (existsSync(dynTopoPath)) {
          dynTopoLastChangeTime = await getMTime(dynTopoPath);
        }

        let fileChanged = false;
        if (parsedInfoRow) {
          if (swimLastChangeTime != parsedInfoRow.lastChangeTime || 
              dynTopoLastChangeTime != parsedInfoRow.dynTopoLastChangeTime ||
              pmuLastChangeTime != parsedInfoRow.pmuLastChangeTime) {
            fileChanged = true;
          }
        }
    
        if (parsedInfoRow && !fileChanged) {
          //数据库有数据且文件未修改，直接从数据库读取
          console.log(parsedInfoRow.infoPath);
          savedCompressedDataPath = parsedInfoRow.infoPath;
          this.warnPerformance(server, swimFileStat.size, hismartliteEx.swimPerformanceBase.useCache);
          swimInfo = await readCompressedFile(savedCompressedDataPath);          
        } else {
          const swimUri = vscode.Uri.file(swimPath);
          this.warnPerformance(server, swimFileStat.size, hismartliteEx.swimPerformanceBase.useCache);
          const swimFsPath = swimUri.fsPath;
          const swimFileName = swimFsPath.replace(/[\\/:*?"<>|]/g, '_');
          const pmuFsPath = join(dirname(swimFsPath), 'tilefwk_prof_pmu.csv');
          const topoFsPath = join(dirname(swimFsPath), 'dyn_topo.txt');
          const compressedDataPath = join(hismartliteEx.context!.globalStorageUri.fsPath, 'swimlane-db-info', `${swimFileName}.compressed`);
          const extensionOutput = vscode.window.createOutputChannel("Swimlane compressed");
          const logger = {
            log: (value) => extensionOutput.appendLine(`[${new Date().toISOString().split('.')[0]}][LOG] ${value}`),
            error: (value) => extensionOutput.appendLine(`[${new Date().toISOString().split('.')[0]}][ERR] ${value}`),
            warn: (value) => extensionOutput.appendLine(`[${new Date().toISOString().split('.')[0]}][WARN] ${value}`),
          }
          
          console.log(topoFsPath, existsSync(topoFsPath));
          console.log(pmuFsPath, existsSync(pmuFsPath) );

          // //适配3.0
          // let swimlaneData: any = {};
          // let newSwimFile;
    
          // try {
          //   console.log('读取swimlane文件');
          //   if (server.query.isPerfSwim) {
          //     console.log('使用 perf_swimlane.json 格式处理');
          //     const rawData = await readSwimlaneFileStream(swimPath, true);
          //     const validation = FormatValidator.validatePerfSwimlane(rawData);
          //     if (!validation.valid) {
          //       server.setRef('dataError', { msg: t('pypto.comGraph.errorMessage.jsonParse'), log: validation.error });
          //       console.error('perf_swimlane.json 验证失败:', validation.error);
          //       return [];
          //     }
              
          //     const converter = new PerfSwimlaneConverter();
          //     const convertedData = converter.convert(rawData);
          //     swimlaneData.traceEvents = convertedData.traceEvents;
          //     console.log('perf_swimlane.json 转换完成');

          //     const sanitizedPath = swimPath.replace(/[\/\\:<>"|?*\s]/g, '-');
          //     const dbSwimStore = join(hismartliteEx.context!.globalStorageUri.fsPath, 'swimlane-db-info', sanitizedPath);
          //     await writeLargeObjectToFileThreadGranular(convertedData.traceEvents, dbSwimStore);
          //     newSwimFile = dbSwimStore;
          //     console.log('3.0file saved', dbSwimStore);
          //   } else {
          //     console.log('使用 merged_swimlane.json 格式处理');
          //   }
    
          // } catch (err: any) {
          //   server.setRef('dataError', { msg: t('pypto.comGraph.errorMessage.jsonParse'), log: err.message} );
          //   console.error(`${swimPath}读取swimlane文件时发生错误:`, err);
          //   return [];
          // }

          await runCompress({
            inputPath: swimFsPath, 
            outputPath: compressedDataPath,
            topoFile: existsSync(topoFsPath) ? topoFsPath : undefined,
            pmuFile: existsSync(pmuFsPath) ? pmuFsPath : undefined
            }, logger);

          swimInfo = await readCompressedFile(compressedDataPath);
          
          if (parsedInfoRow  && fileChanged) {
            //数据库有数据，但文件已被修改，删除数据
            await getSwimGraphParsedInfoStore().delete({filePath: swimPath});
          }
          //插入数据
          saveCompressedDataPathToDB(swimPath, swimLastChangeTime, dynTopoLastChangeTime, pmuLastChangeTime, compressedDataPath);
        }
        
        console.log('returnSwimData message send');

        if (hismartliteEx.isDebug) {
          console.timeEnd('[Performance] backend parse');
        }

        return swimInfo;
      }

    static async getData(server: any) {
      if (hismartliteEx.isDebug) {
        console.time('[Performance] backend parse');
      }
      if(server.query.isPerfSwim) {
        return await this.getSwimData(server);
      }
      let getCompressSuc = false;
      try {
        const data = await this.getCompressedData(server);
        getCompressSuc = true;
        return data;
      } catch (error) {
        console.log('get compressed data fail', error);
      }
      return await this.getSwimData(server);
    }
    
    static async validateFile(server: any) {
      const content = readFileSync(server.swimDataPath, 'utf8');
      return content;
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
        Util.writeJsonCache(this.cachePath, cache);

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
        Util.writeJsonCache(this.cachePath, cache);

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
        const runDataService = useService('runData');
        const [record] = await runDataService.query().filter({ swimlaneGraphFilePath: swimPath }).exec();
        if (!comGraphPath) {
            const swimDir = dirname(swimPath);
            // 在用户未配置计算图时，优先找同级目录的计算图
            let programPath = join(swimDir, 'program.json');
            // 如果有runData，优先获取runData数据
            if (record?.controlFlowFilePath) {
              programPath = record.controlFlowFilePath;
            }
            if (existsSync(programPath)) {
                comGraphPath = programPath;
                cache[swimPath] = comGraphPath;
                Util.writeJsonCache(this.cachePath, cache);
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

        if (!existsSync(comGraphPath)) {
          comGraphPath = await this.bindComGraphJson(server);
        }

        if (paramObj.hash === 'nohash') {
          commands.executeCommand('PyPTO.Open.OpenRenderGraphForCurrent', Uri.file(comGraphPath));
          return;
        }

        commands.executeCommand('PyPTO.Open.OpenComGraphByFunchash', Uri.file(comGraphPath), paramObj.hash);
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
        Util.writeSwimConfigMap(this.cacheCfgPath, paramObj);
    }
    static async changeUserCfgConnection(server: any, paramObj: { level: number }) {
        const config = workspace.getConfiguration('PyPTOToolkitOpen');
        config.update('connectionLevel', paramObj.level, ConfigurationTarget.Global);
    }
    static async changeUserCfgPerformance(server: any, paramObj: { show: boolean }) {
        const config = workspace.getConfiguration('PyPTOToolkitOpen');
        config.update('showPerformancePanel', paramObj.show, ConfigurationTarget.Global);
    }
    static async changeUserCfgIsMixMode(server: any, paramObj: { show: boolean }) {
        const config = workspace.getConfiguration('PyPTOToolkitOpen');
        config.update('showIsMixMode', paramObj.show, ConfigurationTarget.Global);
    }
    static async getShortCutKeyCfg(server: any) {
      const config = Util.getSwimGraphCustomCfg();
      return {
        configration: config,
      };
    };
}