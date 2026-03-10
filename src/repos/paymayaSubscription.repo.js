const { ddb } = require('../lib/paymayaDynamoDBCLient');
const { PutCommand, GetCommand, UpdateCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE;

const createSubscription = async (item) => {
  await ddb.send(new PutCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    ConditionExpression: 'attribute_not_exists(paymentId)',
    Item: item,
  }));
  return item;
};

const getSubscriptionByPaymentId = async (paymentId) => {
  const result = await ddb.send(new GetCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { paymentId },
  }));
  return result.Item || null;
};

const getActiveSubscriptionByUserId = async (userId) => {
  const result = await ddb.send(new QueryCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    IndexName: 'userId-index',
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

const updateSubscriptionStatus = async (paymentId, status, extra = {}) => {
  await ddb.send(new UpdateCommand({
    TableName: SUBSCRIPTIONS_TABLE,
    Key: { paymentId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':status':    status,
      ':updatedAt': new Date().toISOString(),
      ...extra,
    },
  }));
};

module.exports = {
  createSubscription,
  getSubscriptionByPaymentId,
  getActiveSubscriptionByUserId,
  updateSubscriptionStatus,
};