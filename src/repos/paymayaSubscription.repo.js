import { ddb } from '../lib/paymayaDynamoDBCLient.js';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const PAYMAYA_TABLE = process.env.PAYMAYA_TABLE;

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
    FilterExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':status': 'ACTIVE',
    },
    Limit: 1,
  }));
  return result.Items?.[0] || null;
};

export const updatePaymentStatus = async (userId, paymentId, status, planId = null) => {
  await ddb.send(new UpdateCommand({
    TableName: PAYMAYA_TABLE,
    Key: { userId, paymentId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, planId = :planId',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status':    status,
      ':updatedAt': new Date().toISOString(),
      ':planId':    planId,
    },
  }));
};