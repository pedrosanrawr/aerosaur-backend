import { QueryCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";

const DAILY_ANALYTICS_TABLE = process.env.DAILY_ANALYTICS_TABLE;
const MAX_SAMPLE_INTERVAL_SEC = 300;

export async function getDailyStats(deviceId, fromDate) {
  const command = new QueryCommand({
    TableName: DAILY_ANALYTICS_TABLE,
    KeyConditionExpression: "DeviceId = :d AND #dt >= :from",
    ExpressionAttributeNames: {
      "#dt": "Date",
    },
    ExpressionAttributeValues: {
      ":d": deviceId,
      ":from": fromDate,
    },
  });

  const result = await ddb.send(command);
  return result.Items || [];
}

export async function updateDailyStats(
  deviceId,
  date,
  { aqi, isOn, smartMode, sampledAtSec }
) {
  const current = await ddb.send(
    new GetCommand({
      TableName: DAILY_ANALYTICS_TABLE,
      Key: {
        DeviceId: deviceId,
        Date: date,
      },
    })
  );

  const existing = current.Item || {};
  const prevSampleTs = existing.lastSampleTs;

  const elapsedSec =
    Number.isFinite(prevSampleTs) && sampledAtSec > prevSampleTs
      ? Math.min(sampledAtSec - prevSampleTs, MAX_SAMPLE_INTERVAL_SEC)
      : 0;

  const onSeconds = isOn ? elapsedSec : 0;
  const smartSeconds = smartMode && isOn ? elapsedSec : 0;
  const peakAQI = Math.max(existing.peakAQI ?? aqi, aqi);

  await ddb.send(
    new UpdateCommand({
      TableName: DAILY_ANALYTICS_TABLE,
      Key: {
        DeviceId: deviceId,
        Date: date,
      },
      UpdateExpression: `
        SET
          totalAQI = if_not_exists(totalAQI, :zero) + :aqi,
          totalCount = if_not_exists(totalCount, :zero) + :one,
          peakAQI = :peakAQI,
          totalOnSeconds = if_not_exists(totalOnSeconds, :zero) + :onSec,
          smartSeconds = if_not_exists(smartSeconds, :zero) + :smartSec,
          goodCount = if_not_exists(goodCount, :zero) + :good,
          lastSampleTs = :sampledAtSec,
          lastIsOn = :isOn,
          lastSmartMode = :smartMode
      `,
      ExpressionAttributeValues: {
        ":zero": 0,
        ":one": 1,
        ":aqi": aqi,
        ":peakAQI": peakAQI,
        ":onSec": onSeconds,
        ":smartSec": smartSeconds,
        ":good": aqi <= 100 ? 1 : 0,
        ":sampledAtSec": sampledAtSec,
        ":isOn": !!isOn,
        ":smartMode": !!smartMode,
      },
    })
  );
}
