import { SModelRootImpl} from 'sprotty';
import { comGraphStore } from '../service/com-graph-store';
import cssraw from './style/diagram.css?raw';
import { resolve } from 'path';
import { reject } from 'lodash';

const moreBorder = 200;
let xBoundary = 0;
let yBoundary = 0;

function svg2Base64(svgBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = btoa(reader.result as string);
            resolve(`data:image/svg+xml;base64,${base64}`);
        };
        reader.onerror = reject;
        reader.readAsBinaryString(svgBlob);
    });
}

async function downloadSvgFile(svgString: string, fileName: string = 'diagram.svg') {
    xBoundary = 0;
    yBoundary = 0;
    const blob = new Blob([svgString], {type: 'image/svf+xml' });
    const svgBase64 = await svg2Base64(blob);
    (window as any).ascEventBus.emit(`svgBase64`, {svgString: svgBase64, fileName: fileName});
    (window as any).ascEventBus.emit(`svgExportingOver`);
}

function copyAttr(originElem: Element, targetElem: Element) {
    const attrList = originElem.attributes ? Array.from(originElem.attributes) : undefined;
    attrList.forEach(attr => {
        targetElem.setAttribute(attr.name, attr.value);
    });

    const isTarget = originElem.tagName === 'g';
    if (isTarget) {
        const originViewInfo = originElem.getBoundingClientRect();
        const originTranslate = originElem.getAttribute('transform')?.match(/-?\d+(?:\.\d+)?/g);

        if (originTranslate) {
            const [xBlankOffset, yBlankOffset] = [originTranslate.at(-2), originTranslate.at(-1)];
            xBoundary = Math.max(Number(xBlankOffset) + originViewInfo.width, xBoundary);
            yBoundary = Math.max(Number(yBlankOffset) + originViewInfo.height, yBoundary);
        }
    }

    for (let i = 0; i < originElem.childNodes.length; ++i) {
        const originElemChild = originElem.childNodes[i];
        const targetElemChild = targetElem.childNodes[i];
        if (originElemChild instanceof Element)
            copyAttr(originElemChild, targetElemChild as Element);
    }
}

async function addStyles(targetElem: Element)  {
    let newStyle = document.createElement('style');
    newStyle.textContent = document.querySelector('#devuiThemeVariables').textContent;
    targetElem.insertBefore(newStyle, targetElem.firstChild);

    let secStyle = document.createElement('style');
    secStyle.textContent = copyCss();
    targetElem.insertBefore(secStyle, targetElem.firstChild);
}

function createDocMid(iframeMid: HTMLIFrameElement): Document {
    document.body.appendChild(iframeMid);
    if (!iframeMid.contentWindow) {
        throw new Error('IFrame has no contentWindow');
    }
    return iframeMid.contentWindow.document;
}

export function createSvg(svgElementOrig: SVGSVGElement, skipCopyStyles?: boolean) {
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

        copyAttr(svgElementOrig, svgElementNew);

        addStyles(svgElementNew);

        const g = svgElementNew.querySelector('g');
        const width = xBoundary + moreBorder;
        const height = yBoundary + moreBorder;
        svgElementNew.setAttribute('width', width?.toString());
        svgElementNew.setAttribute('height', height?.toString());

        let resizeTransform = g.getAttribute('transform');
        resizeTransform = resizeTransform.replace(/translate\([^)]*\)/g, 'translate(0, 0)');
        svgElementNew.querySelector('g').setAttribute('transform', resizeTransform);

        const parentNode = svgElementNew.querySelector('g');
        parentNode.querySelectorAll('g[id*="operation"] image').forEach(img => img.remove());

        let svgElementNewStyle = svgElementNew?.getAttribute('style') || '';
        svgElementNewStyle += `background:var(--devui-global-bg)`
        svgElementNew.setAttribute('style', svgElementNewStyle);

        parentNode.querySelectorAll('image')?.forEach(g_image => g_image.remove());
    }

    const svgCode = midSerializer.serializeToString(svgElementNew);
    document.body.removeChild(iframeMid);

    const data = comGraphStore.data?.jsonData;
    const originFileName = (data as any).func_magicname;
    const fileName = `${originFileName}.svg`;
    downloadSvgFile(svgCode, fileName);
}


function copyCss(): string {
    let rawStr = '\n\n' + cssraw + '\n';
    rawStr = rawStr.replace(/svg\.sprotty-graph\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '');

    return rawStr;
 }
