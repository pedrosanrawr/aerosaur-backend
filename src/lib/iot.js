import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";

function getIotClient() {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  const endpoint = process.env.IOT_DATA_ENDPOINT; 
  // Example value you should set:
  // IOT_DATA_ENDPOINT = https://xxxxxxx-ats.iot.ap-southeast-1.amazonaws.com

  if (!region) throw new Error("Missing AWS_REGION");
  if (!endpoint) throw new Error("Missing IOT_DATA_ENDPOINT (must include https://)");

  return new IoTDataPlaneClient({ region, endpoint });
}

export async function publishFactoryReset(deviceId) {
  const client = getIotClient();

  const topic = `devices/${deviceId}/cmd`;
  const payload = {
    cmd: "factory_reset",
    reason: "unregistered",
    ts: new Date().toISOString(),
  };

  await client.send(
    new PublishCommand({
      topic,
      qos: 1,
      payload: Buffer.from(JSON.stringify(payload)),
    })
  );

  return { topic, payload };
}
