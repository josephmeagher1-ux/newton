import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '';

export type PdfDocument = pdfjsLib.PDFDocumentProxy;

export async function loadPdfDocument(source: File | Blob | ArrayBuffer): Promise<PdfDocument> {
  const data = source instanceof ArrayBuffer ? source : await (source as Blob).arrayBuffer();
  const doc = await pdfjsLib.getDocument({
    data,
    disableAutoFetch: true,
    disableStream: true,
  }).promise;
  return doc;
}

export interface OutlineItem {
  title: string;
  pageIndex: number;
  children: OutlineItem[];
}

export async function extractOutline(doc: PdfDocument): Promise<OutlineItem[]> {
  const outline = await doc.getOutline();
  if (!outline || outline.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function resolveItems(items: any[]): Promise<OutlineItem[]> {
    const results: OutlineItem[] = [];
    for (const item of items) {
      let pageIndex = 0;
      if (item.dest) {
        try {
          const dest = typeof item.dest === 'string'
            ? await doc.getDestination(item.dest)
            : item.dest;
          if (dest) {
            const ref = dest[0];
            pageIndex = await doc.getPageIndex(ref);
          }
        } catch {
          // fallback to 0
        }
      }
      results.push({
        title: item.title,
        pageIndex,
        children: item.items ? await resolveItems(item.items) : [],
      });
    }
    return results;
  }

  return resolveItems(outline);
}

export async function extractPageText(doc: PdfDocument, pageNum: number): Promise<string> {
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();
  return content.items
    .filter((item) => 'str' in item)
    .map((item) => (item as { str: string }).str)
    .join(' ');
}

export async function pageHasImages(doc: PdfDocument, pageNum: number): Promise<boolean> {
  const page = await doc.getPage(pageNum);
  const ops = await page.getOperatorList();
  const imageOps = new Set([
    pdfjsLib.OPS.paintImageXObject,
    pdfjsLib.OPS.paintXObject,
    pdfjsLib.OPS.paintImageMaskXObject,
  ]);
  return ops.fnArray.some((fn: number) => imageOps.has(fn));
}

export async function renderPageToJpeg(doc: PdfDocument, pageNum: number, scale = 1.5): Promise<Blob> {
  const canvas = new OffscreenCanvas(1, 1);
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
}

export async function renderPageToCanvas(
  doc: PdfDocument,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale = 2,
): Promise<void> {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
}

export async function renderPageToPng(doc: PdfDocument, pageNum: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(1, 1);
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
  return canvas.convertToBlob({ type: 'image/png' });
}
