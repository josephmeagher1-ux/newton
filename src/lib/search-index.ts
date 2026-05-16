import MiniSearch from 'minisearch';
import { getDb } from '../storage/db';
import { getPdf, listPdfs, type StoredPdf } from '../storage/pdf-store';
import { loadPdfDocument } from './pdf';
import { extractSectionContent, getSectionsForPdf, type ParsedSection } from './pdf-sections';

export interface SearchDoc {
  id: string;
  pdfId: string;
  sectionId: string;
  heading: string;
  pageStart: number;
  pageEnd: number;
  text: string;
}

export interface SearchHit {
  pdfId: string;
  pdfName: string;
  sourceType: string;
  authority: string | null;
  publicationYear: number | null;
  tier: 1 | 2 | 3;
  sectionId: string;
  heading: string;
  pageStart: number;
  pageEnd: number;
  snippet: string;
  score: number;
}

// Curated medical synonym/abbreviation map. The MiniSearch tokeniser expands queries
// with these before searching, so "MI" matches "myocardial infarction" and vice versa.
const SYNONYMS: Record<string, string[]> = {
  mi: ['myocardial', 'infarction', 'heart', 'attack'],
  copd: ['chronic', 'obstructive', 'pulmonary', 'disease', 'emphysema'],
  chf: ['congestive', 'heart', 'failure'],
  dvt: ['deep', 'vein', 'thrombosis'],
  pe: ['pulmonary', 'embolism'],
  cva: ['cerebrovascular', 'accident', 'stroke'],
  tia: ['transient', 'ischaemic', 'attack'],
  uti: ['urinary', 'tract', 'infection'],
  copd: ['chronic', 'obstructive', 'pulmonary'],
  dka: ['diabetic', 'ketoacidosis'],
  aki: ['acute', 'kidney', 'injury'],
  ckd: ['chronic', 'kidney', 'disease'],
  uti: ['urinary', 'tract', 'infection'],
  gi: ['gastrointestinal'],
  ibd: ['inflammatory', 'bowel', 'disease'],
  ibs: ['irritable', 'bowel', 'syndrome'],
  uc: ['ulcerative', 'colitis'],
  ra: ['rheumatoid', 'arthritis'],
  sle: ['lupus', 'systemic', 'erythematosus'],
  htn: ['hypertension', 'high', 'blood', 'pressure'],
  t1dm: ['type', '1', 'diabetes', 'mellitus'],
  t2dm: ['type', '2', 'diabetes', 'mellitus'],
  copd: ['chronic', 'obstructive', 'pulmonary', 'disease'],
  afib: ['atrial', 'fibrillation'],
  af: ['atrial', 'fibrillation'],
  bp: ['blood', 'pressure'],
  hr: ['heart', 'rate'],
  rr: ['respiratory', 'rate'],
  spo2: ['oxygen', 'saturation'],
  fbc: ['full', 'blood', 'count'],
  cbc: ['complete', 'blood', 'count'],
  lft: ['liver', 'function', 'tests'],
  ues: ['urea', 'electrolytes'],
  crp: ['c', 'reactive', 'protein'],
  cxr: ['chest', 'xray'],
  ct: ['computed', 'tomography'],
  mri: ['magnetic', 'resonance', 'imaging'],
  ecg: ['electrocardiogram'],
  ekg: ['electrocardiogram'],
};

// In-memory cache of deserialised indexes by pdfId
const indexCache = new Map<string, MiniSearch<SearchDoc>>();

function buildMiniSearch(): MiniSearch<SearchDoc> {
  return new MiniSearch<SearchDoc>({
    fields: ['heading', 'text'],
    storeFields: ['pdfId', 'sectionId', 'heading', 'pageStart', 'pageEnd', 'text'],
    searchOptions: {
      boost: { heading: 2 },
      fuzzy: 0.15,
      prefix: true,
    },
    processTerm: (term, _fieldName) => {
      const lower = term.toLowerCase();
      const expanded = SYNONYMS[lower];
      // MiniSearch supports returning an array to index multiple terms for a single token
      return expanded ? [lower, ...expanded] : lower;
    },
  });
}

export async function buildIndexForPdf(pdfId: string): Promise<number> {
  const pdf = await getPdf(pdfId);
  if (!pdf) throw new Error(`PDF not found: ${pdfId}`);

  const sections = await getSectionsForPdf(pdfId);
  if (sections.length === 0) return 0;

  const doc = await loadPdfDocument(pdf.blob);
  const docs: SearchDoc[] = [];

  for (const section of sections) {
    const pages = await extractSectionContent(doc, pdfId, section as ParsedSection);
    const text = pages.map(p => p.text).join('\n\n');
    docs.push({
      id: section.id,
      pdfId,
      sectionId: section.id,
      heading: section.heading,
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      text: text.slice(0, 20000), // cap section text in index
    });
  }
  doc.destroy();

  const ms = buildMiniSearch();
  ms.addAll(docs);
  indexCache.set(pdfId, ms);

  const db = await getDb();
  await db.put('ai_data', {
    id: `search_index:${pdfId}`,
    type: 'search_index',
    data: ms.toJSON(),
    createdAt: Date.now(),
  });

  return docs.length;
}

async function loadIndex(pdfId: string): Promise<MiniSearch<SearchDoc> | null> {
  const cached = indexCache.get(pdfId);
  if (cached) return cached;

  const db = await getDb();
  const record = await db.get('ai_data', `search_index:${pdfId}`);
  if (!record) return null;

  const ms = MiniSearch.loadJS<SearchDoc>(record.data as ReturnType<MiniSearch['toJSON']>, {
    fields: ['heading', 'text'],
    storeFields: ['pdfId', 'sectionId', 'heading', 'pageStart', 'pageEnd', 'text'],
    searchOptions: { boost: { heading: 2 }, fuzzy: 0.15, prefix: true },
    processTerm: (term) => {
      const lower = term.toLowerCase();
      const expanded = SYNONYMS[lower];
      return expanded ? [lower, ...expanded] : lower;
    },
  });
  indexCache.set(pdfId, ms);
  return ms;
}

export interface SearchOptions {
  query: string;
  sourceIds?: string[];
  topK?: number;
  minTier?: 1 | 2 | 3;
}

export async function searchCorpus(opts: SearchOptions): Promise<SearchHit[]> {
  const { query, sourceIds, topK = 8, minTier = 3 } = opts;
  const allPdfs = await listPdfs();
  const targetPdfs: Omit<StoredPdf, 'blob'>[] = sourceIds
    ? allPdfs.filter(p => sourceIds.includes(p.id))
    : allPdfs;

  const hits: SearchHit[] = [];
  for (const pdf of targetPdfs) {
    if (pdf.tier > minTier) continue;
    const idx = await loadIndex(pdf.id);
    if (!idx) continue;
    const results = idx.search(query, { boost: { heading: 2 }, fuzzy: 0.15, prefix: true });
    const tierBoost = pdf.tier === 1 ? 1.5 : pdf.tier === 2 ? 1.0 : 0.7;
    const recencyBoost = pdf.publicationYear
      ? Math.min(1.3, 1 + Math.max(0, (pdf.publicationYear - 2018)) * 0.05)
      : 1.0;
    for (const r of results) {
      const text = r.text as string;
      hits.push({
        pdfId: pdf.id,
        pdfName: pdf.name,
        sourceType: pdf.sourceType,
        authority: pdf.authority,
        publicationYear: pdf.publicationYear,
        tier: pdf.tier,
        sectionId: r.sectionId,
        heading: r.heading,
        pageStart: r.pageStart,
        pageEnd: r.pageEnd,
        snippet: extractSnippet(text, query),
        score: r.score * tierBoost * recencyBoost,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, topK);
}

function extractSnippet(text: string, query: string): string {
  const lower = text.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  let bestIdx = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
  }
  if (bestIdx === -1) return text.slice(0, 250);
  const start = Math.max(0, bestIdx - 80);
  const end = Math.min(text.length, bestIdx + 250);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

export async function hasIndex(pdfId: string): Promise<boolean> {
  if (indexCache.has(pdfId)) return true;
  const db = await getDb();
  const record = await db.get('ai_data', `search_index:${pdfId}`);
  return !!record;
}

export function invalidateIndex(pdfId: string): void {
  indexCache.delete(pdfId);
}
