import Dexie, { type EntityTable } from 'dexie';

export interface ProviderResponse {
  providerId: string;
  model: string;
  text: string;
  error?: string;
  elapsedMs: number;
  estimatedTokens: number;
}

export interface QuerySession {
  id?: number;
  query: string;
  timestamp: number;
  responses: ProviderResponse[];
  files?: string[]; // filenames only, not content
}

const db = new Dexie('AgoraDB') as Dexie & {
  sessions: EntityTable<QuerySession, 'id'>;
};

db.version(1).stores({
  sessions: '++id, timestamp',
});

export { db };
