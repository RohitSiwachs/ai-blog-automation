const axios = require('axios');

async function listModels() {
  const apiKey = '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';
  const url = 'https://integrate.api.nvidia.com/v1/models';

  console.log('Listing NVIDIA models with key from .env...');

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 seconds timeout
    });
    console.log('--- Success ---');
    console.log('Available Models Count:', response.data.data ? response.data.data.length : 0);
    if (response.data.data) {
        console.log('First 5 models:', response.data.data.slice(0, 5).map(m => m.id));
    }
  } catch (error) {
    console.log('--- Failed ---');
    console.error('Status:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

listModels();
