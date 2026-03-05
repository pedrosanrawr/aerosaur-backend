import axios from 'axios';
import { PAYPAL_BASE_URL, PAYPAL_CLIENT_ID, PAYPAL_SECRET } from '../config/env.js';

async function getAccessToken() {
  const response = await axios.post(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_SECRET,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );
  return response.data.access_token;
}

export async function paypalRequest(method, endpoint, data = null) {
  const accessToken = await getAccessToken();
  const response = await axios({
    method,
    url: `${PAYPAL_BASE_URL}${endpoint}`,
    data,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return response.data;
}