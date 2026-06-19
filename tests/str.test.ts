import { describe, it, expect } from "vitest";
import { snake, studly, plural, tableName, foreignKey } from "../src/support/str.js";

describe("support/str", () => {
  it("snake", () => {
    expect(snake("BlogPost")).toBe("blog_post");
    expect(snake("userName")).toBe("user_name");
    expect(snake("HTTPServer")).toBe("httpserver"); // limite connue : majuscules consécutives
    expect(snake("already_snake")).toBe("already_snake");
  });

  it("studly", () => {
    expect(studly("blog_post")).toBe("BlogPost");
    expect(studly("display name")).toBe("DisplayName");
    expect(studly("is-active")).toBe("IsActive");
  });

  it("plural", () => {
    expect(plural("post")).toBe("posts");
    expect(plural("category")).toBe("categories");
    expect(plural("box")).toBe("boxes");
    expect(plural("class")).toBe("classes");
    expect(plural("day")).toBe("days"); // voyelle avant y
  });

  it("tableName", () => {
    expect(tableName("User")).toBe("users");
    expect(tableName("BlogPost")).toBe("blog_posts");
    expect(tableName("Category")).toBe("categories");
  });

  it("foreignKey", () => {
    expect(foreignKey("User")).toBe("user_id");
    expect(foreignKey("BlogPost")).toBe("blog_post_id");
  });
});
