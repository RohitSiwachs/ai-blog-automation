const axios = require('axios');

async function testLlamaWithThinking() {
  const apiKey = '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';
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

  try {
    const response = await axios.post(url, {
      model: 'meta/llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: 'Say hello' }],
      chat_template_kwargs: { enable_thinking: true }
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    });
    console.log('Success');
  } catch (error) {
    console.log('Error status:', error.response ? error.response.status : error.message);
    console.log('Error data:', error.response ? JSON.stringify(error.response.data) : 'No data');
  }
}

testLlamaWithThinking();
