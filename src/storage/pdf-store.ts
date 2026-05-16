import { getDb, generateId, type SourceType } from './db';

export interface StoredPdf {
  id: string;
  name: string;
  blob: Blob;
  pageCount: number;
  outlineMd: string | null;
  addedAt: number;
  lastOpenedAt: number;
  sizeBytes: number;
  sourceType: SourceType;
  publicationYear: number | null;
  authority: string | null;
  tier: 1 | 2 | 3;
}

export interface PdfMetadataInput {
  sourceType?: SourceType;
  publicationYear?: number | null;
  authority?: string | null;
  tier?: 1 | 2 | 3;
}

export interface InferredMetadata {
  sourceType: SourceType;
  publicationYear: number | null;
  authority: string | null;
  tier: 1 | 2 | 3;
}

const HANDBOOK_PATTERNS = [/oxford\s+handbook/i, /handbook\s+of/i, /pocket\s+guide/i, /manual/i];
const GUIDELINE_PATTERNS = [/guideline/i, /\bnice\b/i, /\bng\d{2,4}\b/i, /\bbts\b/i, /\bsign\b/i, /\bcg\d{2,4}\b/i];
const PAPER_PATTERNS = [/lancet/i, /bmj/i, /nejm/i, /jama/i, /\bdoi[:_\-]/i];
const AUTHORITY_HINTS: Array<[RegExp, string]> = [
  [/\bnice\b/i, 'NICE'],
  [/\bbmj\b/i, 'BMJ'],
  [/\bbts\b/i, 'BTS'],
  [/\bsign\b/i, 'SIGN'],
  [/\bnejm\b/i, 'NEJM'],
  [/lancet/i, 'The Lancet'],
  [/oxford/i, 'Oxford University Press'],
  [/jama/i, 'JAMA'],
];

export function inferMetadataFromFilename(filename: string): InferredMetadata {
  const name = filename.replace(/\.pdf$/i, '');
  const yearMatch = name.match(/\b(19|20)\d{2}\b/);
  const publicationYear = yearMatch ? parseInt(yearMatch[0], 10) : null;
  const currentYear = new Date().getFullYear();
  const ageYears = publicationYear ? currentYear - publicationYear : null;

  let sourceType: SourceType = 'other';
  if (GUIDELINE_PATTERNS.some(p => p.test(name))) sourceType = 'guideline';
  else if (HANDBOOK_PATTERNS.some(p => p.test(name))) sourceType = 'handbook';
  else if (PAPER_PATTERNS.some(p => p.test(name))) sourceType = 'paper';

  let authority: string | null = null;
  for (const [pattern, label] of AUTHORITY_HINTS) {
    if (pattern.test(name)) { authority = label; break; }
  }

  let tier: 1 | 2 | 3 = 3;
  if (sourceType === 'guideline' && (ageYears === null || ageYears <= 2)) tier = 1;
  else if (sourceType === 'handbook') tier = 2;
  else if (sourceType === 'paper' && ageYears !== null && ageYears <= 3) tier = 1;

  return { sourceType, publicationYear, authority, tier };
}

export async function savePdf(file: File, pageCount: number, metadata?: PdfMetadataInput): Promise<StoredPdf> {
  const db = await getDb();
  const now = Date.now();
  const inferred = inferMetadataFromFilename(file.name);
  const record: StoredPdf = {
    id: generateId(),
    name: file.name.replace(/\.pdf$/i, ''),
    blob: file,
    pageCount,
    outlineMd: null,
    addedAt: now,
    lastOpenedAt: now,
    sizeBytes: file.size,
    sourceType: metadata?.sourceType ?? inferred.sourceType,
    publicationYear: metadata?.publicationYear ?? inferred.publicationYear,
    authority: metadata?.authority ?? inferred.authority,
    tier: metadata?.tier ?? inferred.tier,
  };
  await db.put('pdfs', record);
  return record;
}

export async function updatePdfMetadata(id: string, fields: PdfMetadataInput): Promise<void> {
  const db = await getDb();
  const pdf = await db.get('pdfs', id);
  if (!pdf) return;
  await db.put('pdfs', {
    ...pdf,
    sourceType: fields.sourceType ?? pdf.sourceType,
    publicationYear: fields.publicationYear !== undefined ? fields.publicationYear : pdf.publicationYear,
    authority: fields.authority !== undefined ? fields.authority : pdf.authority,
    tier: fields.tier ?? pdf.tier,
  });
}

export async function getPdf(id: string): Promise<StoredPdf | undefined> {
  const db = await getDb();
  return db.get('pdfs', id);
}

export async function listPdfs(): Promise<Omit<StoredPdf, 'blob'>[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('pdfs', 'by-added');
  return all.reverse().map(({ blob: _blob, ...rest }) => rest);
}

export async function deletePdf(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['pdfs', 'pdf_pages', 'sections', 'threads', 'messages', 'ai_data'], 'readwrite');
  await tx.objectStore('pdfs').delete(id);
  const pages = await tx.objectStore('pdf_pages').index('by-pdf').getAllKeys(id);
  for (const key of pages) await tx.objectStore('pdf_pages').delete(key);
  const sections = await tx.objectStore('sections').index('by-pdf').getAllKeys(id);
  for (const sKey of sections) await tx.objectStore('sections').delete(sKey);
  await tx.objectStore('ai_data').delete(`search_index:${id}`);
  await tx.done;
}

export async function updatePdfOutline(id: string, outlineMd: string): Promise<void> {
  const db = await getDb();
  const pdf = await db.get('pdfs', id);
  if (!pdf) return;
  await db.put('pdfs', { ...pdf, outlineMd });
}

export async function touchPdf(id: string): Promise<void> {
  const db = await getDb();
  const pdf = await db.get('pdfs', id);
  if (!pdf) return;
  await db.put('pdfs', { ...pdf, lastOpenedAt: Date.now() });
}
