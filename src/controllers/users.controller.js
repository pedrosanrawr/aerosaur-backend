import { json } from "../lib/response.js";
import * as UsersService from "../services/users.service.js";

export async function getMe(event, ctx) {
  const result = await UsersService.getMe({ userId: ctx.userId });
  return json(result.status, result.body);
}

export async function upsertProfile(event, ctx) {
  const result = await UsersService.upsertProfile({
    userId: ctx.userId,
    username: ctx.body?.username,
  });
  return json(result.status, result.body);
}
