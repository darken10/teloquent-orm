import { ConnectionManager } from "../connection/ConnectionManager.js";
import type { Connection } from "../connection/Connection.js";

/** Une migration : un nom unique + up()/down(). */
export interface MigrationEntry {
  name: string;
  up(): Promise<void> | void;
  down(): Promise<void> | void;
}

export interface MigrationStatus {
  name: string;
  ran: boolean;
  batch: number | null;
}

/**
 * Exécute et annule des migrations en s'appuyant sur une table `migrations`
 * (name, batch). Les migrations sont fournies sous forme de liste ordonnée.
 */
export class Migrator {
  private readonly table = "migrations";

  constructor(private readonly connectionName?: string) {}

  private conn(): Connection {
    return ConnectionManager.connection(this.connectionName);
  }

  /** Crée la table migrations si absente. */
  async ensureTable(): Promise<void> {
    const g = this.conn().getGrammar();
    await this.conn().statement(
      `create table if not exists ${g.wrap(this.table)} ` +
        `(${g.wrap("name")} varchar(255), ${g.wrap("batch")} integer)`
    );
  }

  private async rows(): Promise<Array<{ name: string; batch: number }>> {
    return (await this.conn().table(this.table).get()) as Array<{ name: string; batch: number }>;
  }

  /** Applique les migrations en attente (nouveau batch). Renvoie les noms appliqués. */
  async run(migrations: MigrationEntry[]): Promise<string[]> {
    await this.ensureTable();
    const rows = await this.rows();
    const ran = new Set(rows.map((r) => r.name));
    const lastBatch = rows.reduce((m, r) => Math.max(m, Number(r.batch)), 0);
    const pending = migrations.filter((m) => !ran.has(m.name));
    if (!pending.length) return [];

    const batch = lastBatch + 1;
    const applied: string[] = [];
    for (const m of pending) {
      await m.up();
      await this.conn().table(this.table).insert({ name: m.name, batch });
      applied.push(m.name);
    }
    return applied;
  }

  /** Annule le dernier batch. Renvoie les noms annulés. */
  async rollback(migrations: MigrationEntry[]): Promise<string[]> {
    await this.ensureTable();
    const rows = await this.rows();
    const lastBatch = rows.reduce((m, r) => Math.max(m, Number(r.batch)), 0);
    if (lastBatch === 0) return [];

    const names = rows
      .filter((r) => Number(r.batch) === lastBatch)
      .map((r) => r.name)
      .reverse();

    const reverted: string[] = [];
    for (const name of names) {
      const m = migrations.find((x) => x.name === name);
      if (m) await m.down();
      await this.conn().table(this.table).where("name", name).delete();
      reverted.push(name);
    }
    return reverted;
  }

  /** Annule toutes les migrations (tous les batches). */
  async reset(migrations: MigrationEntry[]): Promise<string[]> {
    const all: string[] = [];
    let batch = await this.rollback(migrations);
    while (batch.length) {
      all.push(...batch);
      batch = await this.rollback(migrations);
    }
    return all;
  }

  /** Reset puis run (recrée tout). */
  async refresh(migrations: MigrationEntry[]): Promise<void> {
    await this.reset(migrations);
    await this.run(migrations);
  }

  /** État de chaque migration (appliquée ou non). */
  async status(migrations: MigrationEntry[]): Promise<MigrationStatus[]> {
    await this.ensureTable();
    const rows = await this.rows();
    const byName = new Map(rows.map((r) => [r.name, Number(r.batch)]));
    return migrations.map((m) => ({
      name: m.name,
      ran: byName.has(m.name),
      batch: byName.get(m.name) ?? null,
    }));
  }
}
