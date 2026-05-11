import { getDb } from '../storage/db';

export async function getSetting<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const record = await db.get('settings', key);
  return (record?.value as T) ?? null;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('settings', { key, value });
}
