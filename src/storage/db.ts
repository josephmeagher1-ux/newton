import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCallMessage[];
  toolCallId?: string;
  model?: string;
  createdAt: number;
}

export interface ToolCallMessage {
  id: string;
  name: string;
  arguments: string;
}

export interface LearnyDB extends DBSchema {
  pdfs: {
    key: string;
    value: {
      id: string;
      name: string;
      blob: Blob;
      pageCount: number;
      outlineMd: string | null;
      addedAt: number;
      lastOpenedAt: number;
      sizeBytes: number;
    };
    indexes: { 'by-added': number };
  };
  pdf_pages: {
    key: string;
    value: {
      id: string;
      pdfId: string;
      pageNum: number;
      text: string;
      extractedAt: number;
    };
    indexes: { 'by-pdf': string };
  };
  sections: {
    key: string;
    value: {
      id: string;
      pdfId: string;
      heading: string;
      pageStart: number;
      pageEnd: number;
      estimatedMinutes: number;
      orderIndex: number;
    };
    indexes: { 'by-pdf': string };
  };
  threads: {
    key: string;
    value: {
      id: string;
      sectionId: string;
      createdAt: number;
    };
    indexes: { 'by-section': string };
  };
  messages: {
    key: string;
    value: Message & { threadId: string };
    indexes: { 'by-thread': string };
  };
  tool_calls: {
    key: number;
    value: {
      id?: number;
      threadId: string;
      tool: string;
      input: unknown;
      output: unknown;
      approved: boolean;
      executedAt: number;
      durationMs: number;
      error?: string;
    };
    indexes: { 'by-thread': string };
  };
  ai_data: {
    key: string;
    value: {
      id: string;
      type: string;
      threadId?: string;
      data: unknown;
      createdAt: number;
    };
    indexes: { 'by-type': string; 'by-thread': string };
  };
  dynamic_components: {
    key: string;
    value: {
      id: string;
      subject: string;
      name: string;
      sourceTsx: string;
      createdAt: number;
    };
    indexes: { 'by-subject': string };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
  _migrations: {
    key: number;
    value: {
      version: number;
      ops: MigrationOp[];
      appliedAt: number;
      description: string;
    };
  };
}

export type MigrationOp =
  | { type: 'createStore'; name: string; keyPath?: string; autoIncrement?: boolean }
  | { type: 'deleteStore'; name: string }
  | { type: 'createIndex'; store: string; name: string; keyPath: string; options?: IDBIndexParameters }
  | { type: 'deleteIndex'; store: string; name: string };

const DB_NAME = 'newton-db';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<LearnyDB> | null = null;

export async function getDb(): Promise<IDBPDatabase<LearnyDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LearnyDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const pdfs = db.createObjectStore('pdfs', { keyPath: 'id' });
      pdfs.createIndex('by-added', 'addedAt');

      const pdfPages = db.createObjectStore('pdf_pages', { keyPath: 'id' });
      pdfPages.createIndex('by-pdf', 'pdfId');

      const sections = db.createObjectStore('sections', { keyPath: 'id' });
      sections.createIndex('by-pdf', 'pdfId');

      const threads = db.createObjectStore('threads', { keyPath: 'id' });
      threads.createIndex('by-section', 'sectionId');

      const messages = db.createObjectStore('messages', { keyPath: 'id' });
      messages.createIndex('by-thread', 'threadId');

      const toolCalls = db.createObjectStore('tool_calls', { keyPath: 'id', autoIncrement: true });
      toolCalls.createIndex('by-thread', 'threadId');

      const aiData = db.createObjectStore('ai_data', { keyPath: 'id' });
      aiData.createIndex('by-type', 'type');
      aiData.createIndex('by-thread', 'threadId');

      const dynComp = db.createObjectStore('dynamic_components', { keyPath: 'id' });
      dynComp.createIndex('by-subject', 'subject');

      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('_migrations', { autoIncrement: true });
    },
    blocked() {
      console.warn('[db] Upgrade blocked — close other tabs');
    },
    blocking() {
      dbInstance?.close();
      dbInstance = null;
    },
  });

  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function generateId(): string {
  return crypto.randomUUID();
}
