import * as vscode from 'vscode';
import * as path from 'path';
import { t } from 'i18next';

/**
 * 监听指定文件是否在 timeout 毫秒内被创建
 * @param fileUri 要监听的文件 URI（必须是绝对路径）
 * @param timeout 超时时间（毫秒）
 * @returns Promise<boolean>：true 表示文件已创建，false 表示超时未创建
 */
export async function waitForFileCreation(fileUri: vscode.Uri, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
        let fileUri_1 = 'data:image/png:base64,iVBORwOKGgoAAAANSUhEUgAA...';
        const base64 = fileUri_1.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        // 规范化路径用于比较（避免大小写、斜杠差异等问题）
        const targetPath = fileUri.fsPath;

        // 创建文件系统监视器（只监听创建事件）
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(path.dirname(targetPath), path.basename(targetPath)),
            false, // ignoreCreateEvents 设为 false 表示不忽略创建事件
            true,  // ignoreChangeEvents
            true   // ignoreDeleteEvents
        );

        let timer: NodeJS.Timeout | undefined;

        const cleanup = () => {
            if (timer) clearTimeout(timer);
            watcher.dispose();
        };

        // 监听文件创建
        watcher.onDidCreate((uri) => {
            if (uri.fsPath === targetPath) {
                cleanup();
                resolve(true);
            }
        });

        // 设置超时
        timer = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeout);
    });
}

export type Platform = 'windows' | 'linux' | 'macos' | 'unknown';

export function getCurrentPlatform(): Platform {
    const platform = process.platform;
    if (platform === 'win32') {
        return 'windows';
    } else if (platform === 'linux') {
        return 'linux';
    } else if (platform === 'darwin') {
        return 'macos';
    }
    return 'unknown';
}

export async function setSaveDir(): Promise<string | undefined> {
    const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,      // 只允许选一个
        canSelectFiles: false,     // 不允许选文件
        canSelectFolders: true,    // ✅ 允许选文件夹
        title: t('pypto.download.selectDir') || undefined,
        openLabel: t('pypto.download.select') || undefined   // 按钮文字（可选）
    });
    return uris?.[0].fsPath;
}


export async function saveFile(message: { dataUrl: any, fileName?: any, filePath?: any }): Promise<boolean | undefined> {
    if (message.fileName) {
        // 2. 弹出保存对话框（用户可改目录 + 改文件名）
        const fileUri = await promptSaveFile(message.fileName);
        if (!fileUri) {
            return; // 用户取消
        }
        return await downloadFile(message.dataUrl, fileUri);
    }
    if (message.filePath) {
        return await downloadFile(message.dataUrl, vscode.Uri.file(message.filePath));
    }
}

async function downloadFile(base64DataUrl: any, filePath: any): Promise<boolean> {
    try {
        // 1. 校验输入
        if (!base64DataUrl || typeof base64DataUrl !== 'string') {
            throw new Error('无效的 Base64 数据');
        }

        if (!filePath || !(filePath instanceof vscode.Uri)) {
            throw new Error('无效的文件路径');
        }

        // 2. 检查是否为 data URL
        const DATA_URL_PREFIX = 'data:';
        if (!base64DataUrl.startsWith(DATA_URL_PREFIX)) {
            throw new Error('不是有效的 Data URL 格式');
        }

        // 3. 提取 Base64 部分（支持 base64 或 utf8 编码）
        let rawData: string;
        let isBase64 = false;

        if (base64DataUrl.includes('base64,')) {
            const parts = base64DataUrl.split('base64,');
            if (parts.length !== 2) throw new Error('Base64 格式错误');
            rawData = parts[1];
            isBase64 = true;
        } else if (base64DataUrl.includes('utf8,')) {
            const parts = base64DataUrl.split('utf8,');
            if (parts.length !== 2) throw new Error('UTF-8 Data URL 格式错误');
            rawData = decodeURIComponent(parts[1]);
            isBase64 = false;
        } else {
            // 尝试当作纯 base64 字符串处理（无 data: 前缀）
            rawData = base64DataUrl;
            isBase64 = true;
        }

        // 4. 转为 Uint8Array
        let uint8Array: Uint8Array;
        if (isBase64) {
            // 使用 atob 解码 Base64（兼容 VS Code 桌面环境）
            const binaryString = atob(rawData);
            uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
        } else {
            // UTF-8 文本内容
            uint8Array = new TextEncoder().encode(rawData);
        }

        // 5. 写入文件
        await vscode.workspace.fs.writeFile(filePath, uint8Array);

        // 6. 成功提示
        // const fileName = vscode.workspace.asRelativePath(filePath, false);
        // vscode.window.showInformationMessage(`✅ 文件已保存：${fileName}`);

        return true;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('保存文件失败:', error);
        // vscode.window.showErrorMessage(`❌ 保存失败：${msg}`);
        return false;
    }
}


/**
 * 让用户选择保存位置（目录 + 可编辑文件名），并返回完整文件 Uri
 * @param suggestedFileName 建议的文件名（不含扩展名），如 "my-diagram"
 * @param extension 文件扩展名，如 "svg"
 * @returns 用户选择的完整文件 Uri，或 undefined（取消）
 */
export async function promptSaveFile(
    defaultFileName: string = 'diagram'): Promise<vscode.Uri | undefined> {

    // 2. 设置默认路径（优先工作区根目录，否则用 home）
    const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri
        || vscode.Uri.file(require('os').homedir());

    const defaultUri = vscode.Uri.joinPath(defaultFolder, defaultFileName);

    // 3. 弹出保存对话框
    const fileUri = await vscode.window.showSaveDialog({
        title: t('pypto.download.saveFile') || undefined,
        defaultUri: defaultUri,
        saveLabel: t('pypto.download.save') || undefined // 按钮文字（部分平台支持）
    });

    return fileUri; // 可能是 undefined（用户取消）
}