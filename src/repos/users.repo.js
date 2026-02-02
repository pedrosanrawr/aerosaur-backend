import { ddb } from "../lib/ddb.js";
import { USERS_TABLE } from "../config/env.js";
import { GetCommand, PutCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

export async function getByUserId(userId) {
  const res = await ddb.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { UserId: userId },
  }));
  return res.Item || null;
}

export async function usernameTaken(username, myUid) {
  const res = await ddb.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: "UsernameIndex",
    KeyConditionExpression: "#U = :u",
    ExpressionAttributeNames: { "#U": "Username" },
    ExpressionAttributeValues: { ":u": username },
    Limit: 1,
  }));

  if (!res.Items?.length) return false;
  const owner = res.Items[0];
  return owner.UserId && owner.UserId !== myUid;
}

export async function createProfileIfNotExists({ userId, username }) {
  const now = new Date().toISOString();
  const item = {
    UserId: userId,
    Username: username,
    CreatedAt: now,
    UpdatedAt: now,
  };

  await ddb.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(UserId)",
  }));

  return item;
}

export async function updateUsername({ userId, username }) {
  const now = new Date().toISOString();

  const result = await ddb.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { UserId: userId },
    UpdateExpression: "SET #U = :u, UpdatedAt = :now",
    ExpressionAttributeNames: { "#U": "Username" },
    ExpressionAttributeValues: {
      ":u": username,
      ":now": now,
    },
    ConditionExpression: "attribute_exists(UserId)",
    ReturnValues: "ALL_NEW",
  }));

  return result.Attributes;
}
