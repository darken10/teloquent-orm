import { describe, it, expect } from "vitest";
import { Model, Collection } from "../src/index.js";

class User extends Model {
  static override fillable = ["name", "email", "password"];
  static override hidden = ["password"];
  static override appends = ["display_name"];

  declare name: string;
  declare email: string;
  declare password: string;

  getDisplayNameAttribute(): string {
    return `★ ${this.getAttribute("name")}`;
  }
}

class Token extends Model {
  static override fillable = ["value", "secret_part"];
  static override visible = ["id", "value"]; // liste blanche
  declare value: string;
  declare secret_part: string;
}

class Post extends Model {
  static override fillable = ["title"];
  declare title: string;
}

function user() {
  return new User({ name: "Zoumana", email: "z@a.com", password: "secret" });
}

describe("Sérialisation", () => {
  it("hidden masque les champs sensibles", () => {
    const j = user().toJSON();
    expect(j.password).toBeUndefined();
    expect(j.name).toBe("Zoumana");
    expect(j.email).toBe("z@a.com");
  });

  it("appends ajoute les attributs calculés (accessor)", () => {
    expect(user().toJSON().display_name).toBe("★ Zoumana");
  });

  it("makeVisible force l'affichage d'un champ masqué (instance)", () => {
    const j = user().makeVisible("password").toJSON();
    expect(j.password).toBe("secret");
    // n'affecte pas les autres instances
    expect(user().toJSON().password).toBeUndefined();
  });

  it("makeHidden masque un champ pour l'instance", () => {
    const j = user().makeHidden("email").toJSON();
    expect(j.email).toBeUndefined();
    expect(j.name).toBe("Zoumana");
  });

  it("append ajoute un attribut calculé à l'instance", () => {
    class Plain extends Model {
      static override fillable = ["name"];
      getUpperAttribute(): string {
        return String(this.getAttribute("name")).toUpperCase();
      }
    }
    const p = new Plain({ name: "awa" });
    expect((p.toJSON() as any).upper).toBeUndefined();
    expect((p.append("upper").toJSON() as any).upper).toBe("AWA");
  });

  it("visible : liste blanche stricte", () => {
    const t = new Token({ value: "abc", secret_part: "xyz" });
    (t as any).setAttribute("id", 1);
    const j = t.toJSON();
    expect(j.value).toBe("abc");
    expect(j.id).toBe(1);
    expect(j.secret_part).toBeUndefined();
  });

  it("les relations chargées sont sérialisées et respectent hidden", () => {
    const u = user();
    u.setRelation("posts", Collection.fromArray([new Post({ title: "P1" }), new Post({ title: "P2" })]));
    const j = u.toJSON();
    expect(Array.isArray(j.posts)).toBe(true);
    expect((j.posts as unknown[]).length).toBe(2);
    expect(j.password).toBeUndefined();
  });

  it("une relation peut être masquée via hidden", () => {
    class Account extends Model {
      static override fillable = ["name"];
      static override hidden = ["secrets"];
      declare name: string;
    }
    const acc = new Account({ name: "X" });
    acc.setRelation("secrets", Collection.fromArray([new Post({ title: "S" })]));
    expect(acc.toJSON().secrets).toBeUndefined();
  });
});
