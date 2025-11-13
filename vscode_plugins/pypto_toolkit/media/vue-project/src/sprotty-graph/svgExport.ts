import { SModelRootImpl} from 'sprotty';
import { comGraphStore } from '../service/com-graph-store';
import cssraw from './style/diagram.css?raw';

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

function copyAttr(originElem: Element, targetElem: Element) {
    const attrList = originElem.attributes ? Array.from(originElem.attributes) : undefined;
    attrList.forEach(attr => {
        targetElem.setAttribute(attr.name, attr.value);
    });

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

        const gWidth = (g.getBoundingClientRect().width) + moreBorder;
        const gHeight = (g.getBoundingClientRect().height) + moreBorder;

        svgElementNew.setAttribute('width', gWidth?.toString());
        svgElementNew.setAttribute('height', gHeight?.toString());

        let resizeTransform = svgElementNew.querySelector('g').getAttribute('transform');
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
