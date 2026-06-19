import type { ConnectionConfig, Dialect, Driver } from "../types/index.js";
import { Connection } from "./Connection.js";
import { SQLiteDriver } from "./drivers/SQLiteDriver.js";
import { MySQLDriver } from "./drivers/MySQLDriver.js";
import { PostgresDriver } from "./drivers/PostgresDriver.js";
import { Grammar } from "../query/grammars/Grammar.js";
import { SQLiteGrammar } from "../query/grammars/SQLiteGrammar.js";
import { MySQLGrammar } from "../query/grammars/MySQLGrammar.js";
import { PostgresGrammar } from "../query/grammars/PostgresGrammar.js";

/**
 * Registre central des connexions (équivalent du DatabaseManager de Laravel).
 * Gère plusieurs connexions nommées et une connexion par défaut.
 */
export class ConnectionManager {
  private static connections = new Map<string, Connection>();
  private static defaultName = "default";

  /** Enregistre et ouvre une connexion. */
  static async addConnection(config: ConnectionConfig, name = "default"): Promise<Connection> {
    const driver = this.makeDriver(config);
    const grammar = this.makeGrammar(config.driver);
    const connection = new Connection(driver, grammar);
    await connection.connect();
    this.connections.set(name, connection);
    return connection;
  }

  /** Récupère une connexion (par défaut si non précisée). */
  static connection(name?: string): Connection {
    const key = name ?? this.defaultName;
    const conn = this.connections.get(key);
    if (!conn) {
      throw new Error(
        `Connexion "${key}" introuvable. Appelez ConnectionManager.addConnection() d'abord.`
      );
    }
    return conn;
  }

  static setDefault(name: string): void {
    this.defaultName = name;
  }

  static async closeAll(): Promise<void> {
    for (const conn of this.connections.values()) {
      await conn.disconnect();
    }
    this.connections.clear();
  }

  private static makeDriver(config: ConnectionConfig): Driver {
    switch (config.driver) {
      case "sqlite":
        return new SQLiteDriver(config);
      case "mysql":
        return new MySQLDriver(config);
      case "pgsql":
        return new PostgresDriver(config);
      default:
        throw new Error(`Driver non supporté : ${config.driver}`);
    }
  }

  private static makeGrammar(dialect: Dialect): Grammar {
    switch (dialect) {
      case "sqlite":
        return new SQLiteGrammar();
      case "mysql":
        return new MySQLGrammar();
      case "pgsql":
        return new PostgresGrammar();
      default:
        return new SQLiteGrammar();
    }
  }
}
