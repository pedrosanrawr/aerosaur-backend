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
  const res = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "DeviceId = :d AND begins_with(Timestamp, :pfx)",
      ExpressionAttributeValues: { ":d": deviceId, ":pfx": "R#" },
      ScanIndexForward: false,
      Limit: Number(limit),
    })
  );

  const items = res.Items ?? [];
  return items.filter((it) => {
    const ts = it.Timestamp?.slice(2);
    if (from && ts < from) return false;
    if (to && ts > to) return false;
    return true;
  });
}

export function makeRawSortKey(isoTs) {
  return `R#${isoTs}`;
}
