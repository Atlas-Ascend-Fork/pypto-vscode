import { describe, it, expect, vi } from 'vitest';
import * as vscode from 'vscode';

vi.mock('crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      digest: vi.fn().mockReturnValue('abc123'),
    }),
  }),
}));

describe('schema-config/run-config-language-features', () => {
  it('should export correct constant values', async () => {
    const mod = await import('../../../../src/services/schema-config/run-config-language-features');
    expect(mod.TARGET_CONFIG_FILE).toBe('tile_fwk_config.json');
    expect(mod.SOURCE_SCHEMA_FILE).toBe('tile_fwk_config_schema.json');
    expect(mod.PLUGIN_SCHEMA_NAME).toBe('PYPTO TOOLKIT Config Schema');
  });

  it('should export RunConfigLanguageFeaturesService class', async () => {
    const mod = await import('../../../../src/services/schema-config/run-config-language-features');
    expect(mod.RunConfigLanguageFeaturesService).toBeDefined();
    expect(typeof mod.RunConfigLanguageFeaturesService).toBe('function');
  });

  it('should create service and dispose immediately', async () => {
    vi.mocked(vscode.workspace).workspaceFolders = undefined;
    vi.mocked(vscode.workspace.fs.readDirectory).mockResolvedValue([]);
    vi.mocked(vscode.workspace.fs.stat).mockRejectedValue(new Error('not found'));
    vi.mocked(vscode.workspace.fs.delete).mockResolvedValue(undefined);
    vi.mocked(vscode.workspace.fs.createDirectory).mockResolvedValue(undefined);
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: vi.fn().mockReturnValue([]),
      update: vi.fn().mockResolvedValue(undefined),
    } as any);

    const mod = await import('../../../../src/services/schema-config/run-config-language-features');
    const ctx = { globalStorageUri: { fsPath: '/test/storage' } } as any;
    const service = new mod.RunConfigLanguageFeaturesService(ctx);
    expect(service.name).toBe('language-features');
    expect(service._disposables.length).toBeGreaterThan(0);
    service.dispose();
    expect(service._isDisposed).toBe(true);
  });
});
