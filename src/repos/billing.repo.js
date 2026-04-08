import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb } from '../lib/ddb.js'; // ✅ reuse existing DynamoDB client
import { BILLING_TABLE } from '../config/env.js';

function _timeValue(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function _statusScore(item) {
  switch ((item?.status || '').toUpperCase()) {
    case 'ACTIVE':
      return 5;
    case 'CANCELLED':
      return item?.expiresAt && _timeValue(item.expiresAt) > Date.now() ? 4 : 2;
    case 'PENDING':
      return 3;
    case 'SUSPENDED':
      return 1;
    case 'EXPIRED':
    case 'PAYMENT_FAILED':
    default:
      return 0;
  }
}

export async function saveSubscription(
  userId,
  subscriptionId,
  planId,
  status,
  approvalUrl,
  expiresAt = null
) {
  await ddb.send(
    new PutCommand({
      TableName: BILLING_TABLE,
      Item: {
        userId,
        subscriptionId,
        planId,
        status,
        approvalUrl,
        expiresAt,
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
  const items = result.Items || [];
  if (items.length === 0) return null;

  items.sort((a, b) => {
    const statusDelta = _statusScore(b) - _statusScore(a);
    if (statusDelta !== 0) return statusDelta;

    const updatedDelta = _timeValue(b.updatedAt) - _timeValue(a.updatedAt);
    if (updatedDelta !== 0) return updatedDelta;

    return _timeValue(b.createdAt) - _timeValue(a.createdAt);
  });

  return items[0];
}

export async function updateSubscriptionStatus(
  userId,
  subscriptionId,
  status,
  expiresAt = null
) {
  await ddb.send(
    new UpdateCommand({
      TableName: BILLING_TABLE,
      Key: {
        userId,
        subscriptionId,
      },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, expiresAt = :expiresAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':updatedAt': new Date().toISOString(),
        ':expiresAt': expiresAt,
      },
    })
  );
}
