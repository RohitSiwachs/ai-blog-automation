const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testHumanizer() {
  console.log('🤖 Initializing Humanizer Module Verification...');
  
  const sampleAIText = `Additionally, it is crucial to recognize that digital transformations represent key elements in modern entrepreneurial endeavors. Entrepreneurs should leverage digital tools to achieve success. In conclusion, utilizing technology will optimize productivity.`;
  
  const humanizerPrompt = `You are a professional editor and copywriter.
Humanize the following text to make it sound completely natural, professional, conversational, and written by a skilled human.
Increase sentence length variety (burstiness), use active voice, write engaging transitions, and eliminate repetitive structures or robotic phrasing.
Preserve the markdown formatting, headers, links, and overall meaning perfectly.

Text to humanize:
"""
${sampleAIText}
"""

Output only the final humanized text. Do not write any introductions or conclusions.`;

  // Test Gemini humanizer
  const geminiApiKey = 'AIzaSyBXz7Dew7-VnjM33AYvdCh7jWtpG3EVB2I';
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  
  console.log('\nTesting Gemini Humanizer Pass...');
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(humanizerPrompt);
    const humanizedText = result.response.text().trim();
    console.log('✅ Gemini Success!');
    console.log('--- Original Content ---');
    console.log(sampleAIText);
    console.log('--- Humanized Content ---');
    console.log(humanizedText);
  } catch (err) {
    console.warn('❌ Gemini Humanizer failed:', err.message);
  }

  // Test NVIDIA humanizer
  console.log('\nTesting NVIDIA Llama Humanizer Pass...');
  const nvidiaApiKey = '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';
  try {
    const response = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
      model: 'meta/llama-3.1-8b-instruct',
      messages: [{ role: 'user', content: humanizerPrompt }],
      max_tokens: 500,
      temperature: 0.7,
    }, {
      headers: {
        'Authorization': `Bearer ${nvidiaApiKey}`,
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
    
    console.log('✅ NVIDIA Success!');
    console.log('--- Humanized Content (NVIDIA) ---');
    console.log(response.data.choices[0].message.content.trim());
  } catch (err) {
    console.warn('❌ NVIDIA Humanizer failed:', err.message);
  }
}

testHumanizer();
