import express, { type Request, type Response, type NextFunction } from "express";
import { User } from "./models/User.js";
import { Post } from "./models/Post.js";

/** Enveloppe async -> renvoie les erreurs au middleware. */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

/** Construit l'application Express (sans écouter de port). */
export function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({ name: "Teloquent Playground API", status: "ok" });
  });

  // ----- users
  app.get(
    "/users",
    wrap(async (req, res) => {
      const q = req.query.with === "posts" ? User.with("posts") : User.query();
      const users = await q.orderBy("id").get();
      res.json(users.toJSON());
    })
  );

  app.post(
    "/users",
    wrap(async (req, res) => {
      const user = await User.create(req.body);
      res.status(201).json(user.toJSON());
    })
  );

  app.get(
    "/users/:id",
    wrap(async (req, res) => {
      const user = await User.with("posts").where("id", Number(req.params.id)).first();
      if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
      res.json(user.toJSON());
    })
  );

  app.put(
    "/users/:id",
    wrap(async (req, res) => {
      const user = await User.find(Number(req.params.id));
      if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
      await user.update(req.body);
      res.json(user.toJSON());
    })
  );

  app.delete(
    "/users/:id",
    wrap(async (req, res) => {
      const user = await User.find(Number(req.params.id));
      if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
      await user.delete();
      res.status(204).end();
    })
  );

  // ----- posts
  app.get(
    "/posts",
    wrap(async (_req, res) => {
      const posts = await Post.with("author").orderBy("id").get();
      res.json(posts.toJSON());
    })
  );

  app.post(
    "/posts",
    wrap(async (req, res) => {
      const post = await Post.create(req.body);
      res.status(201).json(post.toJSON());
    })
  );

  app.get(
    "/posts/:id",
    wrap(async (req, res) => {
      const post = await Post.with("author").where("id", Number(req.params.id)).first();
      if (!post) return res.status(404).json({ error: "Article introuvable" });
      res.json(post.toJSON());
    })
  );

  // ----- erreurs
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
