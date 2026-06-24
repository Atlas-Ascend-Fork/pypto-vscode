import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync'; // 同步解析，简单场景可用
import { AccuracyToolData, SQLiteCache } from '../core/sqliteCache'; // 同步解析，简单场景可用
import { SmartLogExtractor, getCsvData, readCsv } from '../common/csvReader';
import { t } from 'i18next';

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
        console.log('verify_graph_result_brief.csv文件不存在');
        return;
    }

    const readCsvStatus = await readCsv(csvPath);
    if (!readCsvStatus) {
        return {parseResult: 'Fail', allResultSum: [], controlFlowFilepath: filePath};
    }

    // /** 调diff接口的试用 */
    // const cmpCsvPath = path.join(accurancyDirPath, 'verify_graph_result_cmp~Pass_29_InferParamIndex~Pass_37_CodegenPreproc~1781054287073093.csv');
    // getCmpDiffList(cmpCsvPath);
    // openCmpDiffComGraph(cmpCsvPath, '8512735506352643020', 'Pass_37_CodegenPreproc', 'TENSOR_LOOP_s2_Unroll8_PATH0_hiddenfunc0_20');

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
        // console.log(`文件不存在: ${csvPath}`);
        return;
    }

    // 页面2映射关系查询接口
    const passList = await SQLiteCache.getInstance().getPhaseStatusListByFunc(csvPath, funcMagicName);
    let resList: { passName: string, status: string[]}[] = [];
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
    const priorityMap: Record<string, number> = {'EXCEPTION': 3, 'FAIL': 2, 'PASS': 1};
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

async function getPassList(dirPath: string, filePath: string) {
    const originDistribution = await SQLiteCache.getInstance().getDistinctPhaseResults(filePath);
    const pureDistribution = originDistribution.filter(singlePass => singlePass.phaseName.includes('Pass'));

    const phaseFlagsMap = new Map<string, { has_exception: boolean; has_fail: boolean; has_pass: boolean }>();
    for (const item of pureDistribution) {
        const flags = phaseFlagsMap.get(item.phaseName) ?? { has_exception: false, has_fail: false, has_pass: false };
        if (item.result === 'EXCEPTION') flags.has_exception = true;
        if (item.result === 'FAIL') flags.has_fail = true;
        if (item.result === 'PASS') flags.has_pass = true;
        phaseFlagsMap.set(item.phaseName, flags);
    }

    const successList: string[] = [];
    const exceptionList: string[] = [];
    const errorList: string[] = [];
    const csvSkipList: string[] = [];

    for (const [phaseName, flags] of phaseFlagsMap) {
        if (flags.has_exception && flags.has_fail) {
            exceptionList.push(phaseName);
            errorList.push(phaseName);
        } else if (flags.has_exception) {
            exceptionList.push(phaseName);
        } else if (flags.has_fail) {
            errorList.push(phaseName);
        } else if (flags.has_pass) {
            successList.push(phaseName);
        } else {
            csvSkipList.push(phaseName);
        }
    }

    let firstExceptionPathList: { pass_name: string, func_magicName: string[], showName: string }[] = [];
    for (const pass of exceptionList) {
        const exceptionDetailList = await SQLiteCache.getInstance().getFirstResByPhaseOnTimestamp(filePath, pass, 'EXCEPTION');
        let excFuncMagicName: string[] = [];
        let singleExceptionPathInfo;
        for (let i = 0; i < exceptionDetailList.length; i++) {
            const item = exceptionDetailList[i];
            excFuncMagicName.push(item.funcMagicName);
            if (i === 0) {
                singleExceptionPathInfo = {
                    pass_name: item.phaseName,
                    func_magicName: [...excFuncMagicName],
                    showName: item.phaseName + item.funcMagicName,
                };
            } else {
                singleExceptionPathInfo.func_magicName = [...excFuncMagicName];
            }
        }
        if (singleExceptionPathInfo) {
            firstExceptionPathList.push(singleExceptionPathInfo);
        }
    }

    let firstErrorPathList: { pass_name: string, func_magicName: string[], showName: string }[] = [];
    for (const pass of errorList) {
        const errorDetailList = await SQLiteCache.getInstance().getFirstResByPhaseOnTimestamp(filePath, pass, 'FAIL');
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
        if (singleErrorPathInfo) {
            firstErrorPathList.push(singleErrorPathInfo);
        }
    }

    const allFileNameList = fs.readdirSync(dirPath, { withFileTypes: true });
    const allPassNameList = allFileNameList.filter(singlePass => (singlePass.isDirectory() && /^Pass_\d{2}/.test(singlePass.name))).map(singlePass => singlePass.name);
    const repeat00List = allPassNameList.filter(item => item.startsWith('Pass_00'));
    const real00Pass = repeat00List.at(-1);
    const otherList = allPassNameList.filter(item => !item.startsWith('Pass_00'));
    const allPassList = [real00Pass, ...otherList];
    const allValidPhases = [...successList, ...exceptionList, ...errorList];
    const validPassList = new Set(allValidPhases.map(phaseName => phaseName.split('_').slice(0, 2).join('_')));
    const calculatedSkipList = allPassNameList.filter(singlePassName => (singlePassName !== undefined) && (!validPassList.has(singlePassName.split('_').slice(0, 2).join('_'))));
    const skipList = [...new Set([...csvSkipList, ...calculatedSkipList])];

    const passResult = {
        successPass: successList,
        exceptionPass: firstExceptionPathList,
        errorPass: firstErrorPathList,
        skipPass: skipList,
    };
    return passResult;
}

export async function getComGraphRawMagic(filePath: string, phaseName: string, funcMagicName: string, res: string, flowVerifyPath?: string, computeGraphDirPath?: string) {
    let baseDirPath: string;
    let excludeDirName: string | undefined;

    // 如果 flowVerifyPath 不为空，使用它的父目录作为基础路径，并排除 flowVerifyPath 本身
    if (flowVerifyPath) {
        // 使用 vscode.Uri 来正确处理跨平台路径
        const flowVerifyUri = vscode.Uri.file(flowVerifyPath);
        const parentUri = vscode.Uri.joinPath(flowVerifyUri, '..');
        baseDirPath = parentUri.fsPath;
        excludeDirName = path.basename(flowVerifyUri.fsPath); // 排除 flowVerifyPath 本身的文件夹名
    } else {
        // 否则使用原来的逻辑，从 filePath 获取 outputDirPath
        baseDirPath = path.dirname(path.dirname(filePath)) ?? '';
    }

    const accurancyDirList = await fs.readdirSync(baseDirPath, { withFileTypes: true });
    const accurancyDirName = accurancyDirList
        .filter(subDirName => {
            // 必须是目录且以 verify 开头
            if (!subDirName.isDirectory() || !subDirName.name.startsWith('verify')) {
                return false;
            }
            // 如果有排除的文件夹名，则排除它
            if (excludeDirName && subDirName.name === excludeDirName) {
                return false;
            }
            return true;
        })?.[0]?.name ?? '';
    const accurancyDirPath = path.join(baseDirPath, accurancyDirName) ?? '';

    const csvPath = path.join(accurancyDirPath, 'verify_graph_result_brief.csv');
    if (!fs.existsSync(csvPath)) {
        // console.log(`文件不存在: ${csvPath}`);
        return;
    }
    const failSumListofGraph = await SQLiteCache.getInstance().getErrorDetailsOfGraphByFunc(csvPath, phaseName, funcMagicName, 10000, 0, res);
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
        // console.log(`文件不存在: ${csvPath}`);
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
        // console.log(`文件不存在: ${csvPath}`);
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
        // console.log(`文件不存在: ${logPath} || ${csvPath}`);
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


/**
 * 遍历目录筛选 verify_graph_result_cmp__xx.csv 文件，按时间戳倒序排序
 * 
 * 文件名格式示例：
 * verify_graph_result_cmp~Pass_28_InferParamIndex~Pass_36_CodegenPreproc~1779267276297135.csv
 * 
 * @param directoryPath 要遍历的目录路径
 * @returns 按时间戳倒序排列的文件完整路径数组（最新文件在最前）
 * @throws 当路径无效或非目录时抛出错误
 */
export function getSortedVerifyFiles(directoryPath: string): string[] {
  // 验证目录有效性
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`目录不存在: ${directoryPath}`);
  }
  
  const stat = fs.statSync(directoryPath);
  if (!stat.isDirectory()) {
    throw new Error(`路径不是目录: ${directoryPath}`);
  }

  // 正则匹配：捕获最后一个 ~ 和 .csv 之间的纯数字时间戳
  const filenamePattern = /^verify_graph_result_cmp~.*~(\d+)\.csv$/;
  const timestampFiles: { timestamp: number; filePath: string }[] = [];

  // 同步读取目录内容
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    // 仅处理文件（跳过子目录/符号链接等）
    if (!entry.isFile()) continue;
    
    const filename = entry.name;
    const match = filenamePattern.exec(filename);
    
    if (match) {
      try {
        // 提取并转换时间戳（确保数值排序）
        const timestamp = Number.parseInt(match[1], 10);
        
        // 验证时间戳有效性（16位微秒级时间戳范围）
        if (timestamp > 1000000000000000 && timestamp < 9999999999999999) {
          timestampFiles.push({
            timestamp,
            filePath: path.join(directoryPath, filename)
          });
        }
      } catch {
        // 跳过时间戳解析失败的文件
        continue;
      }
    }
  }

  // 按时间戳倒序排序（最新时间戳排最前）
  timestampFiles.sort((a, b) => b.timestamp - a.timestamp);

  // 返回排序后的文件路径
  return timestampFiles.map(item => item.filePath);
}

interface DiffItem {
    aOp: Record<string, any> | undefined;
    bOp: Record<string, any> | undefined;
    compareRes: string;
    sharedRes: Record<string, any>;
  }

export async function getCmpDiffList(
    directoryPath: string,
    readFlag: boolean = true,
    pageSize: number = 50,
    startOffset: number = 0,
    res?: string,
    keyword?: string
  ): Promise<{ diffList: DiffItem[]; total: number, failRes: number, updateFlag: boolean}> {
    const filePath = directoryPath;
    if (!filePath || filePath.length === 0) {
      return { diffList: [], total: 0, failRes: 0, updateFlag: false};
    }
    const type = 2;

    let failCount = -1;
    if (readFlag) {
        await readCsv(filePath, type);
        failCount = await SQLiteCache.getInstance().accuracyToolCmpGetCountByFilePath(filePath, 'FAIL');
    }

    const realOffset = startOffset * pageSize;
    const [result, totalCount] = await Promise.all([
      SQLiteCache.getInstance().accuracyToolCmpGetByFilePath(filePath, pageSize, realOffset, res, keyword),
      SQLiteCache.getInstance().accuracyToolCmpGetCountByFilePath(filePath, res, keyword)
    ]);
  
    const diffList: DiffItem[] = [];
    for (const singleRes of result) {
      const aOp: Record<string, any> = {};
      const bOp: Record<string, any> = {};
      let compareRes = '';
      const sharedRes: Record<string, any> = {};
  
      for (const [key, value] of Object.entries(singleRes)) {
        if (key.startsWith('abRes')) {
          compareRes = value as string;
        } else if (key.startsWith('ab')) {
          sharedRes[key] = value;
        } else if (key.startsWith('a')) {
          aOp[key] = value;
        } else if (key.startsWith('b')) {
          bOp[key] = value;
        } else {
          sharedRes[key] = value;
        }
      }

      const aOpIsEmpty = Object.values(aOp).every(v => v === undefined || v === '');
      const bOpIsEmpty = Object.values(bOp).every(v => v === undefined || v === '');
  
      diffList.push({
        aOp: aOpIsEmpty ? undefined : aOp,
        bOp: bOpIsEmpty ? undefined : bOp,
        compareRes: compareRes || 'failed',
        sharedRes,
      });
    }

    const updateCompareListFlag = await updateCompListFirstReq(filePath, String(failCount));

    return { diffList, total: totalCount, failRes: failCount, updateFlag: updateCompareListFlag};
}

// 返回查找的csv
export interface PrecisionExceptItem {
    GROUP: string;
    INDEX: string;
    OFFSET: string;
    OFFSET_RAW: string;
    A_data: string;
    B_data: string;
    AB_ae: string;
    AB_re: string;
    AB_tol: string;
}

export async function getPrecisionExceptList(filePath: string, fileName: string): Promise<PrecisionExceptItem[] | null> {
    const detailPath = `${filePath}.DETAIL`;
    const outputDirPath = vscode.Uri.file(detailPath).fsPath;
    const targetName = fileName.toLowerCase().endsWith('.csv') ? fileName : `${fileName}.csv`;
    
    try {
        const entries = fs.readdirSync(outputDirPath, { withFileTypes: true });
        const found = entries.find(entry => 
            entry.isFile() && 
            entry.name.toLowerCase() === targetName.toLowerCase()
        );
        
        if (!found) return null;
        
        const csvFilePath = path.join(outputDirPath, found.name);
        const content = fs.readFileSync(csvFilePath, 'utf-8');
        const contentList = parseCsv(content)
        return contentList;
    } catch {
        return null;
    }
}


function parseCsv(content: string): PrecisionExceptItem[] {
    const records = parse(content, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
    }) as string[][];
    
    return records.slice(1).map(values => ({
        GROUP: values[0] ?? '',
        INDEX: values[1] ?? '',
        OFFSET: values[2] ?? '',
        OFFSET_RAW: values[3] ?? '',
        A_data: values[4] ?? '',
        B_data: values[5] ?? '',
        AB_ae: values[6] ?? '',
        AB_re: values[7] ?? '',
        AB_tol: values[8] ?? '',
    }));
}

/**
 * 使用方法：
 * 1、控制流跳转的时候去openGraph + accuFilePathSet；
 * 2、opcheck单击跳转的时候去更新表accuFilePathSet；
 * 3、opcheck单击跳转唤起openCmpDiffComGraph；
 * 4、在base里读accuFilePathGet如果是opcheck就调新接口，否则调老接口；
 * 5、新接口功能：跟difflist是相对一致的 —— 待新增
 */
export async function openCmpDiffComGraph(
    filePath: string,
    funcHash: string,
    passName: string,
    funcMagicName: string,
    fileType?: string,
    cmpCsvPath?: string,
  ): Promise<void> {
  
    // 步骤2-3：当前文件夹x → 上一层文件夹y
    const currentDir = path.dirname(filePath);
    const parentDir = path.dirname(currentDir);
  
    // 步骤4：在y中找包含passName的子文件夹z
    const parentDirEntries = fs.readdirSync(parentDir, { withFileTypes: true });
    const passDir = parentDirEntries.find(entry => entry.isDirectory() && entry.name.includes(passName));
    if (!passDir) {
      vscode.window.showWarningMessage(t('pypto.passDirNotFound', { passName }));
      return;
    }
    const passSubDir = path.join(parentDir, passDir.name);
  
    // 步骤5：在z中找包含 funcMagicName 和 funcHash 的 json 文件
    const passSubDirEntries = fs.readdirSync(passSubDir, { withFileTypes: true });
    const resList = passSubDirEntries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .filter(entry => entry.name.includes(funcMagicName) && entry.name.includes(funcHash))
      .map(entry => entry.name);
  
    if (resList.length === 0) {
      vscode.window.showWarningMessage(t('pypto.cmpJsonNotFound', { passSubDir, funcMagicName, funcHash }));
      return;
    }
  
    // 步骤6：确定 targetComgraph
    let targetComgraph: string;
    if (resList.length === 1) {
      targetComgraph = resList[0];
    } else {
      const afterFile = resList.find(name => name.startsWith('After'));
      if (afterFile) {
        targetComgraph = afterFile;
      } else {
        targetComgraph = resList[0];
      }
    }
  
    // 步骤7：拼接绝对路径
    const directPath = path.join(passSubDir, targetComgraph);
  
    // 步骤8：调用 VSCode 命令打开计算图，传递 fileType 和 cmpCsvPath 参数
    vscode.commands.executeCommand('PyPTO.Open.OpenComGraphByFunchash', vscode.Uri.file(directPath), funcHash, fileType, cmpCsvPath);
}

// export interface accuFilePathData {
//   fileType: string : opcheck brief;
//   filePath: string;
// }
export async function setCurAccuFilePath(fileInfo: any) {
    if (!fileInfo.fileType) {
        // 加个报错也行
        return;
    }
    if (fileInfo.fileType.startsWith('op') && (!fileInfo.filePath)) {
        return;
    }
    await SQLiteCache.getInstance().accuFilePathSet(fileInfo);
}

export async function getAccuFilePath() {
    return await SQLiteCache.getInstance().accuFilePathGet();
}

export async function getFailMagicList(
  comgraphFilePath: string,
  comgraphFuncHash: string | undefined,
  flowVerifyPath?: string,
  computeGraphDirPath?: string,
) {
  const accurancyLevel = await SQLiteCache.getInstance().accuFilePathGet();
  const failLevel = accurancyLevel?.fileType;
  const csvPath = accurancyLevel?.filePath || '';
  let failMagicList;
  if (failLevel?.startsWith('op')) {
    // phasename 和 funchash必须匹配上
    const recordPhaseList = [...csvPath.matchAll(/Pass_(\d+)/g)].map(m => m[1]);

    const fileName = path.basename(csvPath);
    const first = fileName.indexOf('_');
    const second = fileName.indexOf('_', first + 1);
    const filePassName = first === -1 || second === -1 ? '' : fileName.slice(first + 1, second);

    const recordFuncHash = csvPath.split('~', 1)[1];
    if ((comgraphFuncHash !== recordFuncHash) || !(recordPhaseList.includes(filePassName))) {
      // 报错
    }
    const failOpMagicList = await getCmpDiffList(csvPath, false);
    failMagicList = {
      accuType: 'op',
      failMagicList: failOpMagicList,
    };
  } else {
    const curPassName = path.basename(path.dirname(comgraphFilePath));
    const graphFileName = path.basename(comgraphFilePath, path.extname(comgraphFilePath));
    let curFuncMagicNameString = graphFileName.slice(graphFileName.indexOf('TENSOR'));
    curFuncMagicNameString = curFuncMagicNameString.endsWith('_ROOT')
      ? curFuncMagicNameString.replace('_ROOT', '')
      : curFuncMagicNameString;
    const errorRawMagicList = await getComGraphRawMagic(
      comgraphFilePath,
      curPassName,
      curFuncMagicNameString!,
      'FAIL',
      flowVerifyPath,
      computeGraphDirPath,
    );
    const exceptionRawMagicList = await getComGraphRawMagic(
      comgraphFilePath,
      curPassName,
      curFuncMagicNameString!,
      'EXCEPTION',
      flowVerifyPath,
      computeGraphDirPath,
    );
    failMagicList = {
      accuType: 'brief',
      wrongRawMagicList: {
        errorRawMagicList: errorRawMagicList,
        exceptionRawMagicList: exceptionRawMagicList,
      },
    };
  }
  return failMagicList;
}

export async function getCmpErrorList(
    filePath: string, 
    comgraphPath: string,
    readFlag: boolean = true, 
    pageSize: number = 50, 
    startOffset: number = 0, 
    keyword: string = ''
) {
    const phaseName = path.basename(path.dirname(comgraphPath)) ?? '';
    const comgraphfileName = path.basename(comgraphPath, '.json');
    const matchList = comgraphfileName.match(/(?:[^_]*_){3}([^]*?)_LEAF/);
    const funcMagicName = matchList?.[1] ?? '';
    const funcHash = comgraphfileName.split('_').at(-1) ?? '';

    let failCount = -1;
    let excepCount = -1;
    let totalCount = -1;
    let listSum = 0;
    totalCount = await SQLiteCache.getInstance().accuracyToolCmpGetCountByFilePath(filePath, '', '', funcMagicName, funcHash, phaseName);
    failCount = await SQLiteCache.getInstance().accuracyToolCmpGetCountByFilePath(filePath, 'FAIL', '', funcMagicName, funcHash, phaseName);
    excepCount = await SQLiteCache.getInstance().accuracyToolCmpGetCountByFilePath(filePath, 'EXCEPTION', '', funcMagicName, funcHash, phaseName);
    
    const realOffset = startOffset * pageSize;
    const { total: failCountFromDb, list: errorList } = 
            await SQLiteCache.getInstance().getCmpErrorListByFilePath(filePath, pageSize, realOffset, keyword, funcMagicName, funcHash, phaseName);
    listSum = failCountFromDb;

    const accurancyLevel = await SQLiteCache.getInstance().accuFilePathGet();
    const fileCol = accurancyLevel?.fileType.split('_')[1];

    const diffList: DiffItem[] = [];
    for (const singleRes of errorList) {
      const aOp: Record<string, any> = {};
      const bOp: Record<string, any> = {};
      let compareRes = '';
      const sharedRes: Record<string, any> = {};
  
      for (let [key, value] of Object.entries(singleRes)) {
        if (key === 'aOpMagic') {
            value = Number(value);
        }
        if (key === 'bOpMagic') {
            value = Number(value);
        }
        if (key.startsWith('abRes')) {
          compareRes = value as string;
        } else if (key.startsWith('ab')) {
          sharedRes[key] = value;
        } else if ((fileCol === 'A') && key.startsWith('a')) {
            aOp[key] = value;
        } else if ((fileCol === 'B') && key.startsWith('b')) {
            bOp[key] = value;
        } else {
          sharedRes[key] = value;
        }
      }

      const aOpIsEmpty = Object.values(aOp).every(v => v === undefined || v === '');
      const bOpIsEmpty = Object.values(bOp).every(v => v === undefined || v === '');
  
      diffList.push({
        aOp: aOpIsEmpty ? undefined : aOp,
        bOp: bOpIsEmpty ? undefined : bOp,
        compareRes: compareRes || 'FAIL',
        sharedRes,
      });
    }
  
    return { diffList, failRes: failCount, excepRes: excepCount, totalRes: totalCount, listSum: listSum };
}

export async function updateCompListFirstReq(fileName: string, failCount: string): Promise<boolean> {
  const db = SQLiteCache.getInstance();
  const row = await db.accuracyToolCompListGetByFilePath(fileName);
  if (row) {
    await db.accuracyToolCompListUpdateFirstReq(fileName, failCount);
    return true;
  }
  return false;
}
