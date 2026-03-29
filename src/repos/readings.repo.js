import { ddb } from "../lib/ddb.js";
import { QueryCommand, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const TABLE = process.env.READINGS_TABLE;
export const LATEST_SK = "LATEST";

export async function getLatestDisplayItem(deviceId) {
  const res = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { DeviceId: deviceId, Timestamp: LATEST_SK } })
  );
  return res.Item ?? null;
}

export async function putLatestItem(item) {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
}

export async function putRawItem(item) {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
}

export async function queryRaw(deviceId, { from, to, limit = 200 } = {}) {
  const fromKey = makeRawSortKey(from || "0000-01-01T00:00:00.000Z");
  const toKey = makeRawSortKey(to || "9999-12-31T23:59:59.999Z");

  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "DeviceId = :d AND Timestamp BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":d": deviceId,
        ":from": fromKey,
        ":to": toKey,
      },
      ScanIndexForward: false,
      Limit: Number(limit),
    })
  );

  return res.Items ?? [];
}

export async function getRecentReadings(deviceId, limit = 5) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "DeviceId = :d AND begins_with(Timestamp, :pfx)",
      ExpressionAttributeValues: {
        ":d": deviceId,
        ":pfx": "R#",
      },
      ScanIndexForward: false,
      Limit: Number(limit),
    })
  );

  return res.Items ?? [];
}

export function makeRawSortKey(isoTs) {
  return `R#${isoTs}`;
}
