import * as UsersRepo from "../repos/users.repo.js";

function normUsername(s) {
  return (s || "").trim();
}

async function generateUniqueUsername() {
  while (true) {
    const random = Math.floor(100000 + Math.random() * 900000);
    const candidate = `user${random}`;

    const taken = await UsersRepo.usernameTaken(candidate, null);
    if (!taken) return candidate;
  }
}

export async function upsertProfile({ userId, username }) {
  let u = normUsername(username);

  if (!u) {
    u = await generateUniqueUsername();
  }

  if (await UsersRepo.usernameTaken(u, userId)) {
    return { status: 409, body: { message: "Username already exists" } };
  }

  const existing = await UsersRepo.getByUserId(userId);

  if (!existing) {
    const created = await UsersRepo.createProfileIfNotExists({ userId, username: u });
    return { status: 201, body: { message: "Profile created", profile: created } };
  }

  const updated = await UsersRepo.updateUsername({ userId, username: u });
  return { status: 200, body: { message: "Profile updated", profile: updated } };
}

export async function getMe({ userId }) {
  const item = await UsersRepo.getByUserId(userId);
  if (!item) return { status: 404, body: { message: "Profile not found" } };
  return { status: 200, body: { profile: item } };
}
