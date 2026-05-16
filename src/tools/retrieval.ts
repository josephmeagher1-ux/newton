import { registerTool, type ToolResult } from './registry';
import { listPdfs, getPdf } from '../storage/pdf-store';
import { getSectionsForPdf, extractSectionContent } from '../lib/pdf-sections';
import { loadPdfDocument, extractPageText, pageHasImages, renderPageToJpeg } from '../lib/pdf';
import { searchCorpus, hasIndex, buildIndexForPdf } from '../lib/search-index';
import { getDb } from '../storage/db';

registerTool({
  name: 'list_sources',
  description: 'List all PDF sources in the library with metadata (type, year, authority, tier). Returns sources sorted by tier (newest authoritative first). Tier 1 = current guideline, Tier 2 = current handbook, Tier 3 = older reference.',
  risk: 'read',
  parameters: { type: 'object', properties: {} },
  async execute(): Promise<ToolResult> {
    const all = await listPdfs();
    const sorted = [...all].sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      return (b.publicationYear ?? 0) - (a.publicationYear ?? 0);
    });
    const compact = sorted.map(p => ({
      id: p.id,
      name: p.name,
      type: p.sourceType,
      year: p.publicationYear,
      authority: p.authority,
      tier: p.tier,
      pages: p.pageCount,
    }));
    return { ok: true, content: JSON.stringify(compact) };
  },
});

registerTool({
  name: 'get_toc',
  description: 'Get the table of contents (section list) for a specific PDF source. Returns section headings, page ranges, and section IDs. Use this to find which section to read in detail.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      sourceId: { type: 'string', description: 'PDF source ID from list_sources' },
    },
    required: ['sourceId'],
  },
  async execute(args): Promise<ToolResult> {
    const sourceId = args.sourceId as string;
    const sections = await getSectionsForPdf(sourceId);
    const toc = sections.map(s => ({
      id: s.id,
      heading: s.heading.trimStart(),
      pageStart: s.pageStart,
      pageEnd: s.pageEnd,
    }));
    return { ok: true, content: JSON.stringify(toc) };
  },
});

registerTool({
  name: 'search_corpus',
  description: 'Search across PDF sources using BM25 keyword matching with medical synonym expansion. Results are ranked by relevance × source tier × recency. Use this BEFORE deciding which sections to read in full. If results are sparse, rephrase the query with medical synonyms (e.g. "myocardial infarction" instead of "MI") and search again.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query. Medical abbreviations are auto-expanded.' },
      sourceIds: { type: 'array', items: { type: 'string' }, description: 'Optional: restrict to specific source IDs' },
      topK: { type: 'number', description: 'Max results (default 8)' },
      minTier: { type: 'number', description: 'Only include sources with tier ≤ this (1=guidelines only, 2=handbooks too, 3=all). Default 3.' },
    },
    required: ['query'],
  },
  async execute(args): Promise<ToolResult> {
    const query = args.query as string;
    const sourceIds = args.sourceIds as string[] | undefined;
    const topK = (args.topK as number) ?? 8;
    const minTier = (args.minTier as 1 | 2 | 3) ?? 3;

    // Build indexes for any source that doesn't have one yet
    const pdfs = sourceIds
      ? (await Promise.all(sourceIds.map(id => getPdf(id)))).filter(Boolean)
      : await listPdfs();
    for (const pdf of pdfs) {
      if (!pdf) continue;
      if (!(await hasIndex(pdf.id))) {
        try { await buildIndexForPdf(pdf.id); } catch { /* skip on failure */ }
      }
    }

    const hits = await searchCorpus({ query, sourceIds, topK, minTier });
    if (hits.length === 0) {
      return { ok: true, content: JSON.stringify({ hits: [], suggestion: 'No results. Try rephrasing with full medical terms or expanding the query.' }) };
    }
    return { ok: true, content: JSON.stringify({ hits }) };
  },
});

registerTool({
  name: 'read_section',
  description: 'Read the full text of a specific section from a PDF. Returns section text plus a list of pages that contain figures/diagrams (use get_page_image to fetch them).',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      sourceId: { type: 'string', description: 'PDF source ID' },
      sectionId: { type: 'string', description: 'Section ID from get_toc' },
    },
    required: ['sourceId', 'sectionId'],
  },
  async execute(args): Promise<ToolResult> {
    const sourceId = args.sourceId as string;
    const sectionId = args.sectionId as string;
    const sections = await getSectionsForPdf(sourceId);
    const section = sections.find(s => s.id === sectionId);
    if (!section) return { ok: false, content: 'Section not found' };

    const pdf = await getPdf(sourceId);
    if (!pdf) return { ok: false, content: 'Source not found' };

    const doc = await loadPdfDocument(pdf.blob);
    const pages = await extractSectionContent(doc, sourceId, section);
    doc.destroy();

    const text = pages.map(p => p.text).join('\n\n--- Page Break ---\n\n');
    const figurePages = pages.filter(p => p.hasImages).map(p => p.pageNum);
    return {
      ok: true,
      content: JSON.stringify({
        heading: section.heading.trimStart(),
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        text: text.slice(0, 25000),
        figurePages,
      }),
    };
  },
});

registerTool({
  name: 'read_pages',
  description: 'Read text from a specific page range in a PDF. Use this when section boundaries do not match what you need. Max 20 pages per call.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      sourceId: { type: 'string' },
      start: { type: 'number', description: 'First page (1-indexed)' },
      end: { type: 'number', description: 'Last page (inclusive)' },
    },
    required: ['sourceId', 'start', 'end'],
  },
  async execute(args): Promise<ToolResult> {
    const sourceId = args.sourceId as string;
    const start = args.start as number;
    const end = Math.min(args.end as number, start + 19);
    const pdf = await getPdf(sourceId);
    if (!pdf) return { ok: false, content: 'Source not found' };

    const db = await getDb();
    const doc = await loadPdfDocument(pdf.blob);
    const pages: { page: number; text: string; hasImages: boolean }[] = [];

    for (let p = start; p <= end; p++) {
      const cacheKey = `${sourceId}:${p}`;
      const cached = await db.get('pdf_pages', cacheKey);
      if (cached) {
        pages.push({ page: p, text: cached.text, hasImages: cached.hasImages });
      } else {
        const text = await extractPageText(doc, p);
        pages.push({ page: p, text, hasImages: false });
      }
    }
    doc.destroy();

    return { ok: true, content: JSON.stringify({ pages }) };
  },
});

registerTool({
  name: 'get_page_image',
  description: 'Get a JPEG image of a specific PDF page as a base64 data URL. Use this when a page contains a figure, diagram, or flowchart that you need to analyse visually. The image is returned as a data URL that can be passed to a vision model.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      sourceId: { type: 'string' },
      pageNum: { type: 'number' },
    },
    required: ['sourceId', 'pageNum'],
  },
  async execute(args): Promise<ToolResult> {
    const sourceId = args.sourceId as string;
    const pageNum = args.pageNum as number;
    const db = await getDb();
    const cacheKey = `${sourceId}:${pageNum}`;
    let cached = await db.get('pdf_pages', cacheKey);

    if (!cached || !cached.imageBlob) {
      const pdf = await getPdf(sourceId);
      if (!pdf) return { ok: false, content: 'Source not found' };
      const doc = await loadPdfDocument(pdf.blob);
      const text = await extractPageText(doc, pageNum);
      const hasImg = await pageHasImages(doc, pageNum);
      const imageBlob = await renderPageToJpeg(doc, pageNum);
      doc.destroy();
      await db.put('pdf_pages', {
        id: cacheKey,
        pdfId: sourceId,
        pageNum,
        text,
        hasImages: hasImg,
        imageBlob,
        extractedAt: Date.now(),
      });
      cached = await db.get('pdf_pages', cacheKey);
    }

    if (!cached?.imageBlob) return { ok: false, content: 'No image available for this page' };

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(cached!.imageBlob!);
    });

    return { ok: true, content: JSON.stringify({ pageNum, dataUrl, hasFigure: cached.hasImages }) };
  },
});

registerTool({
  name: 'compare_sources',
  description: 'Search the same query across multiple specified sources and return the best matching snippet from each, side-by-side with tier annotations. Use this when you need to compare what different sources say about a topic (e.g. handbook vs current guideline).',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      sourceIds: { type: 'array', items: { type: 'string' }, description: 'Sources to compare (2-5)' },
    },
    required: ['query', 'sourceIds'],
  },
  async execute(args): Promise<ToolResult> {
    const query = args.query as string;
    const sourceIds = args.sourceIds as string[];
    const perSource: Record<string, unknown> = {};
    for (const sourceId of sourceIds) {
      const hits = await searchCorpus({ query, sourceIds: [sourceId], topK: 1 });
      const pdf = await getPdf(sourceId);
      perSource[sourceId] = {
        name: pdf?.name ?? sourceId,
        authority: pdf?.authority,
        year: pdf?.publicationYear,
        tier: pdf?.tier,
        topHit: hits[0] ?? null,
      };
    }
    return { ok: true, content: JSON.stringify(perSource) };
  },
});
