const { docClient } = require('../lib/paymayaDynamoDBCLient');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const WEBHOOKS_TABLE = process.env.WEBHOOKS_TABLE;

const logWebhookEvent = async ({ paymentId, event, payload }) => {
  const item = {
    webhookId:  uuidv4(),
    paymentId,
    event,
    payload:    JSON.stringify(payload),
    receivedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({ TableName: WEBHOOKS_TABLE, Item: item }));
  return item;
};

module.exports = { logWebhookEvent };