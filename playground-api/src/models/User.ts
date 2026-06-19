import { Model } from "teloquent";
import { Post } from "./Post.js";

export class User extends Model {
  static override casts = { is_active: "boolean" as const };
  static override fillable = ["name", "email", "is_active"];

  declare id: number;
  declare name: string;
  declare email: string;
  declare is_active: boolean;

  /** Un utilisateur a plusieurs articles. */
  posts() {
    return this.hasMany(Post);
  }
}
