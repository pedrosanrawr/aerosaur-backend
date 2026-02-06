import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const DEVICES_TABLE = process.env.DEVICES_TABLE;

export const handler = async (event) => {
  const msg = Array.isArray(event) ? event[0] : event;

  const deviceId = msg.deviceId;
  if (!deviceId) {
    console.log("Missing deviceId in message:", JSON.stringify(event));
    return;
  }

  const lastSeen = new Date().toISOString();
  const online = msg.online !== false;

  await ddb.send(
    new UpdateCommand({
      TableName: DEVICES_TABLE,
      Key: { DeviceId: deviceId },
      UpdateExpression: "SET online = :o, lastSeen = :t",
      ExpressionAttributeValues: {
        ":o": online,
        ":t": lastSeen,
      },
    })
  );

  console.log("Updated connection:", { deviceId, online, lastSeen });
};
