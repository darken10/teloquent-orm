import { Schema, type SchemaBuilder } from "./SchemaBuilder.js";

/**
 * Base de migration. À étendre :
 *
 *   export class CreateUsersTable extends Migration {
 *     async up() {
 *       await this.schema.create("users", (t) => {
 *         t.increments("id");
 *         t.string("name");
 *         t.timestamps();
 *       });
 *     }
 *     async down() {
 *       await this.schema.dropIfExists("users");
 *     }
 *   }
 */
export abstract class Migration {
  protected get schema(): SchemaBuilder {
    return Schema(this.connectionName);
  }

  protected connectionName?: string;

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}
