
const axios = require('axios');

async function debug() {
  const url = 'https://image.pollinations.ai/prompt/test';
  console.log(`Connecting to ${url}...`);
  try {
    const res = await axios.get(url, { timeout: 10000 });
    console.log(`Connected! Status: ${res.status}`);
  } catch (e) {
    console.log(`Connection Failed: ${e.message}`);
    if (e.code) console.log(`Error Code: ${e.code}`);
    if (e.response) {
      console.log(`Response Status: ${e.response.status}`);
      console.log(`Response Data: ${e.response.data.toString().substring(0, 100)}`);
    }
  }
}

debug();
