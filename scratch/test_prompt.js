const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testPrompt() {
  const apiKey = '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';
  const url = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';
  
  // This is the exact prompt that was engineered by Llama in the second run
  const prompt = 'Create a Premium Isometric Conceptual Design background for "The Future of Web Design in 2026 for Indian Professionals" with glowing structures, smooth high-contrast colors, elegant lighting, no text, no labels.';

  console.log('Requesting image from NVIDIA Flux.1-schnell with the exact prompt...');

  try {
    const response = await axios.post(url, {
      prompt: prompt,
      seed: 0
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 120000
    });

    const imageBase64 = response.data?.artifacts?.[0]?.base64 || response.data?.image;
    if (imageBase64) {
      const buffer = Buffer.from(imageBase64, 'base64');
      const outputPath = path.join(__dirname, 'test_prompt_output.png');
      fs.writeFileSync(outputPath, buffer);
      console.log('--- Success ---');
      console.log('Saved to:', outputPath);
      console.log('Size (bytes):', buffer.length);
    } else {
      console.log('No image data found:', response.data);
    }
  } catch (error) {
    console.error('Failed:', error.message);
  }
}

testPrompt();
