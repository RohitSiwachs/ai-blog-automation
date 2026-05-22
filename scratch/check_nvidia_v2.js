const axios = require('axios');

async function testNvidia(model) {
  const apiKey = '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';
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  console.log(`Testing NVIDIA API with model: ${model}...`);

  try {
    const response = await axios.post(url, {
      model: model,
      messages: [{ role: 'user', content: 'Say "NVIDIA API is working!"' }],
      max_tokens: 50,
      temperature: 0.7,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    console.log(`--- ${model} Success ---`);
    console.log('Response:', response.data.choices[0].message.content);
  } catch (error) {
    console.log(`--- ${model} Failed ---`);
    console.error('Status:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
        console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function runTests() {
    await testNvidia('meta/llama-3.1-8b-instruct');
    await testNvidia('google/gemma-3-27b-it');
}

runTests();
