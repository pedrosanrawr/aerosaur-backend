import crypto from "crypto";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";

const TABLE = process.env.NOTIFICATIONS_TABLE;
const SETTINGS_SK = "_SETTINGS";
const TOKEN_PREFIX = "_TOKEN_";
const NOTIFICATION_PREFIX = "N_";
const MAX_BATCH_WRITE = 25;

function assertTable() {
  if (!TABLE) {
    throw new Error("Missing env NOTIFICATIONS_TABLE");
  }
}

function chunk(items, size) {
  const groups = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

async function queryAllByPrefix(userId, prefix, limit = null) {
  const items = [];
  let lastEvaluatedKey;

  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: "UserId = :userId AND begins_with(CreatedAt, :prefix)",
        ExpressionAttributeValues: {
          ":userId": userId,
          ":prefix": prefix,
        },
        ScanIndexForward: false,
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: limit == null ? undefined : Math.max(Number(limit) - items.length, 1),
      })
    );

    items.push(...(result.Items ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey && (limit == null || items.length < Number(limit)));

  return limit == null ? items : items.slice(0, Number(limit));
}

export function getSettingsKey() {
  return SETTINGS_SK;
}

export function makeTokenKey(token) {
  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
  return `${TOKEN_PREFIX}${tokenHash}`;
}

export function makeNotificationKey(createdAt, id) {
  return `${NOTIFICATION_PREFIX}${createdAt}_${id}`;
}

export function isNotificationKey(key) {
  return typeof key === "string" && key.startsWith(NOTIFICATION_PREFIX);
}

export async function getSettings(userId) {
  assertTable();

  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { UserId: userId, CreatedAt: SETTINGS_SK },
    })
  );

  return result.Item ?? null;
}

export async function putSettings(userId, settings) {
  assertTable();

  const item = {
    UserId: userId,
    CreatedAt: SETTINGS_SK,
    entityType: "settings",
    settings,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: item,
    })
  );

  return item;
}

export async function getHistory(userId, limit = 50) {
  assertTable();
  return queryAllByPrefix(userId, NOTIFICATION_PREFIX, limit);
}

export async function putNotification(item) {
  assertTable();

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: item,
    })
  );

  return item;
}

export async function getNotification(userId, notificationId) {
  assertTable();

  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { UserId: userId, CreatedAt: notificationId },
    })
  );

  return result.Item ?? null;
}

export async function markAsRead(userId, notificationId) {
  assertTable();

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { UserId: userId, CreatedAt: notificationId },
        ConditionExpression: "attribute_exists(UserId) AND attribute_exists(CreatedAt)",
        UpdateExpression: "SET isRead = :isRead, readAt = :readAt",
        ExpressionAttributeValues: {
          ":isRead": true,
          ":readAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return result.Attributes ?? null;
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return null;
    }
    throw error;
  }
}

export async function markAllAsRead(userId) {
  const items = await queryAllByPrefix(userId, NOTIFICATION_PREFIX);
  const unread = items.filter((item) => !item.isRead);

  await Promise.all(
    unread.map((item) => markAsRead(userId, item.CreatedAt))
  );

  return { updatedCount: unread.length };
}

export async function clearHistory(userId) {
  assertTable();

  const items = await queryAllByPrefix(userId, NOTIFICATION_PREFIX);

  for (const batch of chunk(items, MAX_BATCH_WRITE)) {
    await ddb.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: batch.map((item) => ({
            DeleteRequest: {
              Key: {
                UserId: userId,
                CreatedAt: item.CreatedAt,
              },
            },
          })),
        },
      })
    );
  }

  return { deletedCount: items.length };
}

export async function listPushTokens(userId) {
  assertTable();
  return queryAllByPrefix(userId, TOKEN_PREFIX);
}

export async function putPushToken(userId, tokenData) {
  assertTable();

  const item = {
    UserId: userId,
    CreatedAt: makeTokenKey(tokenData.token),
    entityType: "push_token",
    ...tokenData,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: item,
    })
  );

  return item;
}

export async function deletePushToken(userId, token) {
  assertTable();

  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: {
        UserId: userId,
        CreatedAt: makeTokenKey(token),
      },
    })
  );

  return { removed: true };
}
