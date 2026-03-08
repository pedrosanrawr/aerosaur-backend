import { QueryCommand, UpdateCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";

const DAILY_ANALYTICS_TABLE = process.env.DAILY_ANALYTICS_TABLE;
const CONTROL_TABLE = process.env.CONTROL_TABLE;

export async function getDailyStats(deviceId, fromDate) {
  const command = new QueryCommand({
    TableName: DAILY_ANALYTICS_TABLE,
    KeyConditionExpression: "DeviceId = :d AND #dt >= :from",
    ExpressionAttributeNames: {
      "#dt": "Date"
    },
    ExpressionAttributeValues: {
      ":d": deviceId,
      ":from": fromDate
    }
  });

  const result = await ddb.send(command);
  return result.Items || [];
}

async function getControlState(deviceId) {
  const command = new GetCommand({
    TableName: CONTROL_TABLE,
    Key: {
      DeviceId: deviceId
    }
  });

  const result = await ddb.send(command);
  return result.Item || {};
}

export async function updateDailyStats(deviceId, date, { aqi, isOn, smartMode }) {

  const onSeconds = isOn ? 5 : 0;
  const smartSeconds = smartMode ? onSeconds : 0;

  const command = new UpdateCommand({
    TableName: DAILY_ANALYTICS_TABLE,
    Key: {
      DeviceId: deviceId,
      Date: date
    },

    UpdateExpression: `
      SET
        totalAQI = if_not_exists(totalAQI, :zero) + :aqi,
        totalCount = if_not_exists(totalCount, :zero) + :one,
        peakAQI = if_not_exists(peakAQI, :aqi)
    `,

    ExpressionAttributeValues: {
      ":zero": 0,
      ":one": 1,
      ":aqi": aqi
    },

    ReturnValues: "ALL_NEW"
  });

  const result = await ddb.send(command);

  const currentPeak = result.Attributes.peakAQI ?? aqi;

  if (aqi > currentPeak) {
    await ddb.send(
      new UpdateCommand({
        TableName: DAILY_ANALYTICS_TABLE,
        Key: {
          DeviceId: deviceId,
          Date: date
        },
        UpdateExpression: "SET peakAQI = :p",
        ExpressionAttributeValues: {
          ":p": aqi
        }
      })
    );
  }

  await ddb.send(
    new UpdateCommand({
      TableName: DAILY_ANALYTICS_TABLE,
      Key: {
        DeviceId: deviceId,
        Date: date
      },
      UpdateExpression: `
        ADD
          totalOnSeconds :onSec,
          smartSeconds :smartSec,
          goodCount :good
      `,
      ExpressionAttributeValues: {
        ":onSec": onSeconds,
        ":smartSec": smartSeconds,
        ":good": aqi <= 100 ? 1 : 0
      }
    })
  );
}