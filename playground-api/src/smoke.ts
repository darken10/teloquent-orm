/**
 * Smoke test : démarre l'API sur un port éphémère et exerce les endpoints
 * CRUD via fetch. Lancer :  npm run smoke
 */
import type { AddressInfo } from "node:net";
import { ConnectionManager } from "teloquent";
import { connect, fresh } from "./db.js";
import { createApp } from "./app.js";

async function main() {
  await connect();
  await fresh();

  const server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  const json = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  let ok = 0;
  let ko = 0;
  const check = (label: string, cond: boolean, extra?: unknown) => {
    if (cond) {
      ok++;
      console.log(`  ✓ ${label}`);
    } else {
      ko++;
      console.log(`  ✗ ${label}`, extra ?? "");
    }
  };

  console.log("\n# Smoke test API");

  const health = await json("GET", "/");
  check("GET /  -> ok", health.status === 200 && health.body.status === "ok");

  const list = await json("GET", "/users");
  check("GET /users -> 2 seedés", list.status === 200 && list.body.length === 2, list.body);

  const created = await json("POST", "/users", { name: "Idrissa", email: "id@africasys.com" });
  check("POST /users -> 201 + id", created.status === 201 && created.body.id > 0, created.body);
  const newId = created.body.id;

  const show = await json("GET", `/users/${newId}`);
  check("GET /users/:id -> bon nom", show.status === 200 && show.body.name === "Idrissa");

  const upd = await json("PUT", `/users/${newId}`, { name: "Idrissa K." });
  check("PUT /users/:id -> mis à jour", upd.status === 200 && upd.body.name === "Idrissa K.");

  const post = await json("POST", "/posts", {
    title: "Hello",
    body: "via API",
    user_id: newId,
  });
  check("POST /posts -> 201", post.status === 201 && post.body.id > 0);

  const postsWithAuthor = await json("GET", "/posts");
  const hasAuthor = postsWithAuthor.body.some((p: any) => p.author && p.author.name);
  check("GET /posts -> author chargé (eager)", postsWithAuthor.status === 200 && hasAuthor);

  const withPosts = await json("GET", "/users?with=posts");
  const someHasPosts = withPosts.body.some((u: any) => Array.isArray(u.posts) && u.posts.length > 0);
  check("GET /users?with=posts -> posts chargés", withPosts.status === 200 && someHasPosts);

  const del = await json("DELETE", `/users/${newId}`);
  check("DELETE /users/:id -> 204", del.status === 204);

  const after = await json("GET", `/users/${newId}`);
  check("GET supprimé -> 404", after.status === 404);

  server.close();
  await ConnectionManager.closeAll();

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
