/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * This program is free software, you can redistribute it and/or modify it under the terms and conditions of
 * CANN Open Software License Agreement Version 2.0 (the "License").
 * Please refer to the License for details. You may not use this file except in compliance with the License.
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT, MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.
 * See LICENSE in the root of the software repository for the full text of the License.
 */
import { viewApi, viewRefs, ViewServer } from '../../core/view/view-server';
import { useService } from '../../services';
import { ConfigDataService } from '../../services/schema-config/configdata';
import { ConfigFileInfo } from '../../types/config-schema';

type Apis = 'refreshConfigList';
type Refs = {
  isScanning: boolean;
  configFiles: ConfigFileInfo[];
};

@viewRefs(['isScanning', 'configFiles'])
export class SidebarViewServer extends ViewServer<Apis, Refs> {
  private configService: ConfigDataService;

  public override created(): void {
    this.configService = useService('configData');
    // 监听文件更新
    this.configService.onDidUpdateConfigData(({ status, files }) => this.handleUpdateConfigFiles({ status, files }));
  }

  @viewApi()
  public refreshConfigList(): void {
    this.configService.scanDirectory();
  }

  private handleUpdateConfigFiles({ status, files }: { status: string; files: ConfigFileInfo[] }) {
    this.setRef('isScanning', status !== 'completed');
    this.setRef('configFiles', files);
  }
}
