import { describe, it, expect } from "vitest";
import { QueryBuilder, SQLiteGrammar } from "../src/index.js";

function qb() {
  return new QueryBuilder({} as any, new SQLiteGrammar()).from("t");
}

describe("QueryBuilder — construction fluide", () => {
  it("chaque méthode renvoie this (chaînage)", () => {
    const b = qb();
    expect(b.where("a", 1)).toBe(b);
    expect(b.orderBy("a")).toBe(b);
    expect(b.limit(5)).toBe(b);
  });

  it("offset + take/skip alias", () => {
    const { sql } = qb().take(5).skip(10).toSql();
    expect(sql).toContain("limit 5");
    expect(sql).toContain("offset 10");
  });

  it("groupBy + having", () => {
    const { sql, bindings } = qb()
      .select("status")
      .groupBy("status")
      .having("total", ">", 100)
      .toSql();
    expect(sql).toBe(
      'select "status" from "t" group by "status" having "total" > ?'
    );
    expect(bindings).toEqual([100]);
  });

  it("opérateur invalide -> throw", () => {
    expect(() => qb().where("a", "INVALID" as any, 1)).toThrow(/Opérateur invalide/);
  });

  it("whereRaw", () => {
    const { sql, bindings } = qb().whereRaw("length(name) > ?", [3]).toSql();
    expect(sql).toBe('select * from "t" where length(name) > ?');
    expect(bindings).toEqual([3]);
  });

  it("clone est indépendant", () => {
    const base = qb().where("a", 1);
    const cloned = base.clone().where("b", 2);
    expect(base.toSql().bindings).toEqual([1]);
    expect(cloned.toSql().bindings).toEqual([1, 2]);
  });
});
