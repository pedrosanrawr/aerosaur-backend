const axios = require('axios');
const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || 'https://api.sandbox.paypal.com'; // Use sandbox for testing

async function getAccessToken() {
  const response = await axios.post(   
        `${PAYPAL_BASE}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
            auth:{
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            },
            headers:{ 
                'Content-Type': 'application/x-www-form-urlencoded'
            },
        }
    );
    return response.data.access_token;
}

async function paypalRequest(method, endpoint, data = null) {
    const accessToken = await getAccessToken();
    const response = await axios({ 
        method,
        url: `${PAYPAL_BASE}${endpoint}`,
        data,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data;   
}

