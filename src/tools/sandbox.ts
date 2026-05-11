import { getDb } from '../storage/db';

const TIMEOUT_MS = 30_000;

export interface SandboxScope {
  [key: string]: unknown;
}

export interface SandboxResult {
  ok: boolean;
  value?: unknown;
  error?: string;
  logs: string[];
}

export function createScope(): SandboxScope {
  const logs: string[] = [];

  const storage = {
    async get(store: string, key: string) {
      const db = await getDb();
      return db.get(store as never, key as never);
    },
    async put(store: string, value: unknown) {
      const db = await getDb();
      await db.put(store as never, value as never);
    },
    async getAll(store: string) {
      const db = await getDb();
      return db.getAll(store as never);
    },
    async delete(store: string, key: string) {
      const db = await getDb();
      await db.delete(store as never, key as never);
    },
  };

  return {
    console: {
      log: (...args: unknown[]) => { logs.push(args.map(String).join(' ')); },
      warn: (...args: unknown[]) => { logs.push(`[warn] ${args.map(String).join(' ')}`); },
      error: (...args: unknown[]) => { logs.push(`[error] ${args.map(String).join(' ')}`); },
    },
    storage,
    logs,
    Math,
    JSON,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Map,
    Set,
    RegExp,
    Promise,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    atob,
    btoa,
    crypto: { randomUUID: () => crypto.randomUUID() },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, TIMEOUT_MS)),
    clearTimeout,
  };
}

export async function executeSandboxed(code: string, extraScope?: SandboxScope): Promise<SandboxResult> {
  const baseScope = createScope();
  const scope = { ...baseScope, ...extraScope };
  const logs = scope.logs as string[];

  const proxy = new Proxy(scope, {
    has() { return true; },
    get(target, prop) {
      if (prop === Symbol.unscopables) return undefined;
      if (prop in target) return (target as Record<string | symbol, unknown>)[prop];
      if (typeof prop === 'string') {
        throw new ReferenceError(`"${prop}" is not available in sandbox`);
      }
      return undefined;
    },
  });

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      '__scope__',
      `with(__scope__) { return (async () => { ${code} })(); }`,
    );

    const result = await Promise.race([
      fn(proxy),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout (30s)')), TIMEOUT_MS),
      ),
    ]);

    return { ok: true, value: result, logs };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      logs,
    };
  }
}
