const axios = require('axios');

const API_URL = 'http://localhost:3005/api/v1';
const credentials = {
    email: 'admin@checklist.local',
    password: 'Admin@123456'
};

async function getToken() {
    try {
        const loginRes = await axios.post(`${API_URL}/auth/login`, credentials);
        const { accessToken } = loginRes.data.data;
        console.log("Token:", accessToken);
        console.log("\nVerify with:");
        console.log(`curl -H "Authorization: Bearer ${accessToken}" ${API_URL}/auth/me`);

    } catch (error) {
        console.error(error.message);
        if (error.response) console.error(JSON.stringify(error.response.data));
    }
}

getToken();
