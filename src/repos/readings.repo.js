import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const READINGS_TABLE = process.env.READINGS_TABLE;

export async function getReadings(deviceId, { limit = 100, lastEvaluatedKey = null } = {}) {
    const params = {
        TableName: READINGS_TABLE,
        KeyConditionExpression: "DeviceId = :deviceId",
        ExpressionAttributeValues: {
            ":deviceId": deviceId,
        },
        ScanIndexForward: false, // Descending order
        Limit: limit,
    };
    if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
    }
    const res = await ddb.send(new QueryCommand(params));
    return {
        items: res.Items || [],
        lastEvaluatedKey: res.LastEvaluatedKey || null,
    };
}