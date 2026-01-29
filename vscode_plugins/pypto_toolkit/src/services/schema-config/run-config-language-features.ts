import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { BasicService } from '../basic-service';

// 核心常量定义
export const TARGET_CONFIG_FILE = 'tile_fwk_config.json';
export const SOURCE_SCHEMA_FILE = 'tile_fwk_config_schema.json';
export const TRANSFORMED_SCHEMA_DIR = 'schemas';
export const PLUGIN_SCHEMA_NAME = 'PYPTO TOOLKIT Config Schema';

// 扫描状态类型
export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'failed';

// 配置-Schema映射模型
export interface ConfigSchemaMap {
  configUri: vscode.Uri;
  sourceSchemaUri: vscode.Uri;
  transformedSchemaUri: vscode.Uri;
  workspaceName: string;
}

export class RunConfigLanguageFeaturesService extends BasicService {
  // 配置-Schema映射列表
  private _configSchemaMap: ConfigSchemaMap[] = [];
  // 扫描状态
  private _scanStatus: ScanStatus = 'idle';
  // 服务销毁标记
  private _isDisposed = false;
  // 扫描忽略目录
  private readonly ignoreDirs = new Set([
    'node_modules',
    'git',
    '.vscode',
    'dist',
    'build',
    'out',
    'coverage',
    'include',
    'tests',
    'codegen',
    'const_model',
    'machine',
    'operator',
    'passes',
  ]);
  // 插件上下文
  private readonly _context: vscode.ExtensionContext;
  // 扫描防抖定时器
  private _scanDebounceTimer: NodeJS.Timeout | null = null;

  constructor(context: vscode.ExtensionContext) {
    super('language-features');
    this._context = context;
    this.scanWorkspace();
    this.registerWorkspaceListeners();
  }

  /**
   * 扫描工作区-防抖处理
   * @param delay 防抖延迟时间
   */
  public scanWorkspace(delay: number = 300): void {
    if (this._isDisposed) return;
    if (this._scanDebounceTimer) clearTimeout(this._scanDebounceTimer);
    this._scanDebounceTimer = setTimeout(async () => {
      await this._doScanWorkspace();
      this._scanDebounceTimer = null;
    }, delay);
  }

  /**
   * 实际扫描逻辑-边扫边注册，扫描一个生效一个
   */
  public async _doScanWorkspace(): Promise<void> {
    if (this._isDisposed) return;
    // 扫描前清空旧配置和转换文件，保证数据干净
    await this.clearAllPluginSchemas();
    this._configSchemaMap = [];

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this._scanStatus = 'completed';
      return;
    }

    this._scanStatus = 'scanning';
    const scannedUris = new Set<string>();

    try {
      for (const workspaceFolder of workspaceFolders) {
        if (this._isDisposed) break;

        const rootUri = workspaceFolder.uri;
        const workspaceName = workspaceFolder.name;
        const queue: vscode.Uri[] = [rootUri];
        const scannedDirs = new Set<string>([rootUri.toString()]);

        // 广度优先遍历目录
        while (queue.length > 0 && this._scanStatus === 'scanning' && !this._isDisposed) {
          const currentDirUri = queue.shift()!;
          try {
            const entries = await vscode.workspace.fs.readDirectory(currentDirUri);
            for (const [entryName, entryType] of entries) {
              if (this._isDisposed) break;
              const entryUri = vscode.Uri.joinPath(currentDirUri, entryName);
              const entryUriStr = entryUri.toString();

              // 处理目录-忽略指定目录和已扫描目录
              if (entryType === vscode.FileType.Directory) {
                if (this.ignoreDirs.has(entryName) || scannedDirs.has(entryUriStr)) continue;
                scannedDirs.add(entryUriStr);
                queue.push(entryUri);
                continue;
              }

              // 找到目标配置文件，校验同级Schema文件
              if (entryType === vscode.FileType.File && entryName === TARGET_CONFIG_FILE) {
                if (scannedUris.has(entryUriStr)) continue;
                scannedUris.add(entryUriStr);

                const sourceSchemaUri = vscode.Uri.joinPath(currentDirUri, SOURCE_SCHEMA_FILE);
                if (await this.isFileExists(sourceSchemaUri)) {
                  const transformedSchemaUri = await this.transformAndSaveSchema(sourceSchemaUri);
                  if (transformedSchemaUri && !this._isDisposed) {
                    // 扫描到合法配对，立即注册生效
                    const validSchemaMap = {
                      configUri: entryUri,
                      sourceSchemaUri,
                      transformedSchemaUri,
                      workspaceName,
                    };
                    await this.addSingleSchema(validSchemaMap);
                  }
                }
              }
            }
          } catch (error: any) {
            // 忽略重载时的Canceled错误，仅打印实际异常
            const isCanceled = error.message?.includes('Canceled') || error.code === 'Canceled';
            if (!isCanceled && !this._isDisposed) {
              console.log(`扫描目录失败：${currentDirUri.fsPath}`, error);
            }
          }
        }
      }
      if (!this._isDisposed) {
        this._scanStatus = 'completed';
      }
    } catch (error) {
      if (!this._isDisposed) {
        this._scanStatus = 'failed';
        this._configSchemaMap = [];
      }
    }
  }

  /**
   * 清空插件所有旧的Schema配置和转换文件
   */
  private async clearAllPluginSchemas(): Promise<void> {
    if (this._isDisposed) return;
    // 删除磁盘上的旧转换文件
    await this.deleteTransformedSchemaFiles();
    // 清空settings.json中的旧注册配置
    const jsonConfig = vscode.workspace.getConfiguration('json');
    const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
    const remainingSchemas = currentSchemas.filter((s) => s.name !== PLUGIN_SCHEMA_NAME);

    if (remainingSchemas.length !== currentSchemas.length) {
      // 工作区级配置 立即写入
      await jsonConfig.update('schemas', remainingSchemas, vscode.ConfigurationTarget.Workspace, true);
    }
  }

  /**
   * 删除globalStorage下的旧Schema转换文件
   */
  private async deleteTransformedSchemaFiles(): Promise<void> {
    if (this._isDisposed) return;
    try {
      const schemaDirUri = vscode.Uri.joinPath(this._context.globalStorageUri, TRANSFORMED_SCHEMA_DIR);
      if (await this.isFileExists(schemaDirUri)) {
        const entries = await vscode.workspace.fs.readDirectory(schemaDirUri);
        for (const [entryName, entryType] of entries) {
          if (this._isDisposed) break;
          if (entryType === vscode.FileType.File) {
            // 仅删除本插件生成的Schema文件
            if (entryName.startsWith(`${SOURCE_SCHEMA_FILE.replace('.json', '')}-`) && entryName.endsWith('.json')) {
              const fileUri = vscode.Uri.joinPath(schemaDirUri, entryName);
              await vscode.workspace.fs.delete(fileUri);
            }
          }
        }
      }
      // 确保目录存在，避免后续写入失败
      await vscode.workspace.fs.createDirectory(schemaDirUri);
    } catch (error: any) {
      const isCanceled = error.message?.includes('Canceled') || error.code === 'Canceled';
      if (!isCanceled && !this._isDisposed) {
        console.error(`处理Schema目录失败：`, error);
      }
    }
  }

  /**
   * 批量注册-保留方法避免调用报错，实际边扫边注册已不再使用
   */
  private async batchRegisterSchemas(): Promise<void> {
    if (this._isDisposed || this._configSchemaMap.length === 0) return;
    const jsonConfig = vscode.workspace.getConfiguration('json');
    const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
    const newSchemaItems = this._configSchemaMap.map((item) => ({
      fileMatch: [item.configUri.path.toString()],
      url: item.transformedSchemaUri.path.toString(),
      name: PLUGIN_SCHEMA_NAME,
    }));
    await jsonConfig.update('schemas', [...currentSchemas, ...newSchemaItems], vscode.ConfigurationTarget.Workspace, true);
  }

  /**
   * 将源Schema文件转换后写入globalStorage
   * @param sourceSchemaUri 源Schema文件URI
   * @returns 转换后文件URI
   */
  private async transformAndSaveSchema(sourceSchemaUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    if (this._isDisposed) return undefined;
    try {
      const rawSchemaBuffer = await vscode.workspace.fs.readFile(sourceSchemaUri);
      const rawSchema = JSON.parse(Buffer.from(rawSchemaBuffer).toString('utf-8'));
      const transformedSchema = this.transformSchema(rawSchema, this.getVscodeLanguage());
      const uniqueFileName = this.generateUniqueSchemaFileName(sourceSchemaUri);
      const schemaDirUri = vscode.Uri.joinPath(this._context.globalStorageUri, TRANSFORMED_SCHEMA_DIR);

      await vscode.workspace.fs.createDirectory(schemaDirUri);
      const transformedSchemaUri = vscode.Uri.joinPath(schemaDirUri, uniqueFileName);
      const transformedBuffer = Buffer.from(JSON.stringify(transformedSchema, null, 2), 'utf-8');
      await vscode.workspace.fs.writeFile(transformedSchemaUri, transformedBuffer);

      return transformedSchemaUri;
    } catch (error) {
      if (!this._isDisposed) {
        console.warn(`Schema转换失败：${sourceSchemaUri.fsPath}`, error);
      }
      return undefined;
    }
  }

  /**
   * 目录URI去重，避免同一目录重复处理
   * @param dirUris 目录URI数组
   * @returns 去重后的URI数组
   */
  private uniqueDirUris(dirUris: vscode.Uri[]): vscode.Uri[] {
    const uriSet = new Set<string>();
    return dirUris.filter((dirUri) => {
      const key = dirUri.toString();
      if (!uriSet.has(key)) {
        uriSet.add(key);
        return true;
      }
      return false;
    });
  }

  /**
   * 校验目录下是否存在合法的Config-Schema配对
   * @param dirUri 目录URI
   * @param workspaceName 工作区名称
   * @returns 合法返回映射模型，否则返回null
   */
  private async getValidConfigSchemaMap(dirUri: vscode.Uri, workspaceName: string): Promise<ConfigSchemaMap | null> {
    if (this._isDisposed) return null;
    try {
      const configUri = vscode.Uri.joinPath(dirUri, TARGET_CONFIG_FILE);
      const sourceSchemaUri = vscode.Uri.joinPath(dirUri, SOURCE_SCHEMA_FILE);
      if ((await this.isFileExists(configUri)) && (await this.isFileExists(sourceSchemaUri))) {
        const transformedUri = await this.transformAndSaveSchema(sourceSchemaUri);
        if (transformedUri) {
          return { configUri, sourceSchemaUri, transformedSchemaUri: transformedUri, workspaceName };
        }
      }
      return null;
    } catch (error) {
      console.warn(`校验目录配对失败：${dirUri.fsPath}`, error);
      return null;
    }
  }

  /**
   * 根据ConfigURI删除对应的Schema注册和转换文件
   * @param configUri 配置文件URI
   */
  private async removeSchemaByConfigUri(configUri: vscode.Uri): Promise<void> {
    if (this._isDisposed) return;
    try {
      // 删除磁盘上的转换文件
      const targetItem = this._configSchemaMap.find((item) => item.configUri.toString() === configUri.toString());
      if (targetItem) {
        if (await this.isFileExists(targetItem.transformedSchemaUri)) {
          await vscode.workspace.fs.delete(targetItem.transformedSchemaUri);
        }
        this._configSchemaMap = this._configSchemaMap.filter((item) => item.configUri.toString() !== configUri.toString());
      }
      // 删除settings.json中的注册配置
      const jsonConfig = vscode.workspace.getConfiguration('json');
      const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
      const updatedSchemas = currentSchemas.filter(
        (s) => s.name !== PLUGIN_SCHEMA_NAME || !s.fileMatch.includes(configUri.path.toString()),
      );
      if (updatedSchemas.length !== currentSchemas.length) {
        await jsonConfig.update('schemas', updatedSchemas, vscode.ConfigurationTarget.Workspace, true);
      }
    } catch (error) {
      console.warn(`删除Schema注册失败：${configUri.fsPath}`, error);
    }
  }

  /**
   * 单个Schema注册-写入settings并更新映射列表
   * @param schemaMap 合法的Config-Schema映射模型
   */
  private async addSingleSchema(schemaMap: ConfigSchemaMap): Promise<void> {
    if (this._isDisposed) return;
    try {
      this._configSchemaMap.push(schemaMap);
      const jsonConfig = vscode.workspace.getConfiguration('json');
      const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
      const newSchemaItem = {
        fileMatch: [schemaMap.configUri.path.toString()],
        url: schemaMap.transformedSchemaUri.path.toString(),
        name: PLUGIN_SCHEMA_NAME,
      };
      // 工作区级配置 + 强制立即写入
      await jsonConfig.update('schemas', [...currentSchemas, newSchemaItem], vscode.ConfigurationTarget.Workspace, true);
    } catch (error) {
      console.warn(`新增Schema注册失败：${schemaMap.configUri.fsPath}`, error);
    }
  }

  /**
   * 处理文件/文件夹重命名的逻辑
   * @param renameEvent 重命名事件参数
   */
  private async handleRenameFiles(renameEvent: vscode.FileRenameEvent): Promise<void> {
    if (this._isDisposed || renameEvent.files.length === 0) return;
    // 筛选涉及目标文件的重命名项
    const targetItems = renameEvent.files.filter(
      (file) =>
        file.oldUri.path.endsWith(TARGET_CONFIG_FILE) ||
        file.oldUri.path.endsWith(SOURCE_SCHEMA_FILE) ||
        file.newUri.path.endsWith(TARGET_CONFIG_FILE) ||
        file.newUri.path.endsWith(SOURCE_SCHEMA_FILE),
    );
    if (targetItems.length === 0) return;

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'default';
    for (const item of targetItems) {
      if (this._isDisposed) break;
      const oldDirUri = vscode.Uri.joinPath(item.oldUri, '..');
      const newDirUri = vscode.Uri.joinPath(item.newUri, '..');
      // 删旧目录配置
      const oldConfigUri = vscode.Uri.joinPath(oldDirUri, TARGET_CONFIG_FILE);
      await this.removeSchemaByConfigUri(oldConfigUri);
      // 加新目录配置
      const validMap = await this.getValidConfigSchemaMap(newDirUri, workspaceName);
      if (validMap) {
        await this.addSingleSchema(validMap);
      }
    }
  }

  /**
   * 注册所有文件/工作区监听-优化，仅处理目标文件
   */
  private registerWorkspaceListeners(): void {
    // 工作区增删-保留全量扫描
    const workspaceFolderListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (!this._isDisposed) this.scanWorkspace();
    });

    // 文件新建-处理
    const fileCreateListener = vscode.workspace.onDidCreateFiles((e) => {
      if (this._isDisposed) return;
      const targetFiles = e.files.filter((uri) => uri.path.endsWith(TARGET_CONFIG_FILE) || uri.path.endsWith(SOURCE_SCHEMA_FILE));
      if (targetFiles.length === 0) return;

      const targetDirs = this.uniqueDirUris(targetFiles.map((uri) => vscode.Uri.joinPath(uri, '..')));
      const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'default';
      targetDirs.forEach(async (dirUri) => {
        if (this._isDisposed) return;
        const validMap = await this.getValidConfigSchemaMap(dirUri, workspaceName);
        if (validMap) await this.addSingleSchema(validMap);
      });
    });

    // 文件删除-处理
    const fileDeleteListener = vscode.workspace.onDidDeleteFiles((e) => {
      if (this._isDisposed) return;
      const targetFiles = e.files.filter((uri) => uri.path.endsWith(TARGET_CONFIG_FILE) || uri.path.endsWith(SOURCE_SCHEMA_FILE));
      if (targetFiles.length === 0) return;

      const targetDirs = this.uniqueDirUris(targetFiles.map((uri) => vscode.Uri.joinPath(uri, '..')));
      targetDirs.forEach(async (dirUri) => {
        if (this._isDisposed) return;
        const configUri = vscode.Uri.joinPath(dirUri, TARGET_CONFIG_FILE);
        await this.removeSchemaByConfigUri(configUri);
      });
    });

    // Schema文件修改-更新
    const textDocChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this._isDisposed) return;
      const docUri = e.document.uri;
      if (!docUri.path.endsWith(SOURCE_SCHEMA_FILE)) return;

      const dirUri = vscode.Uri.joinPath(docUri, '..');
      const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'default';
      (async () => {
        const oldConfigUri = vscode.Uri.joinPath(dirUri, TARGET_CONFIG_FILE);
        await this.removeSchemaByConfigUri(oldConfigUri);
        const newMap = await this.getValidConfigSchemaMap(dirUri, workspaceName);
        if (newMap) await this.addSingleSchema(newMap);
      })();
    });

    // 文件重命名-处理
    const fileRenameListener = vscode.workspace.onDidRenameFiles((e) => {
      if (!this._isDisposed) this.handleRenameFiles(e);
    });

    // 监听器加入销毁队列
    this._disposables.push(workspaceFolderListener, fileCreateListener, fileDeleteListener, textDocChangeListener, fileRenameListener);
  }

  /**
   * 校验文件/目录是否存在
   * @param uri 目标URI
   * @returns 存在返回true，否则false
   */
  private async isFileExists(uri: vscode.Uri): Promise<boolean> {
    if (this._isDisposed) return false;
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取VSCode当前语言
   * @returns 语言标识（zh/en）
   */
  private getVscodeLanguage(): string {
    const lang = vscode.env.language || 'en';
    return lang.startsWith('zh') ? 'zh' : 'en';
  }

  /**
   * 生成唯一的Schema文件名-MD5源文件路径
   * @param sourceSchemaUri 源Schema文件URI
   * @returns 唯一文件名
   */
  private generateUniqueSchemaFileName(sourceSchemaUri: vscode.Uri): string {
    const md5 = crypto.createHash('md5');
    const hash = md5.update(sourceSchemaUri.toString()).digest('hex');
    return `${SOURCE_SCHEMA_FILE.replace('.json', '')}-${hash}.json`;
  }

  /**
   * Schema格式转换-适配VSCode提示（label->description）
   * @param rawSchema 源Schema对象
   * @param lang 目标语言
   * @returns 转换后的Schema对象
   */
  private transformSchema(rawSchema: any, lang: string): any {
    const isZh = lang === 'zh';
    const walk = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(walk);

      const result: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (key === 'label') continue;
          result[key] = walk(obj[key]);
        }
      }
      // label转换为对应语言的description
      if (obj.label && (obj.label.zh || obj.label.en)) {
        result.description = isZh ? obj.label.zh : obj.label.en;
      }
      // 处理options数组中的label
      if (Array.isArray(obj.options)) {
        result.options = obj.options.map((opt: any) => {
          const newOpt = { ...walk(opt) };
          if (opt.label) {
            newOpt.description = isZh ? opt.label.zh : opt.label.en;
            delete newOpt.label;
          }
          return newOpt;
        });
      }
      return result;
    };
    return walk(rawSchema);
  }

  /**
   * 销毁服务-清理定时器、标记状态、删除临时文件
   */
  public override dispose(): void {
    this._isDisposed = true;
    // 清空防抖定时器
    if (this._scanDebounceTimer) clearTimeout(this._scanDebounceTimer);
    // 删除转换文件
    this.deleteTransformedSchemaFiles().catch((err) => {
      const isCanceled = err.message?.includes('Canceled') || err.code === 'Canceled';
      if (!isCanceled) {
        console.warn('插件销毁时删除文件失败：', err);
      }
    });
    super.dispose();
  }
}
