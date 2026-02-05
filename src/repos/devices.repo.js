import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
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

export async function upsertDevice(item) {
  await ddb.send(
    new PutCommand({
      TableName: DEVICES_TABLE,
      Item: item,
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

export async function bindOwner(deviceId, ownerUserId) {
  const res = await ddb.send(
    new UpdateCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },
      UpdateExpression: "SET ownerUserId = :u",
      ExpressionAttributeValues: { ":u": ownerUserId },
      ReturnValues: "ALL_NEW",
    })
  );
  return res.Attributes;
}
