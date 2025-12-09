import { viewRefs, ViewServer } from '../../core/view/view-server';
import { useService } from '../../services';
import { ConfigFileInfo } from '../../types/config-schema';

type Apis = never;
type Refs = {
  isScanning: boolean;
  configFiles: ConfigFileInfo[];
};

@viewRefs(['isScanning', 'configFiles'])
export class SidebarViewServer extends ViewServer<Apis, Refs> {
  public override created(): void {
    const configService = useService('configData');
    // 监听文件更新
    configService.onDidUpdateConfigData(({ status, files }) => this.handleUpdateConfigFiles({ status, files }));
  }

  private handleUpdateConfigFiles({ status, files }: { status: string; files: ConfigFileInfo[] }) {
    this.setRef('isScanning', status !== 'completed');
    this.setRef('configFiles', files);
  }
}
