const {DynamoDBClient}= require('@aws-sdk/client-dynamodb');
const {
    DynamoDBDocumentClient, 
    PutCommand, 
    GetCommand,
    UpdateCommand
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({region: 'us-east-1'});//paltan mo nalang yung AWS region dito
const dynamo = DynamoDBDocumentClient.from(client);

const TABLE = 'BillingSubscriptions';

async function saveSubscription(userId, subscriptionId, planId, status, approvalUrl){
    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: {
            userId,
            subscriptionId,
            planId,
            status,
            approvalUrl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    }));
}

async function getSubscriptionByUserId(userId){
    const result = await dynamo.send(new GetCommand({
       TableName: TABLE,
       KeyConditionExpression: 'userId = :uid AND begins_with(subscriptionId, :sub)',
         ExpressionAttributeValues: {
              ':uid': 'USER#${userId}',
              ':sub': 'subscription#',
         }
    }));
    return result.Items ? result.Items[0] : null;
}

async function updateSubscriptionStatus(userId,subscriptionId, status){
    await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: {
            userId: userId,
            subscriptionId: subscriptionId,
        },
        UpdateExpression: 'SET #status =:status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#status': status,
            ':updatedAt': new Date().toISOString(),
        },
    }));

}

module.exports = {
    saveSubscription,
    getSubscriptionByUserId,
    updateSubscriptionStatus
}