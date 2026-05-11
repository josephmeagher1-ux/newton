import { getDb, generateId } from './db';

export interface StoredPdf {
  id: string;
  name: string;
  blob: Blob;
  pageCount: number;
  outlineMd: string | null;
  addedAt: number;
  lastOpenedAt: number;
  sizeBytes: number;
}

export async function savePdf(file: File, pageCount: number): Promise<StoredPdf> {
  const db = await getDb();
  const now = Date.now();
  const record: StoredPdf = {
    id: generateId(),
    name: file.name.replace(/\.pdf$/i, ''),
    blob: file,
    pageCount,
    outlineMd: null,
    addedAt: now,
    lastOpenedAt: now,
    sizeBytes: file.size,
  };
  await db.put('pdfs', record);
  return record;
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
  const tx = db.transaction(['pdfs', 'pdf_pages', 'sections', 'threads', 'messages'], 'readwrite');
  await tx.objectStore('pdfs').delete(id);
  const pages = await tx.objectStore('pdf_pages').index('by-pdf').getAllKeys(id);
  for (const key of pages) await tx.objectStore('pdf_pages').delete(key);
  const sections = await tx.objectStore('sections').index('by-pdf').getAllKeys(id);
  for (const sKey of sections) await tx.objectStore('sections').delete(sKey);
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
