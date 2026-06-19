import { describe, it, expect } from "vitest";
import { Collection } from "../src/index.js";

interface Row {
  id: number;
  role: string;
}

const data: Row[] = [
  { id: 1, role: "admin" },
  { id: 2, role: "user" },
  { id: 3, role: "user" },
];

describe("Collection", () => {
  it("fromArray + first/last", () => {
    const c = Collection.fromArray(data);
    expect(c.length).toBe(3);
    expect(c.first()).toEqual({ id: 1, role: "admin" });
    expect(c.last()).toEqual({ id: 3, role: "user" });
  });

  it("collection vide", () => {
    const c = Collection.fromArray<Row>([]);
    expect(c.isEmpty()).toBe(true);
    expect(c.first()).toBeNull();
    expect(c.last()).toBeNull();
  });

  it("pluck", () => {
    expect(Collection.fromArray(data).pluck("id")).toEqual([1, 2, 3]);
  });

  it("keyBy", () => {
    const map = Collection.fromArray(data).keyBy("id");
    expect(map.get(2)).toEqual({ id: 2, role: "user" });
    expect(map.size).toBe(3);
  });

  it("groupBy", () => {
    const grouped = Collection.fromArray(data).groupBy("role");
    expect(grouped.get("user")?.length).toBe(2);
    expect(grouped.get("admin")?.length).toBe(1);
  });

  it("toJSON appelle toJSON des éléments", () => {
    const obj = { toJSON: () => ({ serialized: true }) };
    const c = Collection.fromArray([obj]);
    expect(c.toJSON()).toEqual([{ serialized: true }]);
  });
});
