import { openDB } from 'idb';
import { closeDb, getDb, type MigrationOp } from './db';

const PROTECTED_STORES = new Set([
  'pdfs', 'pdf_pages', 'sections', 'threads', 'messages',
  'tool_calls', 'settings', '_migrations',
]);

const MAX_OPS_PER_MIGRATION = 5;
const MAX_TOTAL_STORES = 20;
const STORE_NAME_RE = /^[a-z][a-z0-9_]{0,49}$/;

export interface MigrationResult {
  ok: boolean;
  newVersion?: number;
  error?: string;
}

function validateOps(ops: MigrationOp[], existingStores: string[]): string | null {
  if (ops.length === 0) return 'No operations provided';
  if (ops.length > MAX_OPS_PER_MIGRATION) return `Max ${MAX_OPS_PER_MIGRATION} ops per migration`;

  let storeCount = existingStores.length;

  for (const op of ops) {
    switch (op.type) {
      case 'createStore':
        if (!STORE_NAME_RE.test(op.name)) return `Invalid store name: "${op.name}"`;
        if (PROTECTED_STORES.has(op.name)) return `Cannot modify protected store: "${op.name}"`;
        if (existingStores.includes(op.name)) return `Store already exists: "${op.name}"`;
        storeCount++;
        if (storeCount > MAX_TOTAL_STORES) return `Would exceed max ${MAX_TOTAL_STORES} stores`;
        break;
      case 'deleteStore':
        if (PROTECTED_STORES.has(op.name)) return `Cannot delete protected store: "${op.name}"`;
        if (!existingStores.includes(op.name)) return `Store does not exist: "${op.name}"`;
        storeCount--;
        break;
      case 'createIndex':
        if (!existingStores.includes(op.store) && !ops.some(o => o.type === 'createStore' && o.name === op.store)) {
          return `Store does not exist: "${op.store}"`;
        }
        if (!op.keyPath || op.keyPath.split('.').length > 2) return `Invalid keyPath: "${op.keyPath}"`;
        break;
      case 'deleteIndex':
        if (PROTECTED_STORES.has(op.store)) return `Cannot modify indexes on protected store: "${op.store}"`;
        break;
      default:
        return `Unknown operation type`;
    }
  }

  return null;
}

export async function executeMigration(ops: MigrationOp[], description: string): Promise<MigrationResult> {
  const db = await getDb();
  const existingStores = [...db.objectStoreNames];
  const currentVersion = db.version;

  const error = validateOps(ops, existingStores);
  if (error) return { ok: false, error };

  await closeDb();

  const newVersion = currentVersion + 1;

  try {
    const upgraded = await openDB('newton-db', newVersion, {
      upgrade(udb, _oldVersion, _newVersion, transaction) {
        for (const op of ops) {
          switch (op.type) {
            case 'createStore':
              udb.createObjectStore(op.name, {
                keyPath: op.keyPath,
                autoIncrement: op.autoIncrement,
              });
              break;
            case 'deleteStore':
              udb.deleteObjectStore(op.name);
              break;
            case 'createIndex': {
              const store = transaction.objectStore(op.store);
              store.createIndex(op.name, op.keyPath, op.options);
              break;
            }
            case 'deleteIndex': {
              const store = transaction.objectStore(op.store);
              store.deleteIndex(op.name);
              break;
            }
          }
        }
      },
    });

    await upgraded.put('_migrations', {
      version: newVersion,
      ops,
      appliedAt: Date.now(),
      description,
    });

    upgraded.close();
    return { ok: true, newVersion };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Migration failed' };
  }
}
