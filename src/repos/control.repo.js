import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONTROL_TABLE = process.env.CONTROL_TABLE;
const DEVICES_TABLE = process.env.DEVICES_TABLE;

export async function getDevice(deviceId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },
    })
  );
  return res.Item ?? null;
}

export async function getControl(deviceId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: CONTROL_TABLE,
      Key: { DeviceId: deviceId },
    })
  );
  return res.Item ?? null;
}

export async function upsertControl(deviceId, patch) {
  const now = Date.now();

  // Build update expression dynamically
  const sets = [];
  const names = {};
  const values = { ":now": now };

  for (const [k, v] of Object.entries(patch)) {
    const nameKey = `#${k}`;
    const valueKey = `:${k}`;
    names[nameKey] = k;
    values[valueKey] = v;
    sets.push(`${nameKey} = ${valueKey}`);
  }

  sets.push("#updatedAt = :now");
  names["#updatedAt"] = "updatedAt";

  const res = await ddb.send(
    new UpdateCommand({
      TableName: CONTROL_TABLE,
      Key: { DeviceId: deviceId },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  return res.Attributes;
}