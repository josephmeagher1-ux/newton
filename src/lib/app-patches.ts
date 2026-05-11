import { getDb } from '../storage/db';

export async function loadAppPatches(): Promise<void> {
  try {
    const db = await getDb();
    const patches = await db.getAllFromIndex('ai_data', 'by-type', 'css_patch');
    for (const patch of patches) {
      injectCssPatch(patch.id, patch.data as string);
    }

    const jsPatches = await db.getAllFromIndex('ai_data', 'by-type', 'startup_js');
    for (const patch of jsPatches) {
      try {
        const fn = new Function(patch.data as string);
        fn();
      } catch (e) {
        console.warn(`[patches] startup_js "${patch.id}" failed:`, e);
      }
    }
  } catch (e) {
    console.warn('[patches] Failed to load app patches:', e);
  }
}

export function injectCssPatch(id: string, css: string): void {
  const existing = document.getElementById(`patch-${id}`);
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = `patch-${id}`;
  style.textContent = css;
  document.head.appendChild(style);
}

export async function saveCssPatch(id: string, css: string): Promise<void> {
  const db = await getDb();
  await db.put('ai_data', {
    id,
    type: 'css_patch',
    data: css,
    createdAt: Date.now(),
  });
  injectCssPatch(id, css);
}

export async function saveStartupJs(id: string, code: string): Promise<void> {
  const db = await getDb();
  await db.put('ai_data', {
    id,
    type: 'startup_js',
    data: code,
    createdAt: Date.now(),
  });
}

export async function removePatch(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('ai_data', id);
  const el = document.getElementById(`patch-${id}`);
  if (el) el.remove();
}

export async function listPatches(): Promise<{ id: string; type: string; createdAt: number }[]> {
  const db = await getDb();
  const css = await db.getAllFromIndex('ai_data', 'by-type', 'css_patch');
  const js = await db.getAllFromIndex('ai_data', 'by-type', 'startup_js');
  const comps = await db.getAll('dynamic_components');
  return [
    ...css.map(p => ({ id: p.id, type: 'css_patch', createdAt: p.createdAt })),
    ...js.map(p => ({ id: p.id, type: 'startup_js', createdAt: p.createdAt })),
    ...comps.map(c => ({ id: c.id, type: 'component', createdAt: c.createdAt })),
  ];
}
