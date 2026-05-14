import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync'; // 同步解析，简单场景可用
import { AccuracyToolData, SQLiteCache } from '../core/sqliteCache'; // 同步解析，简单场景可用
import { SmartLogExtractor, readCsv } from '../common/csvReader';

export async function getResDataSum(filePath: string | undefined) {
    if (!filePath) {
        return;
    }
    const outputDirPath = path.dirname(filePath) ?? '';
    
    const accurancyDirList = await fs.readdirSync(outputDirPath, { withFileTypes: true });
    const accurancyDirName = accurancyDirList.filter(subDirName => (subDirName.isDirectory() && subDirName.name.startsWith('verify')))?.[0]?.name ?? '';
    if (!accurancyDirName) {
        return;
    }
    const accurancyDirPath = path.join(outputDirPath, accurancyDirName);

    const csvPath = path.join(accurancyDirPath, 'verify_graph_result_brief.csv');
    if (!fs.existsSync(csvPath)) {
        console.log('文件不存在');
        return;
    }

    const readCsvStatus = await readCsv(csvPath);
    if (!readCsvStatus) {
        return {parseResult: 'Fail', allResultSum: [], controlFlowFilepath: filePath};
    }
    const oriPassDistribution = await getPassDistribution(csvPath);
    const passDistribution = {
        pass_cnt: oriPassDistribution.PASS ?? 0,
        fail_cnt: oriPassDistribution.FAIL ?? 0,
        exception_cnt: oriPassDistribution.EXCEPTION ?? 0,
        skip_cnt: oriPassDistribution.SKIP ?? 0
    }
    const passDetail = await getPassList(outputDirPath, csvPath);

    const finalRes = {...passDetail, ...passDistribution};
    return {parseResult: 'Success', allResultSum: finalRes, controlFlowFilepath: filePath};
}

export async function getPassInfoOfSinglePath(filePath: string, funcMagicName: string) {
    const outputDirPath = path.dirname(filePath) ?? '';
    
    const accurancyDirList = await fs.readdirSync(outputDirPath, { withFileTypes: true });
    const accurancyDirName = accurancyDirList.filter(subDirName => (subDirName.isDirectory() && subDirName.name.startsWith('verify')))?.[0]?.name ?? '';
    const accurancyDirPath = path.join(outputDirPath, accurancyDirName) ?? '';

    const csvPath = path.join(accurancyDirPath, 'verify_graph_result_brief.csv');
    if (!fs.existsSync(csvPath)) {
        console.log('文件不存在');
        return;
    }

    // 页面2映射关系查询接口
    const passList = await SQLiteCache.getInstance().getPhaseStatusListByFuncTest(csvPath, funcMagicName);
    let resList: { passName: string, status: string}[] = [];
    for(const item of passList) {
        const singlePath = {
            passName: item.phaseName,
            status: item.status
        }
        resList.push(singlePath);
    }

    return resList;
}

interface PhaseItem {
    phaseName: string;
    result: string;
}

// 页面一 总览接口
async function getPassDistribution(filePath: string) {
    let passDistribution = await SQLiteCache.getInstance().getAccuracyStatsByFile(filePath);

    const dirPath = path.dirname(path.dirname(filePath));
    const allFileNameList = fs.readdirSync(dirPath, { withFileTypes: true });
    const allPassNameList = allFileNameList.filter(singlePass => (singlePass.isDirectory() && /^Pass_\d{2}/.test(singlePass.name))).map(singlePass => singlePass.name);
    const repeat00List = allPassNameList.filter(item => item.startsWith('Pass_00'));
    const real00Pass = repeat00List.at(-1);
    const otherList = allPassNameList.filter(item => !item.startsWith('Pass_00'));
    const allPassList = [real00Pass, ...otherList];

    const allPassCnt = allPassList.length ?? 37;

    const {PASS = 0, FAIL = 0, EXCEPTION = 0, SKIP = 0} = passDistribution;
    let listSkipCnt = (allPassCnt - PASS - FAIL - EXCEPTION) > 0 ? (allPassCnt - PASS - FAIL - EXCEPTION) : 0;
    let dbSkipCnt = SKIP;
    let skipCnt = listSkipCnt > 0 ? listSkipCnt : dbSkipCnt;
    let finalSkipCnt = skipCnt > 0 ? skipCnt : '--'
    const fullDistribution = Object.assign({}, passDistribution, {'SKIP': finalSkipCnt});

    return fullDistribution;
}

function mergePhaseResults (passDistribution: PhaseItem[]): PhaseItem[] {
    const priorityMap: Record<string, number> = {'FAIL': 3, 'EXCEPTION': 2, 'PASS': 1};
    const passList: PhaseItem[] = [];
    const phaseIndexMap = new Map<string, number>();
    
    for (const item of passDistribution) {
        const currentPriority = priorityMap[item.result];
        const existingIndex = phaseIndexMap.get(item.phaseName);
    
        if (existingIndex === undefined) {
            phaseIndexMap.set(item.phaseName, passList.length);
            passList.push({ ...item });
        } else {
            const existing = passList[existingIndex];
            if (currentPriority > priorityMap[existing.result]) {
                passList[existingIndex] = { ...item };
            }
        }
    }

    return Array.from(passList.values());
}

// pass详细阶段接口
async function getPassList(dirPath: string, filePath: string) {
    const originDistribution = await SQLiteCache.getInstance().getDistinctPhaseResults(filePath);
    const pureDistribution = originDistribution.filter(singlePass => singlePass.phaseName.includes('Pass'));
    const passDistribution = mergePhaseResults(pureDistribution);
    const successList = passDistribution.filter(singlePass => singlePass.result === 'PASS').map(singlePass => singlePass.phaseName);
    const exceptionList = passDistribution.filter(singlePass => singlePass.result === 'EXCEPTION').map(singlePass => singlePass.phaseName);
    const errorList = passDistribution.filter(singlePass => singlePass.result === 'FAIL').map(singlePass => singlePass.phaseName);
    const csvSkipList = passDistribution.filter(singlePass => !['PASS', 'EXCEPTION', 'FAIL'].includes(singlePass.result)).map(singlePass => singlePass.phaseName);

    let firstErrorPathList: { pass_name: string, func_magicName: string[], showName: string }[] = [];
    for (const pass of errorList) {
        const errorDetailList = await SQLiteCache.getInstance().getFirstFailByPhaseOnTimestamp(filePath, pass);
        let errFuncMagicName: string[] = [];
        let singleErrorPathInfo;
        for (let i = 0; i < errorDetailList.length; i++) {
            const item = errorDetailList[i];
            errFuncMagicName.push(item.funcMagicName);
            if (i === 0) {
                singleErrorPathInfo = {
                    pass_name: item.phaseName,
                    func_magicName: [...errFuncMagicName],
                    showName: item.phaseName + item.funcMagicName,
                };
            } else {
                singleErrorPathInfo.func_magicName = [...errFuncMagicName];
            }
        }
        firstErrorPathList.push(singleErrorPathInfo);
    }

    const allFileNameList = fs.readdirSync(dirPath, { withFileTypes: true });
    const allPassNameList = allFileNameList.filter(singlePass => (singlePass.isDirectory() && /^Pass_\d{2}/.test(singlePass.name))).map(singlePass => singlePass.name);
    const repeat00List = allPassNameList.filter(item => item.startsWith('Pass_00'));
    const real00Pass = repeat00List.at(-1);
    const otherList = allPassNameList.filter(item => !item.startsWith('Pass_00'));
    const allPassList = [real00Pass, ...otherList];

    const validPassList = new Set(passDistribution.filter(item => !csvSkipList.includes(item.phaseName)).map(item => item.phaseName.split('_').slice(0, 2).join('_')));
    const calculatedSkipList = allPassList.filter(singlePassName => (singlePassName !== undefined) && (!validPassList.has(singlePassName.split('_').slice(0, 2).join('_'))));
    const skipList = [...new Set([...csvSkipList, ...calculatedSkipList])];
    const passResult = {
        successPass: successList,
        exceptionPass: exceptionList,
        errorPass: firstErrorPathList,
        skipPass: skipList,
    };
    return passResult;
}

export async function getComGraphRawMagic(readAccurancyCsv: boolean, filePath: string, phaseName: string, funcMagicName: string) {
    const outputDirPath = path.dirname(path.dirname(filePath)) ?? '';

    const accurancyDirList = await fs.readdirSync(outputDirPath, { withFileTypes: true });
    const accurancyDirName = accurancyDirList.filter(subDirName => (subDirName.isDirectory() && subDirName.name.startsWith('verify')))?.[0]?.name ?? '';
    const accurancyDirPath = path.join(outputDirPath, accurancyDirName) ?? '';

    const csvPath = path.join(accurancyDirPath, 'verify_graph_result_brief.csv');
    if (!fs.existsSync(csvPath)) {
        console.log('文件不存在');
        return;
    }
    const failSumListofGraph = await SQLiteCache.getInstance().getErrorDetailsOfGraphByFunc(csvPath, phaseName, funcMagicName, 10000, 0);
    let errorRawMagicList = new Set(failSumListofGraph.map(failRecord => failRecord.rawMagic));

    return errorRawMagicList;
}

export async function getComGraphDataSum(filePath: string, phaseName: string, funcMagicName: string, pageSize: number = 30, startOffset: number = 0) {
    const outputDirPath = path.dirname(path.dirname(filePath)) ?? '';

    const accurancyDirList = await fs.readdirSync(outputDirPath, { withFileTypes: true });
    const accurancyDirName = accurancyDirList.filter(subDirName => (subDirName.isDirectory() && subDirName.name.startsWith('verify')))?.[0]?.name ?? '';
    const accurancyDirPath = path.join(outputDirPath, accurancyDirName) ?? '';

    const csvPath = path.join(accurancyDirPath, 'verify_graph_result_brief.csv');

    if (!fs.existsSync(csvPath)) {
        console.log('文件不存在');
        return;
    }

    const failSum = await SQLiteCache.getInstance().getAccuracyStatsByFunc(csvPath, phaseName, funcMagicName);
    const newPageSize = 'FAIL' in failSum ? failSum['FAIL'] : 30;
    const failSumListofGraph = await SQLiteCache.getInstance().getErrorDetailsOfGraphByFunc(csvPath, phaseName, funcMagicName, newPageSize, startOffset);
    
    const comAccuracyData = {
        comgraphFailSum: failSum,
        comgraphFailList: failSumListofGraph
    }

    return comAccuracyData;
}

export async function searchKeyword(filePath: string, phaseName: string, funcMagicName: string, keyword = '', pageSize: number = 30, startOffset: number = 0) {
    const outputDirPath = path.dirname(path.dirname(filePath)) ?? '';

    const accurancyDirList = await fs.readdirSync(outputDirPath, { withFileTypes: true });
    const accurancyDirName = accurancyDirList.filter(subDirName => (subDirName.isDirectory() && subDirName.name.startsWith('verify')))?.[0]?.name ?? '';
    const accurancyDirPath = path.join(outputDirPath, accurancyDirName) ?? '';

    const csvPath = path.join(accurancyDirPath, 'verify_graph_result_brief.csv');

    if (!fs.existsSync(csvPath)) {
        console.log('文件不存在');
        return;
    }

    const failKeyList = await SQLiteCache.getInstance().getErrorListByPage(csvPath, phaseName, funcMagicName, keyword, pageSize, startOffset);

    const comAccuracyData = {
        comgraphFailList: failKeyList
    }

    return comAccuracyData;
}

function dedupByOffset(res: Record<string, any>[]) {
    const seen = new Set<number>();
    const uniqueRes: Record<string, any>[] = [];
    for (const singleRes of res) {
        const offset = singleRes.OFFSET;

        if (!seen.has(offset)) {
            seen.add(offset);
            uniqueRes.push(singleRes);
        }
    }
    uniqueRes.sort((singleResA, singleResB) => Number(singleResA.OFFSET) - Number(singleResB.OFFSET));
    return uniqueRes;
}

function formatDetailData(resultLog: string[]): any[] {
    if (!resultLog || resultLog.length < 3) {
        return [];
    }
 
    function smartSplit(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inBracket = false; 
 
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
 
            if (char === '[') {
                inBracket = true;
                current += char;
            } else if (char === ']') {
                inBracket = false;
                current += char;
            } else if (char === ',' && !inBracket) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
 
        if (current.trim() !== '') {
            result.push(current.trim());
        }
 
        return result;
    }
 
    const headers = smartSplit(resultLog[1]);
 
    const res: Record<string, string>[] = [];
    for (let i = 2; i < resultLog.length; i++) {
        const singleValue = smartSplit(resultLog[i]);
        const singleLine: Record<string, string> = {};
 
        for (let j = 0; j < headers.length; j++) {
            singleLine[headers[j]] = singleValue[j] ?? '';
        }
        res.push(singleLine);
    }
    
    const uniqRes = dedupByOffset(res);
    return uniqRes;
 }

export async function getComGraphDataDetail(filePath: string, phaseName: string, funcMagicName: string, 
                                            loopInfo: string, rawMagic: string, pageSize: number = 10000, startOffset: number = 0) {
    const outputDirPath = path.dirname(path.dirname(filePath)) ?? '';

    const accurancyDirList = await fs.readdirSync(outputDirPath, { withFileTypes: true });
    const accurancyDirName = accurancyDirList.filter(subDirName => (subDirName.isDirectory() && subDirName.name.startsWith('verify')))?.[0]?.name ?? '';
    const accurancyDirPath = path.join(outputDirPath, accurancyDirName) ?? '';

    const logPath = path.join(accurancyDirPath, 'verify_graph_result_brief.log');
    const csvPath = path.join(accurancyDirPath, 'verify_graph_result_brief.csv');

    if (!fs.existsSync(logPath) || !fs.existsSync(csvPath)) {
        console.log('文件不存在');
        return;
    }
    const extractor = new SmartLogExtractor();
    const detailStart = `[VERIFY:FAIL] ${phaseName}, ${funcMagicName}, ${loopInfo}, ${rawMagic}`;
    const detailEnd = `[VERIFY:FAIL] `;
    const resultLog = await extractor.extract(logPath, detailStart, detailEnd);
    const formatLog = formatDetailData(resultLog);

    const failSum = await SQLiteCache.getInstance().getErrorDetailsByFunc(csvPath, phaseName, funcMagicName, rawMagic, loopInfo, pageSize, startOffset);
    const res = {
        failDetailList: formatLog,
        failSummary: failSum?.[0]
    }

    return res;
}

