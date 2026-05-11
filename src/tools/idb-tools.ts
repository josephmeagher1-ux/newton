import { getDb } from '../storage/db';
import { registerTool, type ToolContext, type ToolResult } from './registry';
import { executeMigration, type MigrationResult } from '../storage/migrate';
import type { MigrationOp } from '../storage/db';

registerTool({
  name: 'idb_get',
  description: 'Get a record by key from an IndexedDB object store',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      store: { type: 'string', description: 'Object store name' },
      key: { type: 'string', description: 'Record key' },
    },
    required: ['store', 'key'],
  },
  async execute(args): Promise<ToolResult> {
    const db = await getDb();
    const record = await db.get(args.store as never, args.key as never);
    return { ok: true, content: JSON.stringify(record ?? null) };
  },
});

registerTool({
  name: 'idb_query',
  description: 'Query records from an IndexedDB object store. Optionally filter by index.',
  risk: 'read',
  parameters: {
    type: 'object',
    properties: {
      store: { type: 'string', description: 'Object store name' },
      index: { type: 'string', description: 'Index name (optional)' },
      key: { type: 'string', description: 'Key or range value for index query (optional)' },
      limit: { type: 'number', description: 'Max records to return (default 20)' },
    },
    required: ['store'],
  },
  async execute(args): Promise<ToolResult> {
    const db = await getDb();
    const limit = (args.limit as number) || 20;
    let records: unknown[];

    if (args.index && args.key) {
      records = await db.getAllFromIndex(
        args.store as never,
        args.index as never,
        args.key as never,
      );
    } else {
      records = await db.getAll(args.store as never);
    }

    return { ok: true, content: JSON.stringify(records.slice(0, limit)) };
  },
});

registerTool({
  name: 'idb_put',
  description: 'Put a record into an IndexedDB object store',
  risk: 'write',
  parameters: {
    type: 'object',
    properties: {
      store: { type: 'string', description: 'Object store name' },
      value: { type: 'object', description: 'Record to store' },
    },
    required: ['store', 'value'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const approved = await ctx.confirm({ tool: 'idb_put', preview: `Write to "${args.store}"` });
    if (!approved) return { ok: false, content: 'User declined' };
    const db = await getDb();
    await db.put(args.store as never, args.value as never);
    return { ok: true, content: 'Written successfully' };
  },
});

registerTool({
  name: 'idb_delete',
  description: 'Delete a record by key from an IndexedDB object store',
  risk: 'write',
  parameters: {
    type: 'object',
    properties: {
      store: { type: 'string', description: 'Object store name' },
      key: { type: 'string', description: 'Record key' },
    },
    required: ['store', 'key'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const approved = await ctx.confirm({ tool: 'idb_delete', preview: `Delete from "${args.store}" key="${args.key}"` });
    if (!approved) return { ok: false, content: 'User declined' };
    const db = await getDb();
    await db.delete(args.store as never, args.key as never);
    return { ok: true, content: 'Deleted' };
  },
});

registerTool({
  name: 'idb_migrate',
  description: 'Apply a schema migration to IndexedDB. Operations: createStore, deleteStore, createIndex, deleteIndex. Cannot modify protected core stores.',
  risk: 'exec',
  parameters: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Human-readable description of the migration' },
      operations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['createStore', 'deleteStore', 'createIndex', 'deleteIndex'] },
            name: { type: 'string' },
            store: { type: 'string' },
            keyPath: { type: 'string' },
            autoIncrement: { type: 'boolean' },
            options: { type: 'object' },
          },
          required: ['type'],
        },
      },
    },
    required: ['description', 'operations'],
  },
  async execute(args, ctx: ToolContext): Promise<ToolResult> {
    const ops = args.operations as MigrationOp[];
    const desc = args.description as string;
    const approved = await ctx.confirm({ tool: 'idb_migrate', preview: `Migration: ${desc}` });
    if (!approved) return { ok: false, content: 'User declined' };
    const result: MigrationResult = await executeMigration(ops, desc);
    if (!result.ok) return { ok: false, content: result.error ?? 'Migration failed' };
    return { ok: true, content: `Migration applied. New version: ${result.newVersion}` };
  },
});
