export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  const granted = await navigator.storage.persist();
  if (!granted) {
    console.warn('[storage] Persistence not granted — data may be evicted after weeks of disuse');
  }
  return granted;
}

export async function getStorageEstimate(): Promise<{ usageMB: number; quotaMB: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return {
    usageMB: Math.round((usage ?? 0) / 1e6 * 10) / 10,
    quotaMB: Math.round((quota ?? 0) / 1e6),
  };
}
