import { computeThemeVariables } from '../domain/color';
import {
  Goal,
  InboxItem,
  Invite,
  Membership,
  Organization,
  Tag,
  Task,
  User,
} from '../domain/types';

export const CURRENT_SCHEMA_VERSION = 1;
const DB_STORAGE_KEY = 'intask_db_v1';
const SESSION_STORAGE_KEY = 'intask_session_v1';
const THEME_SNAPSHOT_KEY = 'intask_theme_snapshot';

export interface StoredCredential {
  userId: string;
  passwordSalt: string;
  passwordHash: string;
}

export interface DatabaseSchema {
  schemaVersion: number;
  users: User[];
  credentials: StoredCredential[];
  organizations: Organization[];
  memberships: Membership[];
  invites: Invite[];
  tags: Tag[];
  tasks: Task[];
  inboxItems: InboxItem[];
  goals: Goal[];
}

export function createEmptyDatabase(): DatabaseSchema {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    users: [],
    credentials: [],
    organizations: [],
    memberships: [],
    invites: [],
    tags: [],
    tasks: [],
    inboxItems: [],
    goals: [],
  };
}

/**
 * Runs forward migrations when older schemaVersion is encountered.
 */
export function migrateDatabase(raw: unknown): DatabaseSchema {
  if (!raw || typeof raw !== 'object') {
    return createEmptyDatabase();
  }
  const obj = raw as Partial<DatabaseSchema>;
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    users: Array.isArray(obj.users) ? obj.users : [],
    credentials: Array.isArray(obj.credentials) ? obj.credentials : [],
    organizations: Array.isArray(obj.organizations) ? obj.organizations : [],
    memberships: Array.isArray(obj.memberships) ? obj.memberships : [],
    invites: Array.isArray(obj.invites) ? obj.invites : [],
    tags: Array.isArray(obj.tags) ? obj.tags : [],
    tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
    inboxItems: Array.isArray(obj.inboxItems) ? obj.inboxItems : [],
    goals: Array.isArray(obj.goals) ? obj.goals : [],
  };
}

export class StorageEngine {
  private memoryDb: DatabaseSchema | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private warningListeners = new Set<(msg: string) => void>();
  private externalChangeListeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === DB_STORAGE_KEY || event.key === SESSION_STORAGE_KEY) {
          this.memoryDb = null; // Invalidate cache so next read pulls fresh state
          this.externalChangeListeners.forEach((cb) => cb());
        }
      });
    }
  }

  public onWarning(cb: (msg: string) => void): () => void {
    this.warningListeners.add(cb);
    return () => this.warningListeners.delete(cb);
  }

  public onExternalChange(cb: () => void): () => void {
    this.externalChangeListeners.add(cb);
    return () => this.externalChangeListeners.delete(cb);
  }

  private emitWarning(msg: string): void {
    this.warningListeners.forEach((cb) => cb(msg));
  }

  public readDb(): DatabaseSchema {
    if (this.memoryDb) {
      return this.memoryDb;
    }

    try {
      const rawStr = window.localStorage.getItem(DB_STORAGE_KEY);
      if (!rawStr) {
        this.memoryDb = createEmptyDatabase();
        return this.memoryDb;
      }
      const parsed = JSON.parse(rawStr);
      this.memoryDb = migrateDatabase(parsed);
      return this.memoryDb;
    } catch {
      this.emitWarning(
        'Detectamos dados locais corrompidos e restauramos uma base limpa com segurança.'
      );
      this.memoryDb = createEmptyDatabase();
      return this.memoryDb;
    }
  }

  public writeDb(nextDb: DatabaseSchema, immediate = false): void {
    this.memoryDb = nextDb;

    const persistNow = () => {
      try {
        const serialized = JSON.stringify(nextDb);
        window.localStorage.setItem(DB_STORAGE_KEY, serialized);
      } catch (err) {
        const isQuota =
          err instanceof DOMException &&
          (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
        if (isQuota) {
          this.emitWarning(
            'O armazenamento local do navegador atingiu o limite (cota cheia). Exporte um backup em Configurações.'
          );
        } else {
          this.emitWarning('Não foi possível gravar alterações no armazenamento local.');
        }
      }
    };

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (immediate) {
      persistNow();
    } else {
      this.debounceTimer = setTimeout(persistNow, 120);
    }
  }

  public getSessionUserId(): string | null {
    try {
      return window.localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  public setSessionUserId(userId: string | null): void {
    try {
      if (userId) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, userId);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  public saveThemeSnapshot(accentColor: string, resolvedThemeMode: 'light' | 'dark'): void {
    try {
      const vars = computeThemeVariables(accentColor, resolvedThemeMode === 'dark');
      window.localStorage.setItem(
        THEME_SNAPSHOT_KEY,
        JSON.stringify({
          accentColor,
          themeMode: resolvedThemeMode,
          vars,
        })
      );
    } catch {
      // Ignore
    }
  }

  public clearAll(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.memoryDb = createEmptyDatabase();
    try {
      window.localStorage.removeItem(DB_STORAGE_KEY);
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(THEME_SNAPSHOT_KEY);
    } catch {
      // Ignore
    }
  }
}