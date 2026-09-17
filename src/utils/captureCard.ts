import { toPng } from 'html-to-image';

export const CAPTURE_WIDTH = 660;

export function createCardCaptureSource(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.classList.add('capture-fixed');
  const wrapper = document.createElement('div');
  wrapper.setAttribute('aria-hidden', 'true');
  wrapper.style.position = 'absolute';
  wrapper.style.top = '0';
  wrapper.style.left = '-20000px';
  wrapper.style.width = `${CAPTURE_WIDTH}px`;
  wrapper.style.pointerEvents = 'none';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);
  return clone;
}

export async function cardToPng(source: HTMLElement, pixelRatio: number): Promise<string> {
  const clone = createCardCaptureSource(source);
  try {
    return await toPng(clone, {
      pixelRatio,
      backgroundColor: '#FFFFFF'
    });
  } finally {
    clone.remove();
  }
}

export function openCardImageInNewTab(dataUrl: string, title: string): boolean {
  const w = window.open('', '_blank');
  if (!w) {
    return false;
  }
  w.document.write(
    `<!doctype html><html><head><title>${title}</title>
      <style>body{margin:0;background:#e2e8f0;display:flex;justify-content:center;align-items:flex-start;padding:16px}img{max-width:100%;height:auto}</style>
      </head><body><img src="${dataUrl}" alt="${title}"/></body></html>`
  );
  w.document.close();
  return true;
}