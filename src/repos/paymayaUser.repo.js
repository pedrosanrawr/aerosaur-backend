const { docClient } = require('../lib/paymayaDynamoDBCLient');
const { UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const USERS_TABLE = process.env.USERS_TABLE;

const grantPremiumAccess = async ({ userId, planId, expiresAt }) => {
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: `
      SET isPremium = :isPremium,
          premiumPlan = :planId,
          premiumExpiresAt = :expiresAt,
          updatedAt = :updatedAt
    `,
    ExpressionAttributeValues: {
      ':isPremium': true,
      ':planId':    planId,
      ':expiresAt': expiresAt,   
      ':updatedAt': new Date().toISOString(),
    },
  }));
};

const revokePremiumAccess = async (userId) => {
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: `
      SET isPremium = :isPremium,
          premiumPlan = :planId,
          premiumExpiresAt = :expiresAt,
          updatedAt = :updatedAt
    `,
    ExpressionAttributeValues: {
      ':isPremium': false,
      ':planId':    null,
      ':expiresAt': null,
      ':updatedAt': new Date().toISOString(),
    },
  }));
};

const getUserById = async (userId) => {
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));
  return result.Item || null;
};

module.exports = { grantPremiumAccess, revokePremiumAccess, getUserById };