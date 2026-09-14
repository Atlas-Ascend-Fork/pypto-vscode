/**
 * Copyright (c) 2025-2026 Huawei Technologies Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
export const transformIndexHtml = () => {
    return {
        name: 'html-transform',
        transformIndexHtml(html, ctx){
            if (ctx.server?.config?.env?.DEV) {
                return html;
            }
            const bundleKeys = Object.keys(ctx.bundle);
            let finalHtml = html;
            bundleKeys.forEach((item) => {
                finalHtml = finalHtml.replace(`/${item}`, `{{root}}/webview-dist/${item}`);
            });

            return finalHtml;
        }
    }
}