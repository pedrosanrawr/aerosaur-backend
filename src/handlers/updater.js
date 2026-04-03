import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import * as DevicesRepo from "../repos/devices.repo.js";
import * as NotificationsService from "../services/notifications.service.js";

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
  const before = await DevicesRepo.getById(deviceId);

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

  if (before && before.ownerUserId && before.online !== online) {
    try {
      await NotificationsService.emitDeviceConnectivityNotification({
        device: { ...before, online, lastSeen },
        online,
      });
    } catch (err) {
      console.warn("Device connectivity notification failed:", err.message);
    }
  }

  console.log("Updated connection:", { deviceId, online, lastSeen });
};
