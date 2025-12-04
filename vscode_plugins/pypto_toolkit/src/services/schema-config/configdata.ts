import * as vscode from 'vscode';
import { CustomConfigItemVo } from '../../types/config-schema/config-schema';

import { BasicService } from '../basic-service';
import { ConfigFileInfo, ScanStatus } from '../../types/config-schema/config-schema';

const CONFIG_FILE_NAME = 'tile_fwk_config.json';
export class ConfigDataService extends BasicService {
  /** 已找到的配置文件列表 */
  private _configFiles: ConfigFileInfo[] = [];

  /** 扫描状态（初始状态是暂停） */
  private _scanStatus: ScanStatus = 'idle';

  /** 推送「文件列表+扫描状态」 */
  private _onDidUpdateConfigData = new vscode.EventEmitter<{
    files: ConfigFileInfo[]; // 完整文件列表
    status: ScanStatus; // 当前扫描状态
  }>();

  /** 扫描忽略目录（暂定） */
  private readonly ignoreDirs = new Set(['node_modules', '.git', '.vscode', 'dist', 'build', 'out', 'coverage']);

  private _fileWatcher?: vscode.FileSystemWatcher;

  constructor() {
    super('configData');
    // 只注册统一事件发射器到销毁列表
    this._disposables.push(this._onDidUpdateConfigData);
    this.scanDirectory();
    this.watchFileChange();
  }

  /**
   * 订阅数据更新（前端唯一需要订阅的事件）
   * 每次文件列表或扫描状态变化，都会推送完整数据
   */
  public onDidUpdateConfigData(callback: (data: { files: ConfigFileInfo[]; status: ScanStatus }) => void): vscode.Disposable {
    callback({
      files: [...this._configFiles],
      status: this._scanStatus,
    });
    return this._onDidUpdateConfigData.event(callback);
  }

  /**
   * 同步获取当前完整数据（初始化时调用一次）
   */
  public getConfigData(): {
    files: ConfigFileInfo[];
    status: ScanStatus;
  } {
    return {
      files: [...this._configFiles],
      status: this._scanStatus,
    };
  }

  /** 扫描目录（扫描中/扫描完成后，触发统一事件） */
  private async scanDirectory(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this._scanStatus = 'completed';
      this.emitConfigDataUpdate();
      return;
    }

    // 初始化扫描状态
    this._configFiles = [];
    this._scanStatus = 'scanning';
    this.emitConfigDataUpdate();

    try {
      for (const workspaceFolder of workspaceFolders) {
        const rootUri = workspaceFolder.uri;
        const workspaceName = workspaceFolder.name;
        const queue: vscode.Uri[] = [rootUri];
        const scannedDirs = new Set<string>([rootUri.toString()]);

        while (queue.length > 0 && this._scanStatus === 'scanning') {
          const currentDirUri = queue.shift()!;
          try {
            const entries = await vscode.workspace.fs.readDirectory(currentDirUri);
            for (const [entryName, entryType] of entries) {
              const entryUri = vscode.Uri.joinPath(currentDirUri, entryName);

              // 处理 config.json 文件
              if (entryType === vscode.FileType.File && entryName === CONFIG_FILE_NAME) {
                await this.handleFoundConfigFile(entryUri, workspaceName);
                // 找到单个文件后，推送最新完整列表）
                this.emitConfigDataUpdate();
                continue;
              }

              // 处理子目录
              if (entryType === vscode.FileType.Directory) {
                if (this.ignoreDirs.has(entryName)) continue;
                const entryUriStr = entryUri.toString();
                if (!scannedDirs.has(entryUriStr)) {
                  scannedDirs.add(entryUriStr);
                  queue.push(entryUri);
                }
              }
            }
          } catch (error) {
            console.warn(`扫描目录失败：${currentDirUri.fsPath}`, error);
          }
        }
      }

      // 扫描完成
      this._scanStatus = 'completed';
      this.emitConfigDataUpdate(); // 通知前端“完成”+完整列表
    } catch (error) {
      this._scanStatus = 'failed';
      this.emitConfigDataUpdate(); // 通知前端“失败”
    }
  }

  /** 处理找到的文件（保持不变，新增触发统一事件） */
  private async handleFoundConfigFile(uri: vscode.Uri, workspaceName: string): Promise<void> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      const fileInfo: ConfigFileInfo = {
        uri,
        path: uri.fsPath,
        fileName: uri.path.split('/').pop()!,
        workspaceName,
        lastModified: new Date(stat.mtime),
        size: stat.size,
      };

      // 去重后添加到列表
      const exists = this._configFiles.some((f) => f.uri.toString() === uri.toString());
      if (!exists) {
        this._configFiles.push(fileInfo);
        // 无需单独触发事件，扫描循环中已触发
      }
    } catch (error) {
      console.warn(`获取文件信息失败：${uri.fsPath}`, error);
    }
  }

  /** 监听文件变更（修改：变更后触发统一事件） */
  private watchFileChange() {
    this._fileWatcher = vscode.workspace.createFileSystemWatcher(`**/${CONFIG_FILE_NAME}`);
    this._disposables.push(
      this._fileWatcher.onDidCreate(async (uri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
          await this.handleFoundConfigFile(uri, workspaceFolder.name);
          this.emitConfigDataUpdate(); // 新增文件后，推送完整列表
        }
      }),

      this._fileWatcher.onDidDelete((uri) => {
        this._configFiles = this._configFiles.filter((f) => f.uri.toString() !== uri.toString());
        this.emitConfigDataUpdate(); // 删除文件后，推送完整列表
      }),

      this._fileWatcher.onDidChange(async (uri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
          await this.handleFoundConfigFile(uri, workspaceFolder.name);
          this.emitConfigDataUpdate(); // 修改文件后，推送完整列表
        }
      }),

      this._fileWatcher,
    );
  }

  private emitConfigDataUpdate() {
    this._onDidUpdateConfigData.fire({
      files: [...this._configFiles], // 返回副本，避免外部修改
      status: this._scanStatus,
    });
  }

  // 销毁方法（保持不变）
  public override dispose() {
    this._scanStatus = 'idle';
    super.dispose();
  }
}

/**
 * 读取tile_fwk_config文件
 */
export async function readFwkData(fileUri: vscode.Uri) {
  const fileContent = await vscode.workspace.fs.readFile(fileUri);
  return JSON.parse(fileContent.toString());
}

/**
 * 写入文件
 * @param baseUri 文件路径
 * @param targetObj 数据对象
 */
export async function writeFileData(baseUri: vscode.Uri, targetObj: object) {
  const jsonContent = JSON.stringify(targetObj, null, 2);
  const content = new TextEncoder().encode(jsonContent);

  // 写入文件
  try {
    await vscode.workspace.fs.writeFile(baseUri, content);
  } catch (err) {
    vscode.window.showErrorMessage(`${(err as Error).message}`);
  }
}

/**
 * 创建指定文件夹
 * @param baseUri 需要创建的文件uri路径
 */
export async function addNewFile(baseUri: vscode.Uri) {
  // 创建文件夹
  try {
    await vscode.workspace.fs.createDirectory(baseUri);
  } catch (err) {
    vscode.window.showErrorMessage(`${(err as Error).message}`);
  }
}

/**
 * 获取指定目录下的所有 配置JSON 文件列表
 * @param baseUri 目标目录的 URI（vscode.Uri 类型）
 * @returns 结构化 JSON 文件列表
 */
export async function getJsonFileList(baseUri: vscode.Uri): Promise<CustomConfigItemVo[]> {
  try {
    const stats = await vscode.workspace.fs.stat(baseUri);
    if (stats.type !== vscode.FileType.Directory) {
      vscode.window.showErrorMessage(`${stats.type}`);
      return [];
    }
    const dirEntries = await vscode.workspace.fs.readDirectory(baseUri);
    const jsonFileList: CustomConfigItemVo[] = [];
    for (const [entryName, entryType] of dirEntries) {
      if (entryType === vscode.FileType.File && entryName.toLowerCase().endsWith('.json')) {
        const fileUri = vscode.Uri.joinPath(baseUri, entryName);
        const filePath = fileUri.fsPath;
        jsonFileList.push({
          configName: entryName,
          configBaseName: entryName.replace(/\.json$/i, ''),
          configPath: filePath,
        });
      }
    }
    const FILE_NAME_REGEX = /(\d+)$/; // 匹配文件名末尾的数字
    jsonFileList.sort((a, b) => {
      // 提取 a 的数字部分（从 configBaseName 提取，已去掉.json后缀）
      const aMatch = a.configBaseName.match(FILE_NAME_REGEX);
      const aNum = aMatch ? parseInt(aMatch[1], 10) : -1; // 无数字时排最前

      // 提取 b 的数字部分
      const bMatch = b.configBaseName.match(FILE_NAME_REGEX);
      const bNum = bMatch ? parseInt(bMatch[1], 10) : -1;

      // 按数字升序排序（数字小的在前）
      return aNum - bNum;
    });
    return jsonFileList;
  } catch (err) {
    // 处理目录不存在、权限不足等错误
    vscode.window.showErrorMessage(`${(err as Error).message}`);
    return [];
  }
}

/**
 * 删除指定路径下的配置文件
 * @param fileUri 目标目录的 URI（vscode.Uri 类型）
 */
export async function delFile(fileUri: vscode.Uri) {
  try {
    // 验证：目标是文件（而非目录）且存在
    try {
      const stats = await vscode.workspace.fs.stat(fileUri);
      if (stats.type !== vscode.FileType.File) {
        vscode.window.showErrorMessage(`${stats.type}`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`${(err as Error).message}`);
    }

    // 执行删除
    await vscode.workspace.fs.delete(fileUri, {
      useTrash: true,
      recursive: false,
    });
    // 删除成功：提示用户 + 通知前端刷新列表 todo
  } catch (err) {
    // 处理权限不足、文件被占用等错误
    vscode.window.showErrorMessage(`${(err as Error).message}`);
  }
}
