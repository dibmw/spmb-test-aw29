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