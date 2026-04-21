const axios = require('axios');

async function listModels() {
  const apiKey = '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';
  const url = 'https://integrate.api.nvidia.com/v1/models';

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching models:', error.response ? error.response.data : error.message);
  }
}

listModels();
