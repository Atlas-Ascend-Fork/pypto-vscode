import { SModelRootImpl} from 'sprotty';
import { comGraphStore } from '../service/com-graph-store';

const moreBorder = 50;

function downloadSvgFile(svgString: string, fileName: string = 'diagram.svg') {
    const blob = new Blob([svgString], {type: 'image/svf+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    (window as any).ascEventBus.emit(`svgExportingOver`);
}

function copyStyles(originElem: Element, targetElem: Element, skippedProperties: string[]) {
    const originElemStyle = getComputedStyle(originElem);
    const targetElemStyle = getComputedStyle(targetElem);
    let difference = '';
    for (let i = 0; i < originElemStyle.length; i++) {
        const key = originElemStyle[i];
        if (skippedProperties.indexOf(key) === -1) {
            const value = originElemStyle.getPropertyValue(key);
            if (targetElem.id === 'sprotty_root' && key === 'block-size') {
                continue;
            }
            if (targetElemStyle.getPropertyValue(key) !== value) {
                difference += key + ':' + value + ';';
            }
        }
    }
    if (difference !== '')
        targetElem.setAttribute('style', difference);
    for (let i = 0; i < originElem.childNodes.length; ++i) {
        const originElemChild = originElem.childNodes[i];
        const targetElemChild = targetElem.childNodes[i];
        if (originElemChild instanceof Element)
            copyStyles(originElemChild, targetElemChild as Element, []);
    }
}

function createDocMid(iframeMid: HTMLIFrameElement): Document {
    document.body.appendChild(iframeMid);
    if (!iframeMid.contentWindow) {
        throw new Error('IFrame has no contentWindow');
    }
    return iframeMid.contentWindow.document;
}

export function createSvg(svgElementOrig: SVGSVGElement, skipCopyStyles?: boolean) {
    const svgTheme = document.body?.dataset?.vscodeThemeId;

    const midSerializer = new XMLSerializer();
    const svgMid = midSerializer.serializeToString(svgElementOrig);
    const iframeMid: HTMLIFrameElement = document.createElement('iframe');
    const docMid = createDocMid(iframeMid);
    docMid.open();
    docMid.write(svgMid);
    docMid.close();
    const svgElementNew = docMid.querySelector('svg')!;

    svgElementNew.removeAttribute('opacity');
    if (skipCopyStyles === false) {
        const g = svgElementNew.querySelector('g');

        const gWidth = (g.getBoundingClientRect().width) + moreBorder;
        const gHeight = (g.getBoundingClientRect().height) + moreBorder;

        svgElementNew.setAttribute('width', gWidth?.toString());
        svgElementNew.setAttribute('height', gHeight?.toString());

        let resizeTransform = svgElementNew.querySelector('g').getAttribute('transform');
        resizeTransform = resizeTransform.replace(/translate\([^)]*\)/g, 'translate(0, 0)');
        svgElementNew.querySelector('g').setAttribute('transform', resizeTransform);

        copyStyles(svgElementOrig, svgElementNew, ['width', 'height', 'opacity', 'inline-size']);

        let gStyle = svgElementNew.querySelector('g').getAttribute('style');
        gStyle = gStyle.replace(/transform:[^;]*;?/g, '');
        svgElementNew.querySelector('g').setAttribute('style', gStyle);

        const parentNode = svgElementNew.querySelector('g');
        parentNode.querySelectorAll('g[id*="operation"] image').forEach(img => img.remove());
        const newBackground = svgTheme?.toLowerCase()?.includes('dark') ? 'black' : undefined;
        if (newBackground) {
            let svgElementNewStyle = svgElementNew.getAttribute('style');
            svgElementNewStyle += `background:${newBackground}`
            svgElementNew.setAttribute('style', svgElementNewStyle);
        }

        parentNode.querySelectorAll('image')?.forEach(g_image => g_image.remove());

    }

    const svgCode = midSerializer.serializeToString(svgElementNew);
    document.body.removeChild(iframeMid);

    const data = comGraphStore.data?.jsonData;
    const originFileName = (data as any).func_magicname;
    const fileName = `${originFileName}.svg`;
    downloadSvgFile(svgCode, fileName);
}