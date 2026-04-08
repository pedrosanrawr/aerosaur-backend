import { ddb } from '../lib/paymayaDynamoDBCLient.js';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getPlan } from '../lib/paymayaPlanConfig.js';

const PAYMAYA_TABLE = process.env.PAYMAYA_TABLE;

const timeValue = (value) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const statusScore = (item) => {
  switch ((item?.status || '').toUpperCase()) {
    case 'ACTIVE':
      return 5;
    case 'CANCELLED':
      return item?.expiresAt && timeValue(item.expiresAt) > Date.now() ? 4 : 2;
    case 'PENDING':
      return 3;
    case 'FAILED':
    case 'EXPIRED':
    default:
      return 0;
  }
};

export const savePayment = async (item) => {
  await ddb.send(new PutCommand({
    TableName: PAYMAYA_TABLE,
    ConditionExpression: 'attribute_not_exists(paymentId)',
    Item: item,
  }));
  return item;
};

export const getPaymentByUserAndId = async (userId, paymentId) => {
  const result = await ddb.send(new GetCommand({
    TableName: PAYMAYA_TABLE,
    Key: { userId, paymentId },
  }));
  return result.Item || null;
};

export const getActivePaymentByUserId = async (userId) => {
  const result = await ddb.send(new QueryCommand({
    TableName: PAYMAYA_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  }));

  const items = result.Items || [];
  items.sort((a, b) => {
    const statusDelta = statusScore(b) - statusScore(a);
    if (statusDelta !== 0) return statusDelta;

    const updatedDelta = timeValue(b.updatedAt) - timeValue(a.updatedAt);
    if (updatedDelta !== 0) return updatedDelta;

    return timeValue(b.createdAt) - timeValue(a.createdAt);
  });
  return items[0] || null;
};

export const updatePaymentStatus = async (userId, paymentId, status, planId = null) => {
  const current = await getPaymentByUserAndId(userId, paymentId);
  let expiresAt = current?.expiresAt || null;

  if (status === 'ACTIVE' && planId) {
    try {
      const plan = getPlan(planId);
      expiresAt = new Date(Date.now() + plan.durationDays * 24 * 60 * 60 * 1000).toISOString();
    } catch (e) {
      console.warn('Could not calculate expiresAt for planId:', planId);
    }
  } else if (status === 'EXPIRED' || status === 'FAILED') {
    expiresAt = null;
  }

  await ddb.send(new UpdateCommand({
    TableName: PAYMAYA_TABLE,
    Key: { userId, paymentId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, planId = :planId, expiresAt = :expiresAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status':    status,
      ':updatedAt': new Date().toISOString(),
      ':planId':    planId ?? current?.planId ?? null,
      ':expiresAt': expiresAt,
    },
  }));
};
