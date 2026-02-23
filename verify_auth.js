const axios = require('axios');

const API_URL = 'http://localhost:3005/api/v1';
const credentials = {
    email: 'admin@checklist.local',
    password: 'Admin@123456'
};

async function verifyAuth() {
    try {
        console.log('--- 1. Testing Login ---');
        const loginRes = await axios.post(`${API_URL}/auth/login`, credentials);
        const { accessToken, refreshToken, user } = loginRes.data.data;
        console.log('Login Successful!');
        console.log(`User: ${user.firstName} ${user.lastName} (${user.roles.join(', ')})`);

        const authHeader = { headers: { Authorization: `Bearer ${accessToken}` } };

        console.log('\n--- 2. Testing Authenticated Request (Get Me) ---');
        const meRes = await axios.get(`${API_URL}/auth/me`, authHeader);
        console.log('Me Response:', meRes.data.data.email);

        console.log('\n--- 3. Testing Protected Admin API (Get Users) ---');
        const usersRes = await axios.get(`${API_URL}/users`, authHeader);
        console.log(`Users count: ${usersRes.data.data.data.length}`);

        console.log('\n--- 4. Testing Logout ---');
        const logoutRes = await axios.post(`${API_URL}/auth/logout`, { refreshToken }, authHeader);
        console.log('Logout Response:', logoutRes.data.data.message);

        console.log('\n--- 5. Testing Access After Logout (Should Fail) ---');
        try {
            await axios.get(`${API_URL}/auth/me`, authHeader);
            console.error('FAILED: User could still access "me" after logout!');
        } catch (err) {
            console.log('SUCCESS: Access denied after logout as expected.');
            console.log(`Status: ${err.response.status} - ${err.response.data.error.message}`);
        }

        console.log('\n--- 6. Testing Token Reuse (Should Fail) ---');
        try {
            await axios.get(`${API_URL}/users`, authHeader);
            console.error('FAILED: User could still access "users" after logout!');
        } catch (err) {
            console.log('SUCCESS: Access denied after logout as expected.');
        }

    } catch (error) {
        console.error('Test failed with error:');
        if (error.response) {
            console.error(error.response.data);
        } else {
            console.error(error.message);
        }
    }
}

verifyAuth();
