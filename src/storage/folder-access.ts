import { getDb } from './db';

const HANDLE_KEY = 'study_folder_handle';

export async function hasLinkedFolder(): Promise<boolean> {
  const db = await getDb();
  const record = await db.get('settings', HANDLE_KEY);
  return !!record?.value;
}

export async function linkFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) return null;
  try {
    const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
    const db = await getDb();
    await db.put('settings', { key: HANDLE_KEY, value: handle });
    return handle;
  } catch {
    return null;
  }
}

export async function getLinkedFolder(): Promise<FileSystemDirectoryHandle | null> {
  const db = await getDb();
  const record = await db.get('settings', HANDLE_KEY);
  if (!record?.value) return null;

  const handle = record.value as FileSystemDirectoryHandle;
  try {
    const perm = await (handle as any).requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') return handle;
  } catch { /* user denied or handle stale */ }
  return null;
}

export async function unlinkFolder(): Promise<void> {
  const db = await getDb();
  await db.delete('settings', HANDLE_KEY);
}

export async function writeFileToFolder(
  handle: FileSystemDirectoryHandle,
  filename: string,
  content: string,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function readFileFromFolder(
  handle: FileSystemDirectoryHandle,
  filename: string,
): Promise<string | null> {
  try {
    const fileHandle = await handle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export async function listPdfsInFolder(
  handle: FileSystemDirectoryHandle,
): Promise<{ name: string; file: File }[]> {
  const results: { name: string; file: File }[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
      const file = await entry.getFile();
      results.push({ name: entry.name, file });
    }
  }
  return results;
}
