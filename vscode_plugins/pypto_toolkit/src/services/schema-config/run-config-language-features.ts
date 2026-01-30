import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { BasicService } from '../basic-service';

// 常量定义
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
  // 配置-Schema映射缓存，记录已注册的配置文件关联信息
  private _configSchemaMap: ConfigSchemaMap[] = [];
  // 扫描状态
  private _scanStatus: ScanStatus = 'idle';
  // 服务销毁标记，防止销毁后执行异步逻辑
  private _isDisposed = false;
  // 扫描忽略目录，跳过无需检测的工程目录
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
  // 插件上下文，用于获取全局存储目录
  private readonly _context: vscode.ExtensionContext;
  // 扫描防抖定时器，避免频繁触发扫描
  private _scanDebounceTimer: NodeJS.Timeout | null = null;

  constructor(context: vscode.ExtensionContext) {
    super('language-features');
    this._context = context;
    this.scanWorkspace();
    this.registerWorkspaceListeners();
  }

  // 扫描工作区 - 防抖处理，默认300ms延迟
  public scanWorkspace(delay: number = 300): void {
    if (this._isDisposed) {
      return;
    }
    if (this._scanDebounceTimer) {
      clearTimeout(this._scanDebounceTimer);
    }
    this._scanDebounceTimer = setTimeout(async () => {
      await this._doScanWorkspace();
      this._scanDebounceTimer = null;
    }, delay);
  }

  // 执行扫描逻辑 - 广度优先遍历工作区，边扫描边注册Schema
  public async _doScanWorkspace(): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    // 扫描前清空旧的Schema注册和本地缓存
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
        if (this._isDisposed) {
          break;
        }

        const rootUri = workspaceFolder.uri;
        const workspaceName = workspaceFolder.name;
        const queue: vscode.Uri[] = [rootUri];
        const scannedDirs = new Set<string>([rootUri.toString()]);

        while (queue.length > 0 && this._scanStatus === 'scanning' && !this._isDisposed) {
          const currentDirUri = queue.shift()!;
          try {
            const entries = await vscode.workspace.fs.readDirectory(currentDirUri);
            for (const [entryName, entryType] of entries) {
              if (this._isDisposed) {
                break;
              }
              const entryUri = vscode.Uri.joinPath(currentDirUri, entryName);
              const entryUriStr = entryUri.toString();

              // 跳过忽略目录和已扫描目录，避免重复处理
              if (entryType === vscode.FileType.Directory) {
                if (this.ignoreDirs.has(entryName) || scannedDirs.has(entryUriStr)) {
                  continue;
                }
                scannedDirs.add(entryUriStr);
                queue.push(entryUri);
                continue;
              }

              // 找到目标配置文件，校验同级是否存在Schema源文件
              if (entryType === vscode.FileType.File && entryName === TARGET_CONFIG_FILE) {
                if (scannedUris.has(entryUriStr)) {
                  continue;
                }
                scannedUris.add(entryUriStr);

                const sourceSchemaUri = vscode.Uri.joinPath(currentDirUri, SOURCE_SCHEMA_FILE);
                if (await this.isFileExists(sourceSchemaUri)) {
                  const transformedSchemaUri = await this.transformAndSaveSchema(sourceSchemaUri);
                  if (transformedSchemaUri && !this._isDisposed) {
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
            // 忽略取消操作的异常，仅打印其他扫描错误
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

  // 清空所有旧配置 - 清理磁盘转换文件和settings中的Schema注册
  private async clearAllPluginSchemas(): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    await this.deleteTransformedSchemaFiles();

    const jsonConfig = vscode.workspace.getConfiguration('json');
    const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
    const remainingSchemas = currentSchemas.filter((s) => {
      return s.name !== PLUGIN_SCHEMA_NAME;
    });

    if (remainingSchemas.length !== currentSchemas.length) {
      await jsonConfig.update('schemas', remainingSchemas, vscode.ConfigurationTarget.Workspace, true);
    }
  }

  // 删除globalStorage下的旧Schema转换文件，避免文件堆积
  private async deleteTransformedSchemaFiles(): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    try {
      const schemaDirUri = vscode.Uri.joinPath(this._context.globalStorageUri, TRANSFORMED_SCHEMA_DIR);
      if (await this.isFileExists(schemaDirUri)) {
        const entries = await vscode.workspace.fs.readDirectory(schemaDirUri);
        for (const [entryName, entryType] of entries) {
          if (this._isDisposed) {
            break;
          }
          if (entryType === vscode.FileType.File) {
            // 仅删除插件生成的Schema转换文件
            if (entryName.startsWith(`${SOURCE_SCHEMA_FILE.replace('.json', '')}-`) && entryName.endsWith('.json')) {
              const fileUri = vscode.Uri.joinPath(schemaDirUri, entryName);
              await vscode.workspace.fs.delete(fileUri);
            }
          }
        }
      }
      // 确保Schema目录存在，避免后续写入失败
      await vscode.workspace.fs.createDirectory(schemaDirUri);
    } catch (error: any) {
      const isCanceled = error.message?.includes('Canceled') || error.code === 'Canceled';
      if (!isCanceled && !this._isDisposed) {
        console.error(`处理Schema目录失败：`, error);
      }
    }
  }

  // 批量注册Schema - 备用方法，防止单独注册异常时的兜底
  private async batchRegisterSchemas(): Promise<void> {
    if (this._isDisposed || this._configSchemaMap.length === 0) {
      return;
    }
    const jsonConfig = vscode.workspace.getConfiguration('json');
    const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
    const newSchemaItems = this._configSchemaMap.map((item) => {
      return {
        fileMatch: [item.configUri.path.toString()],
        url: item.transformedSchemaUri.toString(),
        name: PLUGIN_SCHEMA_NAME,
      };
    });
    await jsonConfig.update('schemas', [...currentSchemas, ...newSchemaItems], vscode.ConfigurationTarget.Workspace, true);
  }

  // 转换源Schema文件并写入globalStorage，返回转换后的文件URI
  private async transformAndSaveSchema(sourceSchemaUri: vscode.Uri): Promise<vscode.Uri | undefined> {
    if (this._isDisposed) {
      return undefined;
    }
    try {
      // 生成新文件前，先清理该源Schema对应的所有旧转换文件
      await this.clearOldTransformedFiles(sourceSchemaUri);

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

  // 目录URI去重，避免重复处理同一目录
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

  // 校验目录下是否有合法的Config-Schema文件对，返回映射信息
  private async getValidConfigSchemaMap(dirUri: vscode.Uri, workspaceName: string): Promise<ConfigSchemaMap | null> {
    if (this._isDisposed) {
      return null;
    }
    try {
      const configUri = vscode.Uri.joinPath(dirUri, TARGET_CONFIG_FILE);
      const sourceSchemaUri = vscode.Uri.joinPath(dirUri, SOURCE_SCHEMA_FILE);
      if ((await this.isFileExists(configUri)) && (await this.isFileExists(sourceSchemaUri))) {
        const transformedUri = await this.transformAndSaveSchema(sourceSchemaUri);
        if (transformedUri) {
          return {
            configUri,
            sourceSchemaUri,
            transformedSchemaUri: transformedUri,
            workspaceName,
          };
        }
      }
      return null;
    } catch (error) {
      console.warn(`校验目录配对失败：${dirUri.fsPath}`, error);
      return null;
    }
  }

  // 根据配置文件URI删除对应注册：清理磁盘文件、本地缓存、settings配置
  private async removeSchemaByConfigUri(configUri: vscode.Uri): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    try {
      const targetItem = this._configSchemaMap.find((item) => {
        return item.configUri.toString() === configUri.toString();
      });
      if (targetItem) {
        // 磁盘文件删除单独捕获异常，避免文件不存在阻断后续流程
        if (await this.isFileExists(targetItem.transformedSchemaUri)) {
          try {
            await vscode.workspace.fs.delete(targetItem.transformedSchemaUri);
          } catch (fileErr) {
            console.warn(`清理转换Schema文件失败：${targetItem.transformedSchemaUri.fsPath}`, fileErr);
          }
        }
        // 同步清理本地缓存，保证缓存与实际一致
        this._configSchemaMap = this._configSchemaMap.filter((item) => {
          return item.configUri.toString() !== configUri.toString();
        });
      }

      // 删除settings中的对应Schema注册
      const jsonConfig = vscode.workspace.getConfiguration('json');
      const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
      const updatedSchemas = currentSchemas.filter((s) => {
        return s.name !== PLUGIN_SCHEMA_NAME || !s.fileMatch.includes(configUri.path.toString());
      });
      if (updatedSchemas.length !== currentSchemas.length) {
        await jsonConfig.update('schemas', updatedSchemas, vscode.ConfigurationTarget.Workspace, true);
      }
    } catch (error) {
      console.warn(`删除Schema注册异常：${configUri.fsPath}`, error);
    }
  }

  // 单个Schema注册 - 写入settings并同步更新本地缓存，防止重复注册
  private async addSingleSchema(schemaMap: ConfigSchemaMap): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    try {
      // 先清理同目录旧缓存，避免重复
      this._configSchemaMap = this._configSchemaMap.filter((item) => {
        return item.configUri.path !== schemaMap.configUri.path;
      });

      // 同步更新本地缓存
      this._configSchemaMap.push(schemaMap);
      const jsonConfig = vscode.workspace.getConfiguration('json');
      const currentSchemas = jsonConfig.get<any[]>('schemas') || [];
      // 清理settings中同目录旧配置，保证配置唯一
      const cleanSchemas = currentSchemas.filter((s) => {
        return s.name !== PLUGIN_SCHEMA_NAME || !s.fileMatch.includes(schemaMap.configUri.path.toString());
      });
      // 新注册的url是唯一的（带时间戳）
      const newSchemaItem = {
        fileMatch: [schemaMap.configUri.path.toString()],
        url: schemaMap.transformedSchemaUri.toString(),
        name: PLUGIN_SCHEMA_NAME,
      };
      await jsonConfig.update('schemas', [...cleanSchemas, newSchemaItem], vscode.ConfigurationTarget.Workspace, true);
    } catch (error) {
      console.warn(`新增Schema注册失败：${schemaMap.configUri.fsPath}`, error);
    }
  }

  // 递归遍历目录 - 收集所有目标文件URI，仅用于创建/重命名监听
  private async collectTargetFilesInDir(dirUri: vscode.Uri): Promise<vscode.Uri[]> {
    const targetFiles: vscode.Uri[] = [];
    if (this._isDisposed) {
      return targetFiles;
    }

    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);
      for (const [entryName, entryType] of entries) {
        if (this._isDisposed) {
          break;
        }
        const entryUri = vscode.Uri.joinPath(dirUri, entryName);

        if (entryType === vscode.FileType.File) {
          if (entryName === TARGET_CONFIG_FILE || entryName === SOURCE_SCHEMA_FILE) {
            targetFiles.push(entryUri);
          }
        } else if (entryType === vscode.FileType.Directory && !this.ignoreDirs.has(entryName)) {
          const subTargetFiles = await this.collectTargetFilesInDir(entryUri);
          targetFiles.push(...subTargetFiles);
        }
      }
    } catch (error) {
      console.warn(`遍历目录失败：${dirUri.fsPath}`, error);
    }

    return targetFiles;
  }

  // 注册工作区所有监听
  private registerWorkspaceListeners(): void {
    // 1. 工作区增删监听
    const workspaceFolderListener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (!this._isDisposed) {
        this.scanWorkspace();
      }
    });

    // 2. 文件/文件夹创建监听
    const fileCreateListener = vscode.workspace.onDidCreateFiles(async (e) => {
      if (this._isDisposed) {
        return;
      }

      const allTargetFiles: vscode.Uri[] = [];
      for (const uri of e.files) {
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type === vscode.FileType.File) {
            if (uri.path.endsWith(TARGET_CONFIG_FILE) || uri.path.endsWith(SOURCE_SCHEMA_FILE)) {
              allTargetFiles.push(uri);
            }
          } else if (stat.type === vscode.FileType.Directory) {
            const dirTargetFiles = await this.collectTargetFilesInDir(uri);
            allTargetFiles.push(...dirTargetFiles);
          }
        } catch (error) {
          console.warn(`获取创建资源状态失败：${uri.fsPath}`, error);
          continue;
        }
      }

      if (allTargetFiles.length === 0) {
        return;
      }
      const targetDirs = this.uniqueDirUris(
        allTargetFiles.map((uri) => {
          return vscode.Uri.joinPath(uri, '..');
        }),
      );
      const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'default';
      for (const dirUri of targetDirs) {
        if (this._isDisposed) {
          break;
        }
        const validMap = await this.getValidConfigSchemaMap(dirUri, workspaceName);
        if (validMap) {
          await this.addSingleSchema(validMap);
        }
      }
    });

    // 3. 文件/文件夹删除监听 - 基于缓存筛选，不访问文件系统
    const fileDeleteListener = vscode.workspace.onDidDeleteFiles(async (e) => {
      if (this._isDisposed || this._configSchemaMap.length === 0) {
        return;
      }

      // 遍历所有删除的资源，提取需要检查的目录（文件取上级，文件夹直接用）
      const checkDirUris: vscode.Uri[] = [];
      for (const delUri of e.files) {
        try {
          // 判断是文件还是文件夹：文件→取上级目录，文件夹→直接用自身
          const isFile = delUri.path.endsWith(TARGET_CONFIG_FILE) || delUri.path.endsWith(SOURCE_SCHEMA_FILE);
          const targetDirUri = isFile ? vscode.Uri.joinPath(delUri, '..') : delUri;
          checkDirUris.push(targetDirUri);
        } catch (error) {
          console.warn(`处理删除资源路径失败：${delUri.fsPath}`, error);
          continue;
        }
      }

      if (checkDirUris.length === 0) {
        return;
      }
      // 从缓存中筛选出所有被删除目录下的注册记录（路径包含匹配）
      const needDeleteSchemaMaps = this._configSchemaMap.filter((schemaMap) => {
        return checkDirUris.some((checkDir) => {
          // 注册的配置文件路径 包含 被删除的目录路径
          return schemaMap.configUri.path.includes(checkDir.path);
        });
      });

      if (needDeleteSchemaMaps.length === 0) {
        return;
      }
      // 遍历删除匹配的注册（同步清理缓存+settings+磁盘文件）
      for (const schemaMap of needDeleteSchemaMaps) {
        if (this._isDisposed) {
          break;
        }
        await this.removeSchemaByConfigUri(schemaMap.configUri);
      }
    });

    // 4. 文件/文件夹重命名监听 - 兼容单个文件+文件夹重命名
    const fileRenameListener = vscode.workspace.onDidRenameFiles(async (e) => {
      if (this._isDisposed) {
        return;
      }

      const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'default';
      for (const renameItem of e.files) {
        try {
          const { oldUri, newUri } = renameItem;
          // 第一步：删除旧资源关联的注册（基于缓存，不访问旧文件系统）
          const oldIsFile = oldUri.path.endsWith(TARGET_CONFIG_FILE) || oldUri.path.endsWith(SOURCE_SCHEMA_FILE);
          const oldCheckDir = oldIsFile ? vscode.Uri.joinPath(oldUri, '..') : oldUri;
          const oldNeedDelete = this._configSchemaMap.filter((schemaMap) => {
            return schemaMap.configUri.path.includes(oldCheckDir.path);
          });
          for (const schemaMap of oldNeedDelete) {
            if (this._isDisposed) {
              break;
            }
            await this.removeSchemaByConfigUri(schemaMap.configUri);
          }

          // 第二步：处理新资源（文件系统存在，可正常遍历/stat）
          let newTargetFiles: vscode.Uri[] = [];
          const newStat = await vscode.workspace.fs.stat(newUri);
          if (newStat.type === vscode.FileType.File) {
            if (newUri.path.endsWith(TARGET_CONFIG_FILE) || newUri.path.endsWith(SOURCE_SCHEMA_FILE)) {
              newTargetFiles.push(newUri);
            }
          } else if (newStat.type === vscode.FileType.Directory) {
            newTargetFiles = await this.collectTargetFilesInDir(newUri);
          }

          // 注册新资源的配置
          if (newTargetFiles.length > 0) {
            const newTargetDirs = this.uniqueDirUris(
              newTargetFiles.map((uri) => {
                return vscode.Uri.joinPath(uri, '..');
              }),
            );
            for (const dirUri of newTargetDirs) {
              if (this._isDisposed) {
                break;
              }
              const validMap = await this.getValidConfigSchemaMap(dirUri, workspaceName);
              if (validMap) {
                await this.addSingleSchema(validMap);
              }
            }
          }
        } catch (error) {
          console.warn(`处理重命名失败：${renameItem.oldUri.fsPath} → ${renameItem.newUri.fsPath}`, error);
          continue;
        }
      }
    });

    // 所有监听器加入销毁队列
    this._disposables.push(workspaceFolderListener, fileCreateListener, fileDeleteListener, fileRenameListener);
  }

  // 校验文件/目录是否存在
  private async isFileExists(uri: vscode.Uri): Promise<boolean> {
    if (this._isDisposed) {
      return false;
    }
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  // 获取VSCode当前语言
  private getVscodeLanguage(): string {
    const lang = vscode.env.language || 'en';
    return lang.startsWith('zh') ? 'zh' : 'en';
  }

  // 生成唯一Schema文件名 - MD5源文件路径做唯一标识
  private generateUniqueSchemaFileName(sourceSchemaUri: vscode.Uri): string {
    const md5 = crypto.createHash('md5');
    // MD5源文件路径，保证同路径文件的旧转换文件有统一前缀
    const pathHash = md5.update(sourceSchemaUri.toString()).digest('hex');
    // 毫秒时间戳，保证每次生成的文件名/URI唯一
    const timestamp = Date.now();
    // 文件名格式：前缀-路径MD5-时间戳.json
    return `${SOURCE_SCHEMA_FILE.replace('.json', '')}-${pathHash}-${timestamp}.json`;
  }

  // 清理指定源Schema对应的所有旧转换文件（按路径MD5前缀匹配）
  private async clearOldTransformedFiles(sourceSchemaUri: vscode.Uri): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    try {
      const md5 = crypto.createHash('md5');
      const pathHash = md5.update(sourceSchemaUri.toString()).digest('hex');
      const schemaDirUri = vscode.Uri.joinPath(this._context.globalStorageUri, TRANSFORMED_SCHEMA_DIR);
      const filePrefix = `${SOURCE_SCHEMA_FILE.replace('.json', '')}-${pathHash}-`;

      if (await this.isFileExists(schemaDirUri)) {
        const entries = await vscode.workspace.fs.readDirectory(schemaDirUri);
        for (const [entryName, entryType] of entries) {
          if (this._isDisposed) {
            break;
          }
          // 匹配当前源Schema的旧转换文件前缀
          if (entryType === vscode.FileType.File && entryName.startsWith(filePrefix) && entryName.endsWith('.json')) {
            const oldFileUri = vscode.Uri.joinPath(schemaDirUri, entryName);
            await vscode.workspace.fs.delete(oldFileUri);
          }
        }
      }
    } catch (error) {
      console.warn('清理旧Schema转换文件失败：', error);
    }
  }

  // Schema格式转换 - label转多语言description，适配VSCode提示
  private transformSchema(rawSchema: any, lang: string): any {
    const isZh = lang === 'zh';
    const walk = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(walk);
      }

      const result: Record<string, any> = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (key === 'label') {
            continue;
          }
          result[key] = walk(obj[key]);
        }
      }

      if (obj.label && (obj.label.zh || obj.label.en)) {
        result.description = isZh ? obj.label.zh : obj.label.en;
      }

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

  // 销毁服务 - 清理资源，防止内存泄漏
  public override dispose(): void {
    this._isDisposed = true;
    if (this._scanDebounceTimer) {
      clearTimeout(this._scanDebounceTimer);
    }

    this.deleteTransformedSchemaFiles().catch((err) => {
      const isCanceled = err.message?.includes('Canceled') || err.code === 'Canceled';
      if (!isCanceled) {
        console.warn('插件销毁时删除文件失败：', err);
      }
    });
    super.dispose();
  }
}
