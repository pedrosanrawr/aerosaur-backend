import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CONTROL_TABLE = process.env.CONTROL_TABLE;
const DEVICES_TABLE = process.env.DEVICES_TABLE;

function normalizeReportedFanSpeed(payload) {
  if ("fanSpeed" in payload && payload.fanSpeed != null) {
    const normalized = String(payload.fanSpeed).toUpperCase();
    return normalized === "OFF" ? "OFF" : normalized;
  }

  if (!("fan_speed" in payload)) return null;

  const numeric = Number(payload.fan_speed);
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= 0) return "OFF";
  if (numeric >= 60) return "FAST";
  if (numeric >= 41) return "MODERATE";
  if (numeric >= 40) return "SLOW";
  return null;
}

function parseReportedBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "enabled", "active"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "off", "disabled", "inactive"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

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
  const reportedPower = parseReportedBoolean(payload.power);
  if ("power" in payload && reportedPower !== null) reported.reportedPower = reportedPower;
  const reportedFanSpeed = normalizeReportedFanSpeed(payload);
  if (reportedFanSpeed) reported.reportedFanSpeed = reportedFanSpeed;
  const reportedSmartMode = parseReportedBoolean(payload.smartMode);
  if ("smartMode" in payload && reportedSmartMode !== null) reported.reportedSmartMode = reportedSmartMode;
  const reportedAutoAdjust = parseReportedBoolean(payload.autoAdjust);
  if ("autoAdjust" in payload && reportedAutoAdjust !== null) reported.reportedAutoAdjust = reportedAutoAdjust;
  const reportedAutoOff = parseReportedBoolean(payload.autoOff);
  if ("autoOff" in payload && reportedAutoOff !== null) reported.reportedAutoOff = reportedAutoOff;

  const cmdId = payload?.cmdId ?? payload?.commandId ?? null;
const clearedWifiCredentials = payload?.clearWifiCredentials === true;

const sets = ["#lastAckAt = :now", "#online = :true"];
const names = { "#lastAckAt": "lastAckAt", "#online": "online" };
const values = { ":now": now, ":true": true };

if (cmdId) {
  sets.push("#lastAckCmdId = :cmdId");
  names["#lastAckCmdId"] = "lastAckCmdId";
  values[":cmdId"] = cmdId;
}

if (clearedWifiCredentials) {
  sets.push("#lastClearWifiCredentialsAckAt = :now");
  names["#lastClearWifiCredentialsAckAt"] = "lastClearWifiCredentialsAckAt";
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



