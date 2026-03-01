import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONTROL_TABLE = process.env.CONTROL_TABLE;
const DEVICES_TABLE = process.env.DEVICES_TABLE;

export const handler = async (event) => {
  const deviceId = event?.deviceId;
  const payload = event?.payload ?? event; 

  if (!deviceId) {
    console.log("Missing deviceId. Event:", JSON.stringify(event));
    return;
  }

  const devRes = await ddb.send(new GetCommand({
    TableName: DEVICES_TABLE,
    Key: { DeviceId: deviceId },
  }));

  if (!devRes.Item) {
    console.log("Unknown device:", deviceId);
    return;
  }

  const now = Date.now();

  const reported = {};
  if ("power" in payload) reported.reportedPower = !!payload.power;
  if ("fanSpeed" in payload) reported.reportedFanSpeed = String(payload.fanSpeed).toUpperCase();
  if ("smartMode" in payload) reported.reportedSmartMode = !!payload.smartMode;
  if ("autoAdjust" in payload) reported.reportedAutoAdjust = !!payload.autoAdjust;
  if ("autoOff" in payload) reported.reportedAutoOff = !!payload.autoOff;

  const cmdId = payload?.cmdId ?? payload?.commandId ?? null;

  const sets = ["#lastAckAt = :now", "#online = :true"];
  const names = { "#lastAckAt": "lastAckAt", "#online": "online" };
  const values = { ":now": now, ":true": true };

  if (cmdId) {
    sets.push("#lastAckCmdId = :cmdId");
    names["#lastAckCmdId"] = "lastAckCmdId";
    values[":cmdId"] = cmdId;
  }

  for (const [k, v] of Object.entries(reported)) {
    const nk = `#${k}`;
    const vk = `:${k}`;
    names[nk] = k;
    values[vk] = v;
    sets.push(`${nk} = ${vk}`);
  }

  await ddb.send(new UpdateCommand({
    TableName: CONTROL_TABLE,
    Key: { DeviceId: deviceId },
    UpdateExpression: "SET " + sets.join(", "),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));

  console.log("ACK processed for", deviceId, "cmdId:", cmdId);
};