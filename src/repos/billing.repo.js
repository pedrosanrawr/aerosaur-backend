import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb.js'; // ✅ reuse existing DynamoDB client
import { BILLING_TABLE } from '../config/env.js';

export async function saveSubscription(userId, subscriptionId, planId, status, approvalUrl) {
  await ddb.send(
    new PutCommand({
      TableName: BILLING_TABLE,
      Item: {
        userId,
        subscriptionId,
        planId,
        status,
        approvalUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  );
}

export async function getSubscriptionByUserId(userId) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: BILLING_TABLE,
      KeyConditionExpression: 'userId = :uid',
      ExpressionAttributeValues: {
        ':uid': userId,
      },
    })
  );
  return result.Items?.[0] || null;
}

export async function updateSubscriptionStatus(userId, subscriptionId, status) {
  await ddb.send(
    new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: {
        userId,
        subscriptionId,
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );
}