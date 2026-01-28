import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { BasicService } from '../basic-service';

// 核心常量定义
export const TARGET_CONFIG_FILE = 'tile_fwk_config.json';
export const SOURCE_SCHEMA_FILE = 'tile_fwk_config_schema.json';
export const TRANSFORMED_SCHEMA_DIR = 'schemas'; // globalStorage下的子目录
export const PLUGIN_SCHEMA_NAME = 'PYPTO TOOLKIT Config Schema'; // 本插件Schema名称

// 扫描状态类型
export type ScanStatus = 'idle' | 'scanning' | 'completed' | 'failed';

// 配置+Schema文件的映射信息
export interface ConfigSchemaMap {
  /** tile_fwk_config.json的绝对URI */
  configUri: vscode.Uri;
  /** 同级tile-fwk-config-schema.json的绝对URI */
  sourceSchemaUri: vscode.Uri;
  /** 转换后存入globalStorage的Schema文件URI */
  transformedSchemaUri: vscode.Uri;
  /** 所属工作区名称 */
  workspaceName: string;
}

export class RunConfigLanguageFeaturesService extends BasicService {
  /** 配置-Schema的映射列表 */
  private _configSchemaMap: ConfigSchemaMap[] = [];
  /** 扫描状态 */
  private _scanStatus: ScanStatus = 'idle';
  /** 扫描忽略目录 */
  private readonly ignoreDirs = new Set([
    'node_modules',
    '.git',
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
  /** 插件上下文（用于获取globalStorageUri、注册销毁资源） */
  private readonly _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    super('language-features');
    this._context = context;
    // 初始化：扫描工作区 + 注册所有监听 + 加入销毁队列
    this.scanWorkspace();
    this.registerWorkspaceListeners();
  }

  /** 扫描整个工作区，找到所有有效配置-Schema文件对 */
  public async scanWorkspace(): Promise<void> {
    // 扫描前立即清空本插件所有旧的Schema注册（会同步删除旧转换文件）
    await this.clearAllPluginSchemas();

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this._scanStatus = 'completed';
      this._configSchemaMap = [];
      return;
    }

    // 初始化扫描状态
    this._scanStatus = 'scanning';
    const newConfigSchemaMap: ConfigSchemaMap[] = [];
    const scannedUris = new Set<string>();

    try {
      for (const workspaceFolder of workspaceFolders) {
        const rootUri = workspaceFolder.uri;
        const workspaceName = workspaceFolder.name;
        const queue: vscode.Uri[] = [rootUri];
        const scannedDirs = new Set<string>([rootUri.toString()]);

        // 广度优先遍历目录
        while (queue.length > 0 && this._scanStatus === 'scanning') {
          const currentDirUri = queue.shift()!;
          try {
            const entries = await vscode.workspace.fs.readDirectory(currentDirUri);
            for (const [entryName, entryType] of entries) {
              const entryUri = vscode.Uri.joinPath(currentDirUri, entryName);
              const entryUriStr = entryUri.toString();

              // 忽略指定目录/已扫描目录
              if (entryType === vscode.FileType.Directory) {
                if (this.ignoreDirs.has(entryName) || scannedDirs.has(entryUriStr)) continue;
                scannedDirs.add(entryUriStr);
                queue.push(entryUri);
                continue;
              }

              // 找到目标配置文件：tile_fwk_config.json
              if (entryType === vscode.FileType.File && entryName === TARGET_CONFIG_FILE) {
                if (scannedUris.has(entryUriStr)) continue;
                scannedUris.add(entryUriStr);

                // 查找同级的源Schema文件
                const sourceSchemaUri = vscode.Uri.joinPath(currentDirUri, SOURCE_SCHEMA_FILE);
                // 校验源Schema文件是否存在
                if (await this.isFileExists(sourceSchemaUri)) {
                  // 转换Schema + 写入globalStorage
                  const transformedSchemaUri = await this.transformAndSaveSchema(sourceSchemaUri);
                  if (transformedSchemaUri) {
                    newConfigSchemaMap.push({
                      configUri: entryUri,
                      sourceSchemaUri,
                      transformedSchemaUri,
                      workspaceName,
                    });
                  }
                }
                continue;
              }
            }
          } catch (error) {
            console.warn(`扫描目录失败：${currentDirUri.fsPath}`, error);
          }
        }
      }

      // 扫描完成后，批量注册新的Schema
      this._configSchemaMap = newConfigSchemaMap;
      await this.batchRegisterSchemas();

      // 扫描完成更新状态
      this._scanStatus = 'completed';
    } catch (error) {
      this._scanStatus = 'failed';
      this._configSchemaMap = [];
    }
  }

  /**
   * 清空本插件注册的所有旧Schema
   */
  private async clearAllPluginSchemas(): Promise<void> {
    // 删除旧的转换生成文件
    await this.deleteTransformedSchemaFiles();

    // 清空Schema配置
    const jsonConfig = vscode.workspace.getConfiguration('json');
    const currentSchemas = jsonConfig.get<any[]>('schemas') || [];

    // 保留所有非本插件的Schema（用户自定义的、其他插件的）
    const remainingSchemas = currentSchemas.filter((s) => s.name !== PLUGIN_SCHEMA_NAME);

    // 只有配置变化时才更新
    if (remainingSchemas.length !== currentSchemas.length) {
      await jsonConfig.update('schemas', remainingSchemas, vscode.ConfigurationTarget.Global, false);
    }
  }

  /**
   * 删除globalStorage/schemas目录下所有转换生成的schema文件
   */
  private async deleteTransformedSchemaFiles(): Promise<void> {
    try {
      const schemaDirUri = vscode.Uri.joinPath(this._context.globalStorageUri, TRANSFORMED_SCHEMA_DIR);

      // 1. 先检查目录是否存在
      if (await this.isFileExists(schemaDirUri)) {
        // 2. 读取目录下所有文件/子目录
        const entries = await vscode.workspace.fs.readDirectory(schemaDirUri);

        // 3. 遍历删除所有文件
        for (const [entryName, entryType] of entries) {
          if (entryType === vscode.FileType.File) {
            // 仅删除本插件生成的schema文件（匹配命名规则：SOURCE_SCHEMA_FILE前缀+MD5+json）
            if (entryName.startsWith(`${SOURCE_SCHEMA_FILE.replace('.json', '')}-`) && entryName.endsWith('.json')) {
              const fileUri = vscode.Uri.joinPath(schemaDirUri, entryName);
              await vscode.workspace.fs.delete(fileUri);
            }
          }
        }
      }

      // 4. 确保schemas目录存在（删除文件后重建空目录，避免后续写入时目录不存在）
      await vscode.workspace.fs.createDirectory(schemaDirUri);
    } catch (error) {
      // 失败仅打印警告，不阻断Schema配置清空的主逻辑
      console.warn(`删除旧Schema文件失败：`, error);
    }
  }

  /**
   * 批量注册所有有效配置的Schema
   */
  private async batchRegisterSchemas(): Promise<void> {
    if (this._configSchemaMap.length === 0) return;

    const jsonConfig = vscode.workspace.getConfiguration('json');
    const currentSchemas = jsonConfig.get<any[]>('schemas') || []; // 过滤掉本插件旧Schema

    // 构建新的Schema注册项数组
    const newSchemaItems = this._configSchemaMap.map((item) => ({
      fileMatch: [item.configUri.path.toString()],
      url: item.transformedSchemaUri.path.toString(),
      name: PLUGIN_SCHEMA_NAME, // 用于后续清空
    }));

    // 合并：原有非本插件Schema + 本次新注册的Schema
    const newSchemas = [...currentSchemas, ...newSchemaItems];

    // 统一更新配置
    await jsonConfig.update('schemas', newSchemas, vscode.ConfigurationTarget.Global, false);
  }

  /**
   * 转换Schema并写入globalStorage
   * @param sourceSchemaUri 需要转换的schema 的 uri
   */
  private async transformAndSaveSchema(sourceSchemaUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    try {
      // 1. 读取源Schema文件内容
      const rawSchemaBuffer = await vscode.workspace.fs.readFile(sourceSchemaUri);
      const rawSchema = JSON.parse(Buffer.from(rawSchemaBuffer).toString('utf-8'));
      // 2. 获取当前VSCode语言（zh开头为中文，否则用en）
      const vscodeLang = this.getVscodeLanguage();
      // 3. 转换Schema
      const transformedSchema = this.transformSchema(rawSchema, vscodeLang);
      // 4. 生成唯一文件名（基于源Schema路径MD5，避免重名覆盖）
      const uniqueFileName = this.generateUniqueSchemaFileName(sourceSchemaUri);
      // 5. 创建globalStorage/schemas目录（不存在则创建）
      const schemaDirUri = vscode.Uri.joinPath(this._context.globalStorageUri, TRANSFORMED_SCHEMA_DIR);
      await vscode.workspace.fs.createDirectory(schemaDirUri);
      // 6. 转换后Schema的存储URI
      const transformedSchemaUri = vscode.Uri.joinPath(schemaDirUri, uniqueFileName);
      // 7. 写入文件（覆盖原有文件，更新时自动刷新）
      const transformedSchemaBuffer = Buffer.from(JSON.stringify(transformedSchema, null, 2), 'utf-8');
      await vscode.workspace.fs.writeFile(transformedSchemaUri, transformedSchemaBuffer);

      return transformedSchemaUri;
    } catch (error) {
      console.warn(`Schema转换/写入失败：${sourceSchemaUri.fsPath}`, error);
      return undefined;
    }
  }

  /** 注册工作区和文件的变化监听 */
  private registerWorkspaceListeners(): void {
    // 监听1：工作区文件夹增/删
    const workspaceFolderListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.scanWorkspace();
    });

    // 监听2：文件/文件夹新建
    const fileCreateListener = vscode.workspace.onDidCreateFiles((e) => {
      const isTargetFile = e.files.some((uri) => uri.path.endsWith(TARGET_CONFIG_FILE) || uri.path.endsWith(SOURCE_SCHEMA_FILE));
      if (isTargetFile) this.scanWorkspace();
    });

    // 监听3：文件/文件夹删除
    const fileDeleteListener = vscode.workspace.onDidDeleteFiles((e) => {
      const isTargetFile = e.files.some((uri) => uri.path.endsWith(TARGET_CONFIG_FILE) || uri.path.endsWith(SOURCE_SCHEMA_FILE));
      if (isTargetFile) this.scanWorkspace();
    });

    // 监听4：文本文件内容修改（源Schema修改）
    const textDocChangeListener = vscode.workspace.onDidChangeTextDocument((e) => {
      const docUri = e.document.uri;
      if (docUri.path.endsWith(SOURCE_SCHEMA_FILE)) {
        this.scanWorkspace();
      }
    });

    // 监听5：文件/文件夹重命名
    const fileRenameListener = vscode.workspace.onDidRenameFiles((e) => {
      this.scanWorkspace();
    });

    // 监听器加入销毁队列
    this._disposables.push(workspaceFolderListener, fileCreateListener, fileDeleteListener, textDocChangeListener, fileRenameListener);
  }

  // ===================== 辅助方法：工具函数 =====================
  /** 校验文件/目录是否存在 */
  private async isFileExists(uri: vscode.Uri): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  /** 获取当前VSCode的语言（zh开头返回zh，否则返回en） */
  private getVscodeLanguage(): string {
    const lang = vscode.env.language || 'en';
    return lang.startsWith('zh') ? 'zh' : 'en';
  }

  /**
   * 生成唯一的Schema文件名（基于源Schema路径MD5）
   * 避免不同路径的源Schema转换后重名覆盖
   * @example tile-fwk-config-schema-7f9f958714771f378935f452e087695a.json
   */
  private generateUniqueSchemaFileName(sourceSchemaUri: vscode.Uri): string {
    const md5 = crypto.createHash('md5');
    const hash = md5.update(sourceSchemaUri.toString()).digest('hex');
    return `${SOURCE_SCHEMA_FILE.replace('.json', '')}-${hash}.json`;
  }

  /**
   * Schema转换映射为vscode 所需要格式
   * @param raw rawSchemaBuffer
   * @param lang 语言
   * @returns
   */
  private transformSchema(raw: any, lang: string): any {
    const isZh = lang.startsWith('zh');

    function walk(obj: any): any {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(walk);

      const result: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (key === 'label') continue;
          result[key] = walk(obj[key]);
        }
      }

      // label → description
      if (obj.label && (obj.label.zh || obj.label.en)) {
        result.description = isZh ? obj.label.zh : obj.label.en;
      }

      // 特殊处理options数组
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
    }

    return walk(raw);
  }

  // 插件销毁时，删除schemas目录
  public override dispose(): void {
    // 插件卸载时，删除转换生成的schema目录
    this.deleteTransformedSchemaFiles().catch((err) => console.warn('插件卸载删除Schema文件失败：', err));
    super.dispose();
  }
}
