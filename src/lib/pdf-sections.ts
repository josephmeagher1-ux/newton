import { extractPageText, type OutlineItem, type PdfDocument } from './pdf';
import { getDb, generateId } from '../storage/db';

export interface ParsedSection {
  id: string;
  pdfId: string;
  heading: string;
  pageStart: number;
  pageEnd: number;
  estimatedMinutes: number;
  orderIndex: number;
}

export async function buildSectionsFromOutline(
  doc: PdfDocument,
  pdfId: string,
  outline: OutlineItem[],
): Promise<ParsedSection[]> {
  const totalPages = doc.numPages;
  const flat = flattenOutline(outline, totalPages);

  const db = await getDb();
  const sections: ParsedSection[] = [];

  for (let i = 0; i < flat.length; i++) {
    const item = flat[i]!;
    const next = flat[i + 1];
    const pageEnd = next ? next.pageStart - 1 : totalPages;
    const pageCount = Math.max(1, pageEnd - item.pageStart + 1);

    const section: ParsedSection = {
      id: generateId(),
      pdfId,
      heading: item.heading,
      pageStart: item.pageStart,
      pageEnd,
      estimatedMinutes: Math.max(15, Math.round(pageCount * 8)),
      orderIndex: i,
    };

    await db.put('sections', section);
    sections.push(section);
  }

  return sections;
}

function flattenOutline(
  items: OutlineItem[],
  _totalPages: number,
  depth = 0,
): { heading: string; pageStart: number; depth: number }[] {
  const result: { heading: string; pageStart: number; depth: number }[] = [];

  for (const item of items) {
    const prefix = depth === 0 ? '' : '  '.repeat(depth);
    result.push({
      heading: `${prefix}${item.title}`,
      pageStart: item.pageIndex + 1,
      depth,
    });

    if (item.children.length > 0) {
      result.push(...flattenOutline(item.children, _totalPages, depth + 1));
    }
  }

  return result;
}

export async function extractSectionText(
  doc: PdfDocument,
  pdfId: string,
  section: ParsedSection,
): Promise<string> {
  const db = await getDb();
  const pages: string[] = [];

  for (let p = section.pageStart; p <= section.pageEnd; p++) {
    const cacheKey = `${pdfId}:${p}`;
    const cached = await db.get('pdf_pages', cacheKey);

    if (cached) {
      pages.push(cached.text);
    } else {
      const text = await extractPageText(doc, p);
      await db.put('pdf_pages', {
        id: cacheKey,
        pdfId,
        pageNum: p,
        text,
        extractedAt: Date.now(),
      });
      pages.push(text);
    }
  }

  return pages.join('\n\n--- Page Break ---\n\n');
}

export async function getSectionsForPdf(pdfId: string): Promise<ParsedSection[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('sections', 'by-pdf', pdfId);
  return all.sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function extractIndexText(doc: PdfDocument, pdfId: string, maxPages = 50): Promise<string> {
  const pages: string[] = [];
  const limit = Math.min(maxPages, doc.numPages);
  const db = await getDb();

  for (let p = 1; p <= limit; p++) {
    const cacheKey = `${pdfId}:${p}`;
    const cached = await db.get('pdf_pages', cacheKey);

    if (cached) {
      pages.push(cached.text);
    } else {
      const text = await extractPageText(doc, p);
      await db.put('pdf_pages', {
        id: cacheKey,
        pdfId,
        pageNum: p,
        text,
        extractedAt: Date.now(),
      });
      pages.push(text);
    }
  }

  return pages.join('\n\n');
}
