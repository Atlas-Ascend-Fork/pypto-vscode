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