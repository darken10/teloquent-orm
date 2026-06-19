import type { Bindings, ConnectionConfig, Driver, StatementResult } from "../../types/index.js";
import { createRequire } from "node:module";
import { join } from "node:path";

/**
 * Renvoie tous les constructeurs `better-sqlite3` résolvables, dans l'ordre de
 * préférence. On privilégie le projet consommateur (cwd) — utile quand Teloquent
 * est lié par symlink (file: / npm link) et que sa propre copie est absente ou
 * cassée (binaire natif non compilé).
 */
function betterSqlite3Candidates(): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  const tryResolve = (base: string) => {
    try {
      const req = createRequire(base);
      const path = req.resolve("better-sqlite3");
      if (seen.has(path)) return;
      seen.add(path);
      out.push(req(path));
    } catch {
      /* candidat indisponible */
    }
  };
  tryResolve(join(process.cwd(), "noop.js")); // 1) projet consommateur
  tryResolve(import.meta.url); // 2) répertoire de Teloquent
  return out;
}

/**
 * Driver SQLite basé sur `better-sqlite3` (synchrone, enveloppé en promesses),
 * avec repli automatique sur le module natif `node:sqlite` (Node >= 22).
 */
export class SQLiteDriver implements Driver {
  readonly dialect = "sqlite" as const;

  private db: any = null;
  private inTransaction = false;

  constructor(private readonly config: ConnectionConfig) {}

  async connect(): Promise<void> {
    if (this.db) return;
    const file = this.config.database ?? ":memory:";

    // 1) Driver préféré : better-sqlite3. On teste chaque candidat : si l'un a
    //    un binaire natif manquant/cassé, on passe au suivant.
    let lastError: unknown = null;
    for (const BetterSqlite3 of betterSqlite3Candidates()) {
      try {
        this.db = new BetterSqlite3(file, this.config.options ?? {});
        break;
      } catch (e) {
        lastError = e;
        this.db = null;
      }
    }

    // 2) Repli : module natif `node:sqlite` (Node >= 22, aucune compilation).
    if (!this.db) {
      try {
        // @ts-ignore — module natif disponible sur Node >= 22 (types optionnels)
        const { DatabaseSync } = await import("node:sqlite");
        this.db = new DatabaseSync(file);
      } catch {
        const detail = lastError instanceof Error ? `\nDétail : ${lastError.message}` : "";
        throw new Error(
          "Le driver SQLite requiert 'better-sqlite3' fonctionnel " +
            "(npm i better-sqlite3) ou Node >= 22 avec le module 'node:sqlite'." +
            detail
        );
      }
    }

    // API commune (exec/prepare) aux deux backends.
    // PRAGMAs best-effort : WAL n'est pas supporté sur certains systèmes de
    // fichiers (montages réseau, overlay) — on n'échoue pas si c'est le cas.
    try {
      this.db.exec("PRAGMA journal_mode = WAL");
    } catch {
      /* journal par défaut conservé */
    }
    try {
      this.db.exec("PRAGMA foreign_keys = ON");
    } catch {
      /* ignore */
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private ensure(): any {
    if (!this.db) throw new Error("Connexion SQLite non ouverte. Appelez connect() d'abord.");
    return this.db;
  }

  async select<T = Record<string, unknown>>(sql: string, bindings: Bindings): Promise<T[]> {
    const stmt = this.ensure().prepare(sql);
    return stmt.all(...this.normalize(bindings)) as T[];
  }

  async statement(sql: string, bindings: Bindings): Promise<StatementResult> {
    const db = this.ensure();
    // Le DDL (CREATE TABLE...) ne se prépare pas toujours avec des bindings.
    if (bindings.length === 0 && /^\s*(create|drop|alter|pragma)/i.test(sql)) {
      db.exec(sql);
      return { affectedRows: 0 };
    }
    const info = db.prepare(sql).run(...this.normalize(bindings));
    return {
      affectedRows: info.changes ?? 0,
      lastInsertId: info.lastInsertRowid,
    };
  }

  async beginTransaction(): Promise<void> {
    if (this.inTransaction) return;
    this.ensure().exec("BEGIN");
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction) return;
    this.ensure().exec("COMMIT");
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction) return;
    this.ensure().exec("ROLLBACK");
    this.inTransaction = false;
  }

  /** better-sqlite3 n'accepte pas les booléens/undefined : on normalise. */
  private normalize(bindings: Bindings): unknown[] {
    return bindings.map((b) => {
      if (typeof b === "boolean") return b ? 1 : 0;
      if (b === undefined) return null;
      if (b instanceof Date) return b.toISOString();
      return b;
    });
  }
}
