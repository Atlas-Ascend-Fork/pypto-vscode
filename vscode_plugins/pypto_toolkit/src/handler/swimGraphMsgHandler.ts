import { Uri, ViewColumn, commands, window, WebviewPanel, workspace, ConfigurationTarget } from 'vscode';
import { hismartliteEx } from '../hismarliteEx';
import { Util } from '../util';
import { dirname, join, extname, resolve } from 'path';
import { createReadStream, existsSync, readFileSync, readdirSync } from 'fs';
import { t } from 'i18next';
import { getIDETheme } from '../theme';
import Filter from 'stream-json/filters/Filter';
import { parsePmuInfo, parseSwimLaneInfo } from '../process';
import { GraphView } from '../view/graphView';

export abstract class swimGraphMsgHandler {
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

    static async getSwimInitData(server: any) {
        server.setRef('returnSwim', { data: {} });
        server.setRef('returnTheme', { data: getIDETheme() });
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
        const colorRending = cache['colorRending'] ?? 'subGraph';
        const textRending = cache['textRending']?.length === 0 ? ['taskName', 'taskLabel'] : cache['textRending'] ?? ['taskName', 'taskLabel'];
        const config = Util.getSwimGraphCustomCfg();
        config['colorRending'] = colorRending;
        config['textRending'] = textRending;

        const pmuPath = resolve(dirname(swimPath), 'tilefwk_prof_pmu.csv');
        let pmuData = '';
        try {
            pmuData = readFileSync(pmuPath, 'utf8');
            console.log('读取pmu文件');

        } catch (err) {
            console.error('读取pmu文件时发生错误:', err);
        }
        let pmuInfo = {};
        if (pmuData != '') {
            pmuInfo = parsePmuInfo(pmuData);
        }

        let swimStr = '';
        try {
            swimStr = readFileSync(swimPath, 'utf8');
            console.log('读取merged_swimlane.json文件');

        } catch (err) {
            console.error(`${swimPath}读取swimlane文件时发生错误:`, err);
        }
        const task2topo = {};
        const dynTopoPath = join(dirname(swimPath), 'dyn_topo.txt');
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
            console.log('读取dyn_topo.txt发生错误', error);
        }
        const swimDataObj = JSON.parse(swimStr);
        const swimData: any = await parseSwimLaneInfo(swimDataObj, pmuInfo, task2topo, colorRending);
        swimData.lane2line = Object.fromEntries(swimData.lane2line);
        swimData.processes = Object.fromEntries(swimData.processes);
        swimData.processExpanded = Object.fromEntries(swimData.processExpanded);

        for (const key in swimData.processes) {
            swimData.processes[key].threads = Object.fromEntries(swimData.processes[key].threads);
        }
        server.setRef('returnSwimData', {
            data: swimData,
            configration: config,
            comGraphPath,
            swimPath,
        });
        console.log('returnSwimData message send');
    }

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