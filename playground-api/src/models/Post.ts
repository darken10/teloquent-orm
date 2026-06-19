import { Model } from "teloquent";
import { User } from "./User.js";

export class Post extends Model {
  static override fillable = ["title", "body", "user_id"];

  declare id: number;
  declare title: string;
  declare body: string;
  declare user_id: number;

  /** Un article appartient à un utilisateur. */
  author() {
    return this.belongsTo(User, "user_id");
  }
}
