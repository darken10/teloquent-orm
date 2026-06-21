import { describe, it, expect } from "vitest";
import {
  QueryBuilder,
  SQLiteGrammar,
  MySQLGrammar,
  PostgresGrammar,
} from "../src/index.js";

/** Construit un QueryBuilder sans vraie connexion (toSql n'utilise que la grammar). */
function qb(grammar: any) {
  return new QueryBuilder({} as any, grammar).from("users");
}

describe("Grammar — SELECT (SQLite)", () => {
  const g = new SQLiteGrammar();

  it("select simple", () => {
    expect(qb(g).toSql().sql).toBe('select * from "users"');
  });

  it("colonnes + where + order + limit", () => {
    const { sql, bindings } = qb(g)
      .select("id", "name")
      .where("age", ">", 18)
      .orderBy("name", "desc")
      .limit(10)
      .toSql();
    expect(sql).toBe(
      'select "id", "name" from "users" where "age" > ? order by "name" desc limit 10'
    );
    expect(bindings).toEqual([18]);
  });

  it("where par défaut = égalité", () => {
    const { sql, bindings } = qb(g).where("email", "a@b.com").toSql();
    expect(sql).toBe('select * from "users" where "email" = ?');
    expect(bindings).toEqual(["a@b.com"]);
  });

  it("whereIn / whereNull / between / orWhere", () => {
    const { sql, bindings } = qb(g)
      .whereIn("id", [1, 2, 3])
      .whereNull("deleted_at")
      .whereBetween("age", [18, 30])
      .orWhere("role", "admin")
      .toSql();
    expect(sql).toBe(
      'select * from "users" where "id" in (?, ?, ?) and "deleted_at" is null ' +
        'and "age" between ? and ? or "role" = ?'
    );
    expect(bindings).toEqual([1, 2, 3, 18, 30, "admin"]);
  });

  it("whereIn vide -> 0 = 1", () => {
    expect(qb(g).whereIn("id", []).toSql().sql).toBe('select * from "users" where 0 = 1');
  });

  it("join + distinct", () => {
    const { sql } = qb(g)
      .distinct()
      .join("posts", "posts.user_id", "=", "users.id")
      .toSql();
    expect(sql).toBe(
      'select distinct * from "users" inner join "posts" on "posts"."user_id" = "users"."id"'
    );
  });
});

describe("Grammar — quoting & placeholders par dialecte", () => {
  it("MySQL utilise les backticks", () => {
    const { sql } = qb(new MySQLGrammar()).where("age", ">", 1).toSql();
    expect(sql).toBe("select * from `users` where `age` > ?");
  });

  it("Postgres utilise $1, $2...", () => {
    const { sql, bindings } = qb(new PostgresGrammar())
      .where("age", ">", 18)
      .where("name", "Inoussa ZERBO")
      .toSql();
    expect(sql).toBe('select * from "users" where "age" > $1 and "name" = $2');
    expect(bindings).toEqual([18, "Inoussa ZERBO"]);
  });
});

describe("Grammar — INSERT / UPDATE / DELETE", () => {
  const g = new SQLiteGrammar();

  it("insert simple", () => {
    const { sql, bindings } = g.compileInsert("users", [{ name: "A", email: "a@b.com" }]);
    expect(sql).toBe('insert into "users" ("name", "email") values (?, ?)');
    expect(bindings).toEqual(["A", "a@b.com"]);
  });

  it("insert multiple", () => {
    const { sql, bindings } = g.compileInsert("users", [{ name: "A" }, { name: "B" }]);
    expect(sql).toBe('insert into "users" ("name") values (?), (?)');
    expect(bindings).toEqual(["A", "B"]);
  });

  it("update avec where", () => {
    const components = qb(g).where("id", 5).getComponents();
    const { sql, bindings } = g.compileUpdate(components, { name: "X" });
    expect(sql).toBe('update "users" set "name" = ? where "id" = ?');
    expect(bindings).toEqual(["X", 5]);
  });

  it("delete avec where", () => {
    const components = qb(g).where("id", 5).getComponents();
    const { sql, bindings } = g.compileDelete(components);
    expect(sql).toBe('delete from "users" where "id" = ?');
    expect(bindings).toEqual([5]);
  });

  it("insert Postgres -> $1, $2", () => {
    const { sql } = new PostgresGrammar().compileInsert("users", [{ name: "A", email: "b" }]);
    expect(sql).toBe('insert into "users" ("name", "email") values ($1, $2)');
  });
});

describe("Grammar — increment / upsert", () => {
  const g = new SQLiteGrammar();

  it("increment", () => {
    const components = qb(g).where("id", 1).getComponents();
    const { sql, bindings } = g.compileIncrement(components, "votes", 3);
    expect(sql).toBe('update "users" set "votes" = "votes" + ? where "id" = ?');
    expect(bindings).toEqual([3, 1]);
  });

  it("decrement avec extra", () => {
    const components = qb(g).where("id", 1).getComponents();
    const { sql, bindings } = g.compileIncrement(components, "votes", 2, { updated_at: "now" }, true);
    expect(sql).toBe('update "users" set "votes" = "votes" - ?, "updated_at" = ? where "id" = ?');
    expect(bindings).toEqual([2, "now", 1]);
  });

  it("upsert SQLite/Postgres (on conflict ... excluded)", () => {
    const { sql } = g.compileUpsert("users", [{ email: "a", name: "A" }], ["email"], ["name"]);
    expect(sql).toBe(
      'insert into "users" ("email", "name") values (?, ?) ' +
        'on conflict ("email") do update set "name" = excluded."name"'
    );
  });

  it("upsert MySQL (on duplicate key update)", () => {
    const { sql } = new MySQLGrammar().compileUpsert("users", [{ email: "a", name: "A" }], ["email"], ["name"]);
    expect(sql).toBe(
      "insert into `users` (`email`, `name`) values (?, ?) " +
        "on duplicate key update `name` = values(`name`)"
    );
  });
});

describe("Grammar — where imbriqué / colonne", () => {
  const g = new SQLiteGrammar();

  it("where imbriqué (closure) produit un groupe parenthésé", () => {
    const { sql, bindings } = qb(g)
      .where("a", 1)
      .where((q) => q.where("b", 2).orWhere("c", 3))
      .toSql();
    expect(sql).toBe('select * from "users" where "a" = ? and ("b" = ? or "c" = ?)');
    expect(bindings).toEqual([1, 2, 3]);
  });

  it("whereColumn ne lie aucune valeur", () => {
    const { sql, bindings } = qb(g).whereColumn("hi", ">", "lo").toSql();
    expect(sql).toBe('select * from "users" where "hi" > "lo"');
    expect(bindings).toEqual([]);
  });

  it("Postgres : numérotation correcte avec groupe imbriqué", () => {
    const { sql, bindings } = qb(new PostgresGrammar())
      .where("a", 1)
      .where((q) => q.where("b", 2))
      .toSql();
    expect(sql).toBe('select * from "users" where "a" = $1 and ("b" = $2)');
    expect(bindings).toEqual([1, 2]);
  });
});

describe("Grammar — agrégats", () => {
  it("count(*) as aggregate", () => {
    const g = new SQLiteGrammar();
    const components = qb(g).where("is_active", true).getComponents();
    components.aggregate = { fn: "count", column: "*" };
    const { sql } = g.compileSelect(components);
    expect(sql).toBe('select count(*) as "aggregate" from "users" where "is_active" = ?');
  });
});
