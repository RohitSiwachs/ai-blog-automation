const axios = require('axios');

async function testGemma() {
  const apiKey = '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';
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  try {
    const response = await axios.post(url, {
      model: 'google/gemma-4-31b-it',
      messages: [{ role: 'user', content: 'Say hello' }],
      max_tokens: 100,
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
      chat_template_kwargs: { enable_thinking: true }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error:', error.response ? error.response.status : error.message);
    console.error('Data:', error.response ? JSON.stringify(error.response.data, null, 2) : 'No data');
  }
}

testGemma();
