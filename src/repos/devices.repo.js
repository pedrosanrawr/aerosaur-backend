import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { DEVICES_TABLE } from "../config/env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export async function getById(deviceId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },
    })
  );
  return res.Item ?? null;
}

export async function listByOwner(userId) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: DEVICES_TABLE,
      IndexName: "OwnerUserIdIndex",
      KeyConditionExpression: "ownerUserId = :u",
      ExpressionAttributeValues: { ":u": userId },
    })
  );
  return res.Items ?? [];
}

export async function listOnlineDevices({ limit = 100, cursor } = {}) {
  const res = await ddb.send(
    new ScanCommand({
      TableName: DEVICES_TABLE,
      Limit: limit,
      ExclusiveStartKey: cursor,
      FilterExpression: "#on = :true AND attribute_exists(ownerUserId)",
      ExpressionAttributeNames: {
        "#on": "online",
      },
      ExpressionAttributeValues: {
        ":true": true,
      },
    })
  );

  return {
    items: res.Items ?? [],
    cursor: res.LastEvaluatedKey ?? null,
  };
}

export async function createProvisionedDevice({
  deviceId,
  name,
  createdAt,
}) {
  const item = {
    DeviceId: deviceId,
    name: name ?? deviceId,
    ownerUserId: null,
    online: false,
    lastSeen: null,
    createdAt: createdAt ?? new Date().toISOString(),
  };

  await ddb.send(
    new PutCommand({
      TableName: DEVICES_TABLE,
      Item: item,
      ConditionExpression: "attribute_not_exists(DeviceId)",
    })
  );

  return item;
}

export async function updateName(deviceId, name) {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },
      UpdateExpression: "SET #n = :name",
      ExpressionAttributeNames: { "#n": "name" },
      ExpressionAttributeValues: { ":name": name },
      ReturnValues: "ALL_NEW",
    })
  );
  return res.Attributes;
}

export async function bindOwnerAndMaybeRename(deviceId, ownerUserId, name) {
  const exprNames = {};
  const exprValues = {
    ":u": ownerUserId,
    ":boundAt": new Date().toISOString(),
  };

  let updateExpr = "SET ownerUserId = :u, boundAt = if_not_exists(boundAt, :boundAt)";

  if (name && typeof name === "string" && name.trim()) {
    exprNames["#n"] = "name";
    exprValues[":name"] = name.trim();
    updateExpr += ", #n = :name";
  }

  const res = await ddb.send(
    new UpdateCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },

      ConditionExpression:
        "attribute_not_exists(ownerUserId) OR ownerUserId = :nullOwner OR ownerUserId = :u",
      ExpressionAttributeValues: {
        ...exprValues,
        ":nullOwner": null,
      },
      ExpressionAttributeNames: Object.keys(exprNames).length ? exprNames : undefined,
      UpdateExpression: updateExpr,
      ReturnValues: "ALL_NEW",
    })
  );

  return res.Attributes;
}

export async function updateConnectionStatus(deviceId, { online, lastSeen }) {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },
      UpdateExpression: "SET #on = :o, lastSeen = :t",
      ExpressionAttributeNames: {
        "#on": "online",
      },
      ExpressionAttributeValues: {
        ":o": !!online,
        ":t": lastSeen ?? new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    })
  );
  return res.Attributes;
}

export async function markOfflineIfOnline(deviceId) {
  try {
    const res = await ddb.send(
      new UpdateCommand({
        TableName: DEVICES_TABLE,
        Key: { DeviceId: deviceId },
        ConditionExpression: "#on = :true",
        UpdateExpression: "SET #on = :false",
        ExpressionAttributeNames: {
          "#on": "online",
        },
        ExpressionAttributeValues: {
          ":true": true,
          ":false": false,
        },
        ReturnValues: "ALL_NEW",
      })
    );

    return res.Attributes ?? null;
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") {
      return null;
    }
    throw err;
  }
}

export async function getDeviceById(deviceId) {
  return getById(deviceId);
}

export async function unbindOwner(deviceId, ownerUserId) {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },

      ConditionExpression: "ownerUserId = :u",
      ExpressionAttributeValues: {
        ":u": ownerUserId,
        ":t": new Date().toISOString(),
        ":o": false,
        ":ls": null,
      },

      ExpressionAttributeNames: {
        "#on": "online",
      },

      UpdateExpression:
        "REMOVE ownerUserId SET unboundAt = :t, #on = :o, lastSeen = :ls",

      ReturnValues: "ALL_NEW",
    })
  );

  return res.Attributes;
}
